const ExcelJS = require('exceljs');
const { checkXlsxStructure, createRowCounter, tooManyRowsError, MAX_DATA_ROWS_PER_SHEET } = require('./spreadsheetLimits');
const { pool, withTransaction } = require('../db');
const historyService = require('./historyService');
const {
  unwrapExcelValue,
  optionalExcelText,
  normalizeHeader,
  PLACEHOLDER_PATTERN,
  parseMoneyToCents,
  parseImportDate,
  SCIENTIFIC_SERIAL_PATTERN,
  createSerialGenerator,
  normalizeEmployeeImportName,
  EMPLOYEE_IMPORT_EMAIL_ALIASES,
  loadImportLookups,
  withRowSavepoint,
} = require('./importHelpers');

// Lenient wrappers kept for callers that want "no value" instead of an error;
// the importers themselves use the strict parsers in importHelpers.
const excelDateToISO = (val) => parseImportDate(val) ?? null;

const excelNumberToCents = (val) => {
  const cents = parseMoneyToCents(val);
  return cents > 0 ? cents : 0;
};

const normalizeAssetStatus = (val, fallback = 'available') => {
  const fallbackStatus = ['available', 'in-use', 'retired'].includes(fallback) ? fallback : 'available';
  const text = optionalExcelText(val)?.toLowerCase().replace(/[_\s]+/g, '-');
  if (!text) return fallbackStatus;
  if (text === 'assigned' || text === 'inuse') return 'in-use';
  return ['available', 'in-use', 'retired'].includes(text) ? text : fallbackStatus;
};

// Single-lookup variant (one query per call). The importers prefetch every
// employee with loadImportLookups instead; this stays for other callers.
const findEmployeeIdByImportName = async (databasePool, value) => {
  const importIdentity = optionalExcelText(value);
  if (!importIdentity) return null;
  const normalizedName = normalizeEmployeeImportName(value);

  // Email is the primary, unique identifier in new workbooks. Name aliases are
  // retained only so previously exported/imported files continue to work.
  const suppliedEmail = importIdentity.includes('@') ? importIdentity.toLowerCase() : null;
  const emailAlias = suppliedEmail || EMPLOYEE_IMPORT_EMAIL_ALIASES[normalizedName];
  const query = emailAlias
    ? `SELECT id FROM employees
       WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL
       LIMIT 2`
    : `SELECT id FROM employees
       WHERE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) = $1
         AND deleted_at IS NULL
       LIMIT 2`;
  const { rows } = await databasePool.query(query, [emailAlias || normalizedName]);

  if (rows.length > 1) {
    const err = new Error(`Multiple active employees match imported assignee: ${importIdentity}`);
    err.statusCode = 409;
    throw err;
  }
  return rows[0]?.id || null;
};

const normalizeKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Legacy sheets describe items by free-text "Type"; map the known spellings
// onto the existing categories. Anything else becomes its own category.
const CATEGORY_ALIASES = Object.freeze({
  headphone: 'Audio & Headset',
  headphones: 'Audio & Headset',
  headset: 'Audio & Headset',
  earphone: 'Audio & Headset',
  earphones: 'Audio & Headset',
  mouse: 'Keyboard & Mouse',
  wirelessmouse: 'Keyboard & Mouse',
  keyboard: 'Keyboard & Mouse',
  wirelesskeyboard: 'Keyboard & Mouse',
  keyboardmouse: 'Keyboard & Mouse',
  keyboardandmouse: 'Keyboard & Mouse',
  wirelesskeyboardmouse: 'Keyboard & Mouse',
  wirelesskeyboardandmouse: 'Keyboard & Mouse',
  laptop: 'Laptop',
  monitor: 'Monitor',
  adaptor: 'Adaptor',
  adapter: 'Adaptor',
  charger: 'Adaptor',
});

const CATEGORY_COLORS = ['Blue', 'Indigo', 'Purple', 'Teal', 'Cyan', 'Emerald', 'Amber', 'Rose'];

const importCategoryName = (type) => {
  const text = optionalExcelText(type);
  if (!text) return null;
  return CATEGORY_ALIASES[normalizeKey(text)] || text.replace(/\s+/g, ' ');
};

// Export note for an asset whose holder was deleted; stripped again on import
// (the importer writes its own "Previously held by" note instead).
const departedHolderNote = (email) => `[Holder ${email} is no longer an active employee]`;
const DEPARTED_HOLDER_NOTE_PATTERN = /\s*\[Holder \S+ is no longer an active employee\]/g;

// ────────────────────────────────────────────
// EXPORT — Generate .xlsx file with 4 sheets
// ────────────────────────────────────────────
//
// Every asset is exported exactly once, children included. A row goes on the
// sheet for its own ownership/category: client-owned items → Client Laptops,
// laptops → Laptops, audio → Headphones, everything else (monitors, adaptors,
// stands…) → Keyboard Mouse. Child rows carry their parent in "Parent Serial".
// For compatibility with the legacy layout, a laptop with exactly one adaptor
// also lists it in "Adaptor S/N"; the importer skips that column when the
// adaptor has a row of its own, so it is never created twice.
//
// Status, Category, Location, Parent Serial and Asset Name are appended to
// every sheet (Comments too where the legacy layout had none).
// options.ids — export only these assets (Inventory "export selected");
// omitted, everything is exported as before.
const exportAssetsToExcel = async (dependencies = {}, options = {}) => {
  const databasePool = dependencies.pool || pool;
  const ids = Array.isArray(options.ids) ? options.ids : null;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AssetTrack';
  workbook.created = new Date();

  const { rows: assets } = await databasePool.query(`
    SELECT a.*,
           c.name AS category_name,
           e.name AS assignee_name,
           e.email AS assignee_email,
           e.deleted_at AS assignee_deleted_at,
           p.serial_number AS parent_serial_number
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN employees e ON a.assigned_to = e.id
    LEFT JOIN assets p ON a.parent_id = p.id
    ${ids ? 'WHERE a.id = ANY($1::int[])' : ''}
    ORDER BY a.category_id, a.id
  `, ids ? [ids] : undefined);

  // A selection may leave out the adaptors of the laptops in it; read them
  // separately so the legacy column is the same as in a full export.
  const adaptorSource = ids
    ? (await databasePool.query(`
        SELECT a.parent_id, a.serial_number, c.name AS category_name
        FROM assets a LEFT JOIN categories c ON a.category_id = c.id
        WHERE a.parent_id = ANY($1::int[])
        ORDER BY a.category_id, a.id
      `, [ids])).rows
    : assets;

  // Adaptor children per parent, for the legacy "Adaptor S/N" column.
  const adaptorsByParent = new Map();
  for (const asset of adaptorSource) {
    if (!asset.parent_id) continue;
    if (asset.category_name && importCategoryName(asset.category_name) !== 'Adaptor') continue;
    adaptorsByParent.set(asset.parent_id, [...(adaptorsByParent.get(asset.parent_id) || []), asset.serial_number]);
  }
  const legacyAdaptorSerial = (asset) => {
    const adaptors = adaptorsByParent.get(asset.id) || [];
    return adaptors.length === 1 ? adaptors[0] : '';
  };

  const sheetFor = (asset) => {
    if (asset.asset_type === 'client') return 'Client Laptops';
    const category = importCategoryName(asset.category_name);
    if (category === 'Laptop') return 'Laptops';
    if (category === 'Audio & Headset') return 'Headphones';
    return 'Keyboard Mouse';
  };
  const assetsFor = (sheetName) => assets.filter((asset) => sheetFor(asset) === sheetName);

  // DATE columns arrive as 'YYYY-MM-DD' strings; a JS Date (older pg type
  // parsing) is local midnight, so format it with local getters.
  const exportDate = (value) => {
    if (!value) return '';
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    return value;
  };

  // Helper to calculate remaining warranty days
  const remainingDays = (expiry) => {
    const expiryStr = exportDate(expiry);
    if (!expiryStr) return '';
    const expiryDate = new Date(expiryStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    expiryDate.setHours(0,0,0,0);
    return Math.round((expiryDate - today) / (1000 * 60 * 60 * 24));
  };

  const holderEmail = (a) => a.assignee_email || '';
  // An in-use asset whose holder record is gone can't be re-imported as
  // in-use; export it as available (the note in Comments keeps the history).
  const exportStatus = (a) => (a.status === 'in-use' && !a.assignee_email ? 'available' : a.status);
  const comments = (a) => [
    a.notes,
    a.assignee_deleted_at && a.assignee_email ? departedHolderNote(a.assignee_email) : null,
  ].filter(Boolean).join('\n');
  const cost = (a) => (a.cost_cents ? a.cost_cents / 100 : '');
  const trailing = (a) => [a.category_name || '', a.location || '', a.parent_serial_number || '', a.name || ''];
  const TRAILING_HEADERS = ['Category', 'Location', 'Parent Serial', 'Asset Name'];

  // ── Sheet 1: Laptops ──
  const laptopSheet = workbook.addWorksheet('Laptops');
  laptopSheet.addRow([
    'Issued To Email','Brand','Model','Serial Number','Date of Invoice','Date of Issue',
    'Adaptor S/N','Processor','RAM','HDD','Screen Size','Graphics Card','OS',
    'MS Office','Anti-Virus','Service/Warranty','Purchase Price','Comments',
    'Warranty Last Date','Remaining Days','Warranty Upgrade','Vendor',
    'Status', ...TRAILING_HEADERS,
  ]);
  for (const a of assetsFor('Laptops')) {
    laptopSheet.addRow([
      holderEmail(a),
      a.brand || '', a.model || '', a.serial_number,
      exportDate(a.purchase_date), exportDate(a.assigned_date),
      legacyAdaptorSerial(a),
      a.processor || '', a.ram || '', a.storage || '',
      a.screen_size || '', a.graphics_card || '',
      a.os || '', a.ms_office || '', a.anti_virus || '',
      a.warranty_plan || '', cost(a),
      comments(a), exportDate(a.warranty_expiry_date),
      remainingDays(a.warranty_expiry_date),
      a.warranty_upgrade || '', a.vendor || '',
      a.status, ...trailing(a),
    ]);
  }

  // ── Sheet 2: Headphones ──
  const headphoneSheet = workbook.addWorksheet('Headphones');
  headphoneSheet.addRow([
    'Issued To Email','Brand','Type','Model','Color','Serial Number',
    'Date of Invoice','Service/Warranty','Purchase Price',
    'Issue Date','Return Date','Status','Vendor',
    ...TRAILING_HEADERS, 'Comments',
  ]);
  for (const a of assetsFor('Headphones')) {
    headphoneSheet.addRow([
      holderEmail(a), a.brand || '', a.hardware_type || '',
      a.model || '', a.color || '', a.serial_number,
      exportDate(a.purchase_date), a.warranty_plan || '',
      cost(a),
      exportDate(a.assigned_date), exportDate(a.return_date), exportStatus(a), a.vendor || '',
      ...trailing(a), comments(a),
    ]);
  }

  // ── Sheet 3: Keyboard / Mouse (and every other company category) ──
  const kbSheet = workbook.addWorksheet('Keyboard Mouse');
  kbSheet.addRow([
    'Issued To Email','Date of Issue','Hardware Type','Brand','Model',
    'Serial Number','Date of Invoice','Service/Warranty',
    'Purchase Price','Comments','Vendor Name',
    'Status', ...TRAILING_HEADERS,
  ]);
  for (const a of assetsFor('Keyboard Mouse')) {
    kbSheet.addRow([
      holderEmail(a), exportDate(a.assigned_date),
      a.hardware_type || '', a.brand || '', a.model || '',
      a.serial_number, exportDate(a.purchase_date),
      a.warranty_plan || '', cost(a),
      comments(a), a.vendor || '',
      exportStatus(a), ...trailing(a),
    ]);
  }

  // ── Sheet 4: Client Laptops (every client-owned asset) ──
  const clientSheet = workbook.addWorksheet('Client Laptops');
  clientSheet.addRow([
    'Issued To Email','Brand','Type','Model','Serial Number',
    'Status','Received On','Returned On','Client Name','Comments',
    ...TRAILING_HEADERS, 'Date of Issue',
  ]);
  for (const a of assetsFor('Client Laptops')) {
    clientSheet.addRow([
      holderEmail(a), a.brand || '', a.hardware_type || '',
      a.model || '', a.serial_number, exportStatus(a),
      exportDate(a.received_on || a.purchase_date),
      exportDate(a.return_date), a.client_name || '', comments(a),
      ...trailing(a), exportDate(a.assigned_date),
    ]);
  }

  // For the access audit log (data.exported).
  Object.defineProperty(workbook, 'exportedAssetCount', { value: assets.length, enumerable: false });
  return workbook;
};

// ────────────────────────────────────────────
// IMPORT — Read .xlsx file, insert rows to DB
// ────────────────────────────────────────────

// Status cells and comments carry the real lifecycle as free text, e.g.
// "Returned-Broken-In Store" or "Retuned on 13th Feb 2026" (sic).
const RETIRED_PATTERN = /broken|damaged?|not\s*working|faulty/i;
const RELEASED_PATTERN = /\b(return|returned|retuned)\b|in[\s-]*store|store\s*room|\bstored\b/i;
const IN_USE_PATTERN = /^(in[\s_-]*use|assigned)$/i;

const parseLifecycleText = (value) => {
  const text = optionalExcelText(value);
  if (!text) return null;
  if (RETIRED_PATTERN.test(text)) return 'retired';
  if (RELEASED_PATTERN.test(text)) return 'available';
  if (IN_USE_PATTERN.test(text.trim())) return 'in-use';
  if (/^retired$/i.test(text.trim())) return 'retired';
  if (/^available$/i.test(text.trim())) return 'available';
  return null;
};

// Explicit statuses accepted from an export-format Status column.
const parseStatusKeyword = (value) => {
  const text = optionalExcelText(value)?.toLowerCase().replace(/[\s_]+/g, '-');
  if (!text) return null;
  if (text === 'in-use' || text === 'inuse' || text === 'assigned') return 'in-use';
  return ['available', 'retired', 'returned'].includes(text) ? text : undefined;
};

const withoutPlaceholder = (value) => (value && !PLACEHOLDER_PATTERN.test(value) ? value : null);

// Columns are matched by normalized header name, so reordered or extra
// columns work. Each field lists the legacy spellings and the export headers.
const COLUMN_ALIASES = Object.freeze({
  issuedTo: ['issued_to', 'issued_to_email', 'assigned_to', 'assigned_to_email'],
  brand: ['brand'],
  model: ['model'],
  serial: ['serial_number', 'serial_no', 'serial'],
  purchaseDate: ['date_of_invoice', 'invoice_date', 'purchase_date'],
  issueDate: ['date_of_issue', 'issue_date', 'assigned_date'],
  adaptorSerial: ['adaptor_s_n', 'adapter_s_n', 'adaptor_sn', 'adapter_sn', 'adaptor_serial', 'adaptor_serial_number'],
  processor: ['processor'],
  ram: ['ram'],
  storage: ['hdd', 'ssd', 'storage'],
  screenSize: ['screen_size'],
  graphicsCard: ['graphics_card'],
  os: ['os'],
  msOffice: ['ms_office'],
  antiVirus: ['anti_virus', 'antivirus'],
  warrantyPlan: ['service_warranty', 'warranty_plan', 'warranty'],
  cost: ['purchase_price', 'price', 'cost'],
  comments: ['comments', 'comment', 'remarks', 'notes'],
  warrantyExpiryDate: ['warranty_last_date', 'warranty_expiry_date', 'warranty_expiry'],
  warrantyUpgrade: ['warranty_upgrade'],
  vendor: ['vendor', 'vendor_name', 'vender', 'vender_name'],
  hardwareType: ['type', 'hardware_type'],
  color: ['color', 'colour'],
  returnDate: ['return_date', 'returned_on'],
  status: ['status'],
  receivedOn: ['received_on', 'recieved_on'],
  clientName: ['client_name'],
  category: ['category'],
  location: ['location'],
  parentSerial: ['parent_serial', 'parent_serial_number'],
  name: ['asset_name', 'name'],
});
const FIELD_BY_HEADER = new Map(
  Object.entries(COLUMN_ALIASES).flatMap(([field, headers]) => headers.map((header) => [header, field]))
);
const IDENTITY_FIELDS = ['issuedTo', 'brand', 'model'];
// Columns only the new export has. A sheet with any of them is read in
// export format: its Status column is authoritative (no inference from
// comments) and must hold available / in-use / assigned / retired / returned.
const EXPORT_FORMAT_FIELDS = ['category', 'location', 'parentSerial'];

const SHEETS = Object.freeze({
  Laptops: { code: 'LAP', assetType: 'company', defaultType: 'Laptop', fixedType: true },
  Headphones: { code: 'HP', assetType: 'company', defaultType: 'Headphone' },
  'Keyboard Mouse': { code: 'KM', assetType: 'company', defaultType: 'Keyboard' },
  'Client Laptops': { code: 'CL', assetType: 'client', defaultType: 'Laptop' },
});

const displayValue = (val) => {
  const value = unwrapExcelValue(val);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString().substring(0, 10);
  return String(value ?? '').trim();
};

// Maps a sheet's header row to { field: columnNumber } and the header text
// as written (for error messages).
const readSheetColumns = (sheet) => {
  const columns = {};
  const labels = {};
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const field = FIELD_BY_HEADER.get(normalizeHeader(cell.value));
    if (field && !(field in columns)) {
      columns[field] = columnNumber;
      labels[field] = displayValue(cell.value);
    }
  });
  return { columns, labels };
};

const missingHeadersFor = (columns) => {
  const missing = [];
  if (!columns.serial) missing.push('Serial Number');
  if (!IDENTITY_FIELDS.some((field) => columns[field])) missing.push('one of Issued To, Brand, Model');
  return missing;
};

// Parses one sheet row into a normalized record. Every invalid value is
// collected in `problems` so the row is reported instead of aborting.
const parseSheetRow = (excelRow, rowNum, sheetName, layout, lookups, nextSerial) => {
  const config = SHEETS[sheetName];
  const { columns, labels } = layout;
  const exportFormat = EXPORT_FORMAT_FIELDS.some((field) => columns[field]);
  const problems = [];
  const cellOf = (field) => (columns[field] ? excelRow.getCell(columns[field]) : null);
  const raw = (field) => cellOf(field)?.value ?? null;
  const text = (field) => optionalExcelText(raw(field));
  const date = (field) => {
    const parsed = parseImportDate(raw(field));
    if (parsed === undefined) {
      problems.push(`${labels[field]} "${displayValue(raw(field))}" is not a valid date (use DD/MM/YYYY or YYYY-MM-DD, years 1900–2100)`);
    }
    return parsed ?? null;
  };

  // ── Serial ──
  const serialCell = cellOf('serial');
  const serialValue = unwrapExcelValue(serialCell?.value);
  if (typeof serialValue === 'number'
    && (Math.abs(serialValue) > 2 ** 53 || /E[+-]/i.test(serialCell.numFmt || ''))) {
    problems.push(`Serial Number ${serialValue} is stored as a number in scientific notation, so its digits are lost; format the column as Text and re-enter it`);
  }
  const rawSerial = optionalExcelText(serialValue);
  if (rawSerial && SCIENTIFIC_SERIAL_PATTERN.test(rawSerial)) {
    problems.push(`Serial Number "${rawSerial}" looks like Excel scientific notation, so its digits are lost; re-enter the full serial`);
  }

  // ── Money ──
  let costCents = parseMoneyToCents(raw('cost'));
  if (costCents === undefined) {
    problems.push(`${labels.cost} "${displayValue(raw('cost'))}" is not a valid amount (digits with up to 2 decimals, at most 21474836.47)`);
    costCents = 0;
  }

  // ── Holder ──
  const issuedTo = text('issuedTo');
  const holder = lookups.resolveEmployee(issuedTo);
  if (holder?.ambiguous) problems.push(`${labels.issuedTo} "${issuedTo}" matches more than one active employee; use their email`);

  // ── Status ──
  const statusText = text('status');
  const comments = text('comments')?.replace(DEPARTED_HOLDER_NOTE_PATTERN, '').trim() || null;
  const strictStatus = exportFormat && Boolean(columns.status);
  let lifecycle;
  if (strictStatus) {
    lifecycle = parseStatusKeyword(statusText);
    if (lifecycle === undefined) problems.push(`Status "${statusText}" must be available, in-use, assigned, retired or returned`);
    if (lifecycle === 'returned' && config.assetType !== 'client') problems.push('Status returned is only for client-owned assets (Client Laptops sheet)');
    if (lifecycle === 'in-use' && !issuedTo) problems.push(`Status in-use needs ${labels.issuedTo || 'Issued To'}`);
  } else {
    // Legacy layout: lifecycle is free text in the status cell or comments.
    lifecycle = parseLifecycleText(statusText) || parseLifecycleText(comments);
  }

  // ── Category and location ──
  const categoryText = text('category');
  let category = null;
  let categoryType = null;
  if (categoryText) {
    category = lookups.categoriesByName.get(categoryText.toLowerCase())
      || lookups.categoriesByName.get(String(importCategoryName(categoryText)).toLowerCase());
    if (!category) {
      problems.push(`Category "${categoryText}" does not exist (available: ${lookups.categoryRows.map((row) => row.name).join(', ')})`);
    }
  } else if (exportFormat && columns.category) {
    // Exported with no category: keep it uncategorised rather than guessing.
    categoryType = null;
  } else {
    categoryType = config.fixedType ? config.defaultType : (text('hardwareType') || config.defaultType);
  }
  const locationText = text('location');
  const location = locationText ? lookups.locationsByName.get(locationText.toLowerCase()) : null;
  if (locationText && !location) {
    problems.push(`Location "${locationText}" does not exist (available: ${lookups.locationRows.map((row) => row.name).join(', ')})`);
  }

  const receivedOn = date('receivedOn');
  const fields = {
    brand: text('brand'),
    model: text('model'),
    assetType: config.assetType,
    purchaseDate: date('purchaseDate'),
    processor: text('processor'),
    ram: text('ram'),
    storage: text('storage'),
    screenSize: text('screenSize'),
    graphicsCard: text('graphicsCard'),
    os: text('os'),
    msOffice: text('msOffice'),
    antiVirus: text('antiVirus'),
    warrantyPlan: text('warrantyPlan'),
    costCents,
    warrantyExpiryDate: date('warrantyExpiryDate'),
    warrantyUpgrade: text('warrantyUpgrade'),
    vendor: text('vendor'),
    hardwareType: config.fixedType ? null : text('hardwareType'),
    color: text('color'),
    returnDate: date('returnDate'),
    receivedOn,
    clientName: text('clientName'),
    location,
  };

  const row = {
    sheetName,
    rowNum,
    issuedTo,
    employeeId: holder?.id || null,
    holderInactive: Boolean(holder?.deleted),
    rawSerial,
    serial: rawSerial,
    categoryType,
    category,
    // Client sheets record the hand-over date as "Received on".
    issueDate: date('issueDate') ?? (config.assetType === 'client' ? receivedOn : null),
    statusText,
    comments,
    strictStatus,
    lifecycle,
    adaptorSerial: text('adaptorSerial'),
    parentSerial: text('parentSerial'),
    assetName: text('name'),
    fields,
    problems,
  };

  if (!rawSerial || PLACEHOLDER_PATTERN.test(rawSerial)) {
    row.serialGenerated = true;
    row.serial = nextSerial(config.code, [
      normalizeEmployeeImportName(issuedTo), fields.brand, fields.model,
      category?.name || importCategoryName(categoryType), fields.purchaseDate, costCents,
    ]);
  }
  return row;
};

const rowLifecycle = (row) => (
  'lifecycle' in row ? row.lifecycle : parseLifecycleText(row.statusText) || parseLifecycleText(row.comments)
);
const isReleased = (row) => ['available', 'retired', 'returned'].includes(rowLifecycle(row));

// Rows sharing a serial are either one item changing hands (the earlier holder
// returned it, or it is the same person) or different items that share a
// product code (e.g. two identical laptop stands). Handovers are merged into
// one asset; distinct items get "-2", "-3" suffixes so nothing is dropped.
const groupRowsIntoItems = (rows) => {
  const bySerial = new Map();
  for (const row of rows) {
    if (!bySerial.has(row.serial)) bySerial.set(row.serial, []);
    bySerial.get(row.serial).push(row);
  }

  const items = [];
  for (const [serial, group] of bySerial) {
    group.sort((a, b) => (a.issueDate || '').localeCompare(b.issueDate || '') || a.order - b.order);
    const serialItems = [];
    for (const row of group) {
      const handover = serialItems.find((item) => {
        const last = item.rows[item.rows.length - 1];
        return isReleased(last) || normalizeKey(last.issuedTo) === normalizeKey(row.issuedTo);
      });
      if (handover) {
        handover.rows.push(row);
      } else {
        const suffix = serialItems.length === 0 ? '' : `-${serialItems.length + 1}`;
        serialItems.push({ serial: `${serial}${suffix}`, rows: [row] });
      }
    }
    items.push(...serialItems);
  }
  return items.sort((a, b) => a.rows[0].order - b.rows[0].order);
};

// Serial for a laptop's "Adaptor S/N" when the sheet only says "N/A".
const generatedAdaptorSerialFor = (laptopSerial) => createSerialGenerator('ADP')([laptopSerial]);

const importAssetsFromExcel = async (filePath, actorUser, dependencies = {}, { dryRun = false } = {}) => {
  const databasePool = dependencies.pool || pool;
  const runInTransaction = dependencies.withTransaction || withTransaction;
  const logHistoryEvent = dependencies.logEvent || historyService.logEvent;
  // Sheet count and unpacked size are checked before the workbook is loaded.
  await checkXlsxStructure(filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // ── Locate the supported sheets and map their columns by header ──
  const sheets = [];
  const missingBySheet = [];
  for (const sheetName of Object.keys(SHEETS)) {
    const sheet = workbook.worksheets.find((ws) => normalizeHeader(ws.name) === normalizeHeader(sheetName));
    if (!sheet) continue;
    // actualRowCount counts rows with values (header included).
    if (sheet.actualRowCount - 1 > MAX_DATA_ROWS_PER_SHEET) throw tooManyRowsError(`sheet "${sheet.name}"`);
    const layout = readSheetColumns(sheet);
    const missing = missingHeadersFor(layout.columns);
    if (missing.length > 0) missingBySheet.push(`${sheetName}: ${missing.join('; ')}`);
    sheets.push({ sheetName, sheet, layout });
  }
  if (sheets.length === 0) {
    const err = new Error(`The workbook has none of the expected sheets: ${Object.keys(SHEETS).join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  if (missingBySheet.length > 0) {
    const err = new Error(`Missing required columns. ${missingBySheet.join('. ')}`);
    err.statusCode = 400;
    throw err;
  }

  const results = {
    dryRun,
    total: 0,
    imported: 0,
    skipped: [],
    errors: [],
    warnings: [],
    categoriesCreated: [],
    generatedSerials: 0,
    handovers: 0,
  };

  const lookups = await loadImportLookups(databasePool);
  const serialGenerators = new Map();
  const generateSerial = (code, parts) => {
    if (!serialGenerators.has(code)) serialGenerators.set(code, createSerialGenerator(code));
    return serialGenerators.get(code)(parts);
  };

  // ── Read every supported sheet into normalized rows ──
  const rows = [];
  const serialsWithOwnRow = new Set();
  for (const { sheetName, sheet, layout } of sheets) {
    const countRow = createRowCounter(`sheet "${sheet.name}"`);
    sheet.eachRow((excelRow, rowNum) => {
      if (rowNum === 1) return;
      countRow();
      const row = parseSheetRow(excelRow, rowNum, sheetName, layout, lookups, generateSerial);
      const hasContent = row.issuedTo || row.fields.brand || row.fields.model || row.assetName;
      if (row.serialGenerated && !hasContent) {
        results.skipped.push(`Row missing serial (${sheetName} sheet, row ${rowNum})`);
        return;
      }
      results.total++;
      if (row.rawSerial) serialsWithOwnRow.add(row.rawSerial.toLowerCase());
      if (row.problems.length > 0) {
        results.errors.push({ row: rowNum, sheet: sheetName, serial: row.rawSerial || null, messages: row.problems });
        return;
      }
      row.order = rows.length;
      rows.push(row);
    });
  }

  // Accessories must point at an asset in this file or already in inventory.
  const fileSerials = new Set(rows.map((row) => row.serial.toLowerCase()));
  const validRows = rows.filter((row) => {
    if (!row.parentSerial || fileSerials.has(row.parentSerial.toLowerCase())
      || lookups.assetIdsBySerial.has(row.parentSerial.toLowerCase())) return true;
    results.errors.push({
      row: row.rowNum, sheet: row.sheetName, serial: row.rawSerial || null,
      messages: [`Parent Serial "${row.parentSerial}" is not in this file or in inventory`],
    });
    return false;
  });
  results.errors.sort((a, b) => a.sheet.localeCompare(b.sheet) || a.row - b.row);

  const items = groupRowsIntoItems(validRows);

  // A laptop's "Adaptor S/N" whose adaptor also has its own row: that row
  // is linked to the laptop even when it has no Parent Serial of its own.
  const laptopByAdaptorSerial = new Map();
  for (const row of validRows) {
    const adaptorSerial = withoutPlaceholder(row.adaptorSerial);
    if (adaptorSerial) laptopByAdaptorSerial.set(adaptorSerial.toLowerCase(), row.serial);
  }

  // ── Insert in one transaction (rolled back for a dry run) ──
  const DRY_RUN_ROLLBACK = Symbol('dry run');
  try {
    await runInTransaction(async (client) => {
      const categoryIds = new Map([...lookups.categoriesByName].map(([key, row]) => [key, row.id]));
      // Same name apart from case, spaces or punctuation ("Laptop-Stand",
      // "laptop stand") reuses the existing category instead of creating one.
      const squash = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
      const categoryIdsBySquashedName = new Map([...lookups.categoriesByName].map(([key, row]) => [squash(key), row.id]));
      const resolveCategory = async (type) => {
        const name = importCategoryName(type);
        if (!name) return null;
        const key = name.toLowerCase();
        if (categoryIds.has(key)) return categoryIds.get(key);
        if (categoryIdsBySquashedName.has(squash(name))) return categoryIdsBySquashedName.get(squash(name));

        const created = await client.query(`
          INSERT INTO categories (name, badge_char, color, description, created_at)
          VALUES ($1, $2, $3, $4, NOW()) RETURNING id
        `, [
          name,
          name.charAt(0).toUpperCase(),
          CATEGORY_COLORS[results.categoriesCreated.length % CATEGORY_COLORS.length],
          'Created by Excel import',
        ]);
        const id = created.rows[0].id;
        results.categoriesCreated.push(name);
        categoryIds.set(key, id);
        categoryIdsBySquashedName.set(squash(name), id);
        return id;
      };

      // Serials already in inventory or inserted earlier in this run.
      const idsBySerial = new Map(lookups.assetIdsBySerial);
      const links = [];

      const insertAsset = async (assetData, pending) => {
        const key = assetData.serialNumber.toLowerCase();
        if (idsBySerial.has(key)) {
          pending.skipped.push(`Duplicate serial: ${assetData.serialNumber}`);
          return null;
        }

        const { rows: inserted } = await client.query(`
          INSERT INTO assets (
            name, category_id, model, serial_number, status, asset_type,
            purchase_date, assigned_to, assigned_date, cost_cents, notes,
            warranty_expiry_date, brand, vendor, processor, ram, storage,
            screen_size, graphics_card, os, ms_office, anti_virus,
            warranty_plan, warranty_upgrade, color, hardware_type,
            client_name, return_date, received_on, parent_id, location, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
            $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,NOW(),NOW()
          ) RETURNING id
        `, [
          assetData.name, assetData.categoryId, assetData.model ?? null,
          assetData.serialNumber, assetData.status,
          assetData.assetType || 'company',
          assetData.purchaseDate ?? null, assetData.assignedTo ?? null, assetData.assignedDate ?? null,
          assetData.costCents ?? 0, assetData.notes ?? null,
          assetData.warrantyExpiryDate ?? null, assetData.brand ?? null, assetData.vendor ?? null,
          assetData.processor ?? null, assetData.ram ?? null, assetData.storage ?? null,
          assetData.screenSize ?? null, assetData.graphicsCard ?? null, assetData.os ?? null,
          assetData.msOffice ?? null, assetData.antiVirus ?? null, assetData.warrantyPlan ?? null,
          assetData.warrantyUpgrade ?? null, assetData.color ?? null, assetData.hardwareType ?? null,
          assetData.clientName ?? null, assetData.returnDate ?? null, assetData.receivedOn ?? null,
          assetData.parentId ?? null, assetData.location ?? null,
        ]);

        await logHistoryEvent(
          inserted[0].id, 'created', actorUser, null, assetData.createdNote || 'Imported via Excel upload', null, client
        );
        pending.inserted.push([key, inserted[0].id]);
        return inserted[0].id;
      };

      // Replays each sheet row as issue/return events so the asset timeline
      // shows every past holder, not just the current one.
      const logHoldingHistory = async (assetId, itemRows, finalStatus) => {
        for (const [index, row] of itemRows.entries()) {
          const isLast = index === itemRows.length - 1;
          const holder = row.issuedTo || 'unknown holder';
          if (row.issuedTo) {
            await logHistoryEvent(assetId, 'assigned', actorUser, row.employeeId,
              `Issued to ${holder}${row.issueDate ? ` on ${row.issueDate}` : ''} (from Excel import)`, null, client);
          }
          const released = isLast ? finalStatus !== 'in-use' && row.issuedTo : true;
          if (released && row.issuedTo) {
            const retired = isLast && finalStatus === 'retired';
            const reason = [row.strictStatus ? null : row.statusText, row.comments].filter(Boolean).join(' — ');
            await logHistoryEvent(assetId, retired ? 'retired' : 'returned', actorUser, row.employeeId,
              `${retired ? 'Retired' : 'Returned'} by ${holder}${reason ? `: ${reason}` : ''} (from Excel import)`, null, client);
          }
        }
      };

      for (const item of items) {
        const finalRow = item.rows[item.rows.length - 1];
        const { fields } = finalRow;
        const lifecycle = rowLifecycle(finalRow);
        const rowLabel = `${finalRow.sheetName}, serial ${item.serial}`;
        const warnings = [];

        let status;
        if (finalRow.strictStatus) {
          status = lifecycle || (finalRow.issuedTo ? 'in-use' : 'available');
        } else if (lifecycle === 'retired' || lifecycle === 'available') {
          // A released client asset went back to the client, not into stock.
          status = lifecycle === 'available' && fields.assetType === 'client' ? 'returned' : lifecycle;
        } else {
          status = finalRow.issuedTo ? 'in-use' : 'available';
        }

        // A holder who left (soft-deleted) or is not in the directory cannot
        // hold the asset: import it as available and say who had it.
        let previousHolder = null;
        if (status === 'in-use' && !finalRow.employeeId) {
          previousHolder = finalRow.issuedTo;
          status = 'available';
          warnings.push(finalRow.holderInactive
            ? `Employee ${finalRow.issuedTo} is no longer active (${rowLabel}); imported as available`
            : `Employee not found: ${finalRow.issuedTo} (${rowLabel}); imported as available`);
        }
        const assignedTo = status === 'in-use' ? finalRow.employeeId : null;

        const notes = [];
        for (const row of item.rows) {
          if (row.comments) notes.push(row.comments);
          if (!row.strictStatus && row.statusText && !IN_USE_PATTERN.test(row.statusText)) notes.push(`Sheet status: ${row.statusText}`);
        }
        if (previousHolder) notes.push(`Previously held by ${previousHolder}`);
        else if (status !== 'in-use' && finalRow.issuedTo) notes.push(`Last issued to ${finalRow.issuedTo}`);
        if (finalRow.serialGenerated) notes.push('No serial number in the sheet; serial generated on import');
        if (item.serial !== finalRow.serial) notes.push(`Sheet serial ${finalRow.serial} is shared with another item`);

        // Categories are created outside the row savepoint so a failed row
        // cannot roll back a category a later row still refers to.
        const categoryId = finalRow.category ? finalRow.category.id : await resolveCategory(finalRow.categoryType);
        const adaptorText = finalRow.adaptorSerial;
        const adaptorSerial = adaptorText && (withoutPlaceholder(adaptorText) || generatedAdaptorSerialFor(item.serial));
        // An adaptor with its own row (new exports) is created from that row.
        const adaptorHasOwnRow = Boolean(adaptorSerial) && serialsWithOwnRow.has(adaptorSerial.toLowerCase());
        const adaptorCategoryId = adaptorSerial && !adaptorHasOwnRow ? await resolveCategory('Adaptor') : null;

        const pending = { inserted: [], skipped: [] };
        const outcome = await withRowSavepoint(client, async () => {
          const assetId = await insertAsset({
            ...fields,
            name: finalRow.assetName
              || [fields.brand, fields.model].map(withoutPlaceholder).filter(Boolean).join(' ')
              || item.serial,
            categoryId,
            serialNumber: item.serial,
            status,
            assignedTo,
            assignedDate: assignedTo ? finalRow.issueDate : null,
            notes: notes.length ? notes.join('\n') : null,
          }, pending);
          if (!assetId) return;

          await logHoldingHistory(assetId, item.rows, status);

          // Adaptor S/N (Laptops sheet) becomes a linked accessory that
          // follows its laptop's holder and status.
          if (adaptorSerial && !adaptorHasOwnRow) {
            await insertAsset({
              name: `Adaptor for ${item.serial}`,
              categoryId: adaptorCategoryId,
              serialNumber: adaptorSerial,
              status,
              assignedTo,
              assignedDate: assignedTo ? finalRow.issueDate : null,
              parentId: assetId,
              assetType: fields.assetType,
              createdNote: `Adaptor linked to laptop ${item.serial} via Excel upload`,
            }, pending);
          }
        });

        if (!outcome.ok) {
          results.errors.push({
            row: finalRow.rowNum, sheet: finalRow.sheetName, serial: item.serial,
            messages: [`Could not be saved: ${outcome.error.message}`],
          });
          continue;
        }
        results.skipped.push(...pending.skipped);
        if (pending.inserted.length === 0) continue;
        for (const [key, id] of pending.inserted) {
          idsBySerial.set(key, id);
        }
        results.imported += pending.inserted.length;
        results.warnings.push(...warnings);
        if (finalRow.serialGenerated) results.generatedSerials++;
        if (item.rows.length > 1) results.handovers += item.rows.length - 1;
        const parentSerial = finalRow.parentSerial || laptopByAdaptorSerial.get(item.serial.toLowerCase());
        if (parentSerial) links.push({ item, finalRow, parentSerial });
      }

      // Link accessories once every row exists, so a child may come before
      // its parent. A parent skipped as a duplicate links to the existing one.
      for (const { item, finalRow, parentSerial } of links) {
        const childId = idsBySerial.get(item.serial.toLowerCase());
        const parentId = idsBySerial.get(parentSerial.toLowerCase());
        if (!childId || !parentId || childId === parentId) continue;
        const outcome = await withRowSavepoint(client, () => (
          client.query('UPDATE assets SET parent_id = $1 WHERE id = $2', [parentId, childId])
        ));
        if (!outcome.ok) {
          results.errors.push({
            row: finalRow.rowNum, sheet: finalRow.sheetName, serial: item.serial,
            messages: [`Imported, but could not be linked to parent ${parentSerial}: ${outcome.error.message}`],
          });
        }
      }

      if (dryRun) throw DRY_RUN_ROLLBACK;
    });
  } catch (err) {
    if (err !== DRY_RUN_ROLLBACK) throw err;
  }

  return results;
};

module.exports = {
  exportAssetsToExcel,
  importAssetsFromExcel,
  excelDateToISO,
  excelNumberToCents,
  normalizeAssetStatus,
  optionalExcelText,
  normalizeEmployeeImportName,
  findEmployeeIdByImportName,
  importCategoryName,
  parseLifecycleText,
  parseStatusKeyword,
  groupRowsIntoItems,
  COLUMN_ALIASES,
};
