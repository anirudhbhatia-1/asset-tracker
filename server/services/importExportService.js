const ExcelJS = require('exceljs');
const { pool, withTransaction } = require('../db');
const historyService = require('./historyService');

// ExcelJS may return formula cells as { formula, result } and rich-text cells
// as { richText }. Normalize those shapes before validating import values.
const unwrapExcelValue = (val) => {
  if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val, 'result')) {
    return val.result;
  }
  if (val && typeof val === 'object' && Array.isArray(val.richText)) {
    return val.richText.map((part) => part.text || '').join('');
  }
  return val;
};

const isBlankOrZero = (val) => {
  const value = unwrapExcelValue(val);
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return value === 0 || !Number.isFinite(value);
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  return trimmed === '' || /^[-+]?0(?:\.0+)?$/.test(trimmed);
};

const optionalExcelText = (val) => {
  if (isBlankOrZero(val)) return null;
  const text = String(unwrapExcelValue(val)).trim();
  return text || null;
};

// Convert Excel date (serial, native Date, or string) to YYYY-MM-DD string.
// Zero, empty, formula-zero, and invalid values are optional and become null.
const excelDateToISO = (val) => {
  if (isBlankOrZero(val)) return null;
  const value = unwrapExcelValue(val);
  
  // If ExcelJS parsed it as a native Date object
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().substring(0, 10);
  }

  // If it's an Excel serial number (e.g. 44652)
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) {
    const ms = (num - 25569) * 86400 * 1000;
    const date = new Date(ms);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().substring(0, 10);
  }
  
  // Try standard string parsing as a fallback
  const strDate = new Date(String(value).trim());
  if (!isNaN(strDate.getTime())) {
    return strDate.toISOString().substring(0, 10);
  }
  
  return null;
};

const excelNumberToCents = (val) => {
  if (isBlankOrZero(val)) return 0;
  const normalized = String(unwrapExcelValue(val)).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
};

const normalizeAssetStatus = (val, fallback = 'available') => {
  const fallbackStatus = ['available', 'in-use', 'retired'].includes(fallback) ? fallback : 'available';
  const text = optionalExcelText(val)?.toLowerCase().replace(/[_\s]+/g, '-');
  if (!text) return fallbackStatus;
  if (text === 'assigned' || text === 'inuse') return 'in-use';
  return ['available', 'in-use', 'retired'].includes(text) ? text : fallbackStatus;
};

// Names in legacy workbooks are not always formatted like the employee
// directory (for example "Arun Kumar" vs "Arunkumar", or "/ Intern").
// Normalize presentation-only differences, then resolve the one known legal
// name/email difference explicitly instead of using unsafe fuzzy matching.
const normalizeEmployeeImportName = (value) => {
  const text = optionalExcelText(value);
  if (!text) return '';
  return text
    .replace(/\s*\/\s*intern\s*$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const EMPLOYEE_IMPORT_EMAIL_ALIASES = Object.freeze({
  deebandhughosh: 'deebandu.ghosh@thinkvibes.com',
  lalitumpa: 'lalit.umap@thinkvibes.com',
  lalitvitthalraoumap: 'lalit.umap@thinkvibes.com',
  niteshkumarkumawat: 'nitesh.kumawat@thinkvibes.com',
  smitapandy: 'smita@thinkvibes.com',
});

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

// ────────────────────────────────────────────
// EXPORT — Generate .xlsx file with 4 sheets
// ────────────────────────────────────────────
const exportAssetsToExcel = async (dependencies = {}) => {
  const databasePool = dependencies.pool || pool;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AssetTrack';
  workbook.created = new Date();

  // Adaptors are exported in their laptop's "Adaptor S/N" column rather than
  // as rows of their own; any other linked accessory keeps its own row. A
  // subquery (not a join) keeps one row per laptop when it has several children.
  const { rows: assets } = await databasePool.query(`
    SELECT a.*,
           c.name AS category_name,
           e.name AS assignee_name,
           e.email AS assignee_email,
           (SELECT ad.serial_number
            FROM assets ad
            LEFT JOIN categories adc ON adc.id = ad.category_id
            WHERE ad.parent_id = a.id AND (adc.name IS NULL OR LOWER(adc.name) = 'adaptor')
            ORDER BY ad.id
            LIMIT 1) AS adaptor_serial_number
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN employees e ON a.assigned_to = e.id
    WHERE NOT (a.parent_id IS NOT NULL AND (c.name IS NULL OR LOWER(c.name) = 'adaptor'))
    ORDER BY a.category_id, a.id
  `);

  // Every asset lands on exactly one sheet, mirroring how import reads them:
  // client-owned items, laptops, audio, and everything else as accessories.
  const sheetFor = (asset) => {
    if (asset.asset_type === 'client') return 'Client Laptops';
    const category = importCategoryName(asset.category_name);
    if (category === 'Laptop') return 'Laptops';
    if (category === 'Audio & Headset') return 'Headphones';
    return 'Keyboard Mouse';
  };
  const assetsFor = (sheetName) => assets.filter((asset) => sheetFor(asset) === sheetName);

  // Helper to calculate remaining warranty days
  const remainingDays = (expiryStr) => {
    if (!expiryStr) return '';
    const expiry = new Date(expiryStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    expiry.setHours(0,0,0,0);
    return Math.round((expiry - today) / (1000 * 60 * 60 * 24));
  };

  // ── Sheet 1: Laptops ──
  const laptopSheet = workbook.addWorksheet('Laptops');
  laptopSheet.addRow([
    'Issued To Email','Brand','Model','Serial Number','Date of Invoice','Date of Issue',
    'Adaptor S/N','Processor','RAM','HDD','Screen Size','Graphics Card','OS',
    'MS Office','Anti-Virus','Service/Warranty','Purchase Price','Comments',
    'Warranty Last Date','Remaining Days','Warranty Upgrade','Vendor'
  ]);
  const laptops = assetsFor('Laptops');
  for (const a of laptops) {
    laptopSheet.addRow([
      a.assignee_email || '',
      a.brand || '', a.model || '', a.serial_number,
      a.purchase_date || '', a.assigned_date || '',
      a.adaptor_serial_number || '',
      a.processor || '', a.ram || '', a.storage || '',
      a.screen_size || '', a.graphics_card || '',
      a.os || '', a.ms_office || '', a.anti_virus || '',
      a.warranty_plan || '', a.cost_cents ? a.cost_cents / 100 : '',
      a.notes || '', a.warranty_expiry_date || '',
      remainingDays(a.warranty_expiry_date),
      a.warranty_upgrade || '', a.vendor || ''
    ]);
  }

  // ── Sheet 2: Headphones ──
  const headphoneSheet = workbook.addWorksheet('Headphones');
  headphoneSheet.addRow([
    'Issued To Email','Brand','Type','Model','Color','Serial Number',
    'Date of Invoice','Service/Warranty','Purchase Price',
    'Issue Date','Return Date','Status','Vendor'
  ]);
  const headphones = assetsFor('Headphones');
  for (const a of headphones) {
    headphoneSheet.addRow([
      a.assignee_email || '', a.brand || '', a.hardware_type || a.category_name || '',
      a.model || '', a.color || '', a.serial_number,
      a.purchase_date || '', a.warranty_plan || '',
      a.cost_cents ? a.cost_cents / 100 : '',
      a.assigned_date || '', a.return_date || '', a.status, a.vendor || ''
    ]);
  }

  // ── Sheet 3: Keyboard / Mouse ──
  const kbSheet = workbook.addWorksheet('Keyboard Mouse');
  kbSheet.addRow([
    'Issued To Email','Date of Issue','Hardware Type','Brand','Model',
    'Serial Number','Date of Invoice','Service/Warranty',
    'Purchase Price','Comments','Vendor Name'
  ]);
  const keyboards = assetsFor('Keyboard Mouse');
  for (const a of keyboards) {
    kbSheet.addRow([
      a.assignee_email || '', a.assigned_date || '',
      a.hardware_type || a.category_name || '', a.brand || '', a.model || '',
      a.serial_number, a.purchase_date || '',
      a.warranty_plan || '', a.cost_cents ? a.cost_cents / 100 : '',
      a.notes || '', a.vendor || ''
    ]);
  }

  // ── Sheet 4: Client Laptops ──
  const clientSheet = workbook.addWorksheet('Client Laptops');
  clientSheet.addRow([
    'Issued To Email','Brand','Type','Model','Serial Number',
    'Status','Received On','Returned On','Client Name','Comments'
  ]);
  const clientLaptops = assetsFor('Client Laptops');
  for (const a of clientLaptops) {
    clientSheet.addRow([
      a.assignee_email || '', a.brand || '', a.hardware_type || a.category_name || '',
      a.model || '', a.serial_number, a.status,
      a.received_on || a.purchase_date || '',
      a.return_date || '', a.client_name || '', a.notes || ''
    ]);
  }

  return workbook;
};

// ────────────────────────────────────────────
// IMPORT — Read .xlsx file, insert rows to DB
// ────────────────────────────────────────────

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

const PLACEHOLDER_SERIAL_PATTERN = /^(n\/?a|none|nil|-+)$/i;
const withoutPlaceholder = (value) => (value && !PLACEHOLDER_SERIAL_PATTERN.test(value) ? value : null);
const SHEET_SERIAL_CODES = Object.freeze({
  Laptops: 'LAP',
  Headphones: 'HP',
  'Keyboard Mouse': 'KM',
  'Client Laptops': 'CL',
});

// Deterministic, so re-importing the same workbook skips these as duplicates.
const generatedSerialFor = (sheetName, rowNum) => (
  `NOSN-${SHEET_SERIAL_CODES[sheetName]}-R${String(rowNum).padStart(4, '0')}`
);

// Column layouts of the four legacy sheets (1-based ExcelJS row.values).
const SHEET_PARSERS = {
  Laptops: (r) => ({
    issuedTo: optionalExcelText(r[1]),
    serial: optionalExcelText(r[4]),
    categoryType: 'Laptop',
    issueDate: excelDateToISO(r[6]),
    comments: optionalExcelText(r[18]),
    adaptorSerial: optionalExcelText(r[7]),
    fields: {
      brand: optionalExcelText(r[2]),
      model: optionalExcelText(r[3]),
      assetType: 'company',
      purchaseDate: excelDateToISO(r[5]),
      processor: optionalExcelText(r[8]),
      ram: optionalExcelText(r[9]),
      storage: optionalExcelText(r[10]),
      screenSize: optionalExcelText(r[11]),
      graphicsCard: optionalExcelText(r[12]),
      os: optionalExcelText(r[13]),
      msOffice: optionalExcelText(r[14]),
      antiVirus: optionalExcelText(r[15]),
      warrantyPlan: optionalExcelText(r[16]),
      costCents: excelNumberToCents(r[17]),
      warrantyExpiryDate: excelDateToISO(r[19]),
      warrantyUpgrade: optionalExcelText(r[21]),
      vendor: optionalExcelText(r[22]),
    },
  }),
  Headphones: (r) => ({
    issuedTo: optionalExcelText(r[1]),
    serial: optionalExcelText(r[6]),
    categoryType: optionalExcelText(r[3]) || 'Headphone',
    issueDate: excelDateToISO(r[10]),
    statusText: optionalExcelText(r[12]),
    fields: {
      brand: optionalExcelText(r[2]),
      hardwareType: optionalExcelText(r[3]),
      model: optionalExcelText(r[4]),
      color: optionalExcelText(r[5]),
      purchaseDate: excelDateToISO(r[7]),
      warrantyPlan: optionalExcelText(r[8]),
      costCents: excelNumberToCents(r[9]),
      returnDate: excelDateToISO(r[11]),
      vendor: optionalExcelText(r[13]),
      assetType: 'company',
    },
  }),
  'Keyboard Mouse': (r) => ({
    issuedTo: optionalExcelText(r[1]),
    serial: optionalExcelText(r[6]),
    categoryType: optionalExcelText(r[3]) || 'Keyboard',
    issueDate: excelDateToISO(r[2]),
    comments: optionalExcelText(r[10]),
    fields: {
      hardwareType: optionalExcelText(r[3]),
      brand: optionalExcelText(r[4]),
      model: optionalExcelText(r[5]),
      purchaseDate: excelDateToISO(r[7]),
      warrantyPlan: optionalExcelText(r[8]),
      costCents: excelNumberToCents(r[9]),
      vendor: optionalExcelText(r[11]),
      assetType: 'company',
    },
  }),
  'Client Laptops': (r) => ({
    issuedTo: optionalExcelText(r[1]),
    serial: optionalExcelText(r[5]),
    categoryType: optionalExcelText(r[3]) || 'Laptop',
    issueDate: excelDateToISO(r[7]),
    statusText: optionalExcelText(r[6]),
    comments: optionalExcelText(r[10]),
    fields: {
      brand: optionalExcelText(r[2]),
      hardwareType: optionalExcelText(r[3]),
      model: optionalExcelText(r[4]),
      receivedOn: excelDateToISO(r[7]),
      returnDate: excelDateToISO(r[8]),
      clientName: optionalExcelText(r[9]),
      assetType: 'client',
    },
  }),
};

const rowLifecycle = (row) => parseLifecycleText(row.statusText) || parseLifecycleText(row.comments);
const isReleased = (row) => ['available', 'retired'].includes(rowLifecycle(row));

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

const importAssetsFromExcel = async (filePath, actorUser, dependencies = {}) => {
  const databasePool = dependencies.pool || pool;
  const runInTransaction = dependencies.withTransaction || withTransaction;
  const logHistoryEvent = dependencies.logEvent || historyService.logEvent;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const results = {
    imported: 0,
    skipped: [],
    errors: [],
    categoriesCreated: [],
    generatedSerials: 0,
    handovers: 0,
  };

  // ── Read every supported sheet into normalized rows ──
  const rows = [];
  for (const [sheetName, parse] of Object.entries(SHEET_PARSERS)) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;
    sheet.eachRow((excelRow, rowNum) => {
      if (rowNum === 1) return;
      const row = { ...parse(excelRow.values), sheetName, rowNum, order: rows.length };
      const hasContent = row.issuedTo || row.fields.brand || row.fields.model;
      if (!row.serial || PLACEHOLDER_SERIAL_PATTERN.test(row.serial)) {
        if (!hasContent) {
          results.skipped.push(`Row missing serial (${sheetName} sheet, row ${rowNum})`);
          return;
        }
        row.serial = generatedSerialFor(sheetName, rowNum);
        row.serialGenerated = true;
      }
      rows.push(row);
    });
  }

  // ── Resolve assignees up front (read-only lookups) ──
  for (const row of rows) {
    row.employeeId = await findEmployeeIdByImportName(databasePool, row.issuedTo);
  }

  const items = groupRowsIntoItems(rows);

  await runInTransaction(async (client) => {
    const categoryIds = new Map();
    const resolveCategory = async (type) => {
      const name = importCategoryName(type);
      if (!name) return null;
      const key = name.toLowerCase();
      if (categoryIds.has(key)) return categoryIds.get(key);

      const existing = await client.query(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]
      );
      let id = existing.rows[0]?.id;
      if (!id) {
        const created = await client.query(`
          INSERT INTO categories (name, badge_char, color, description, created_at)
          VALUES ($1, $2, $3, $4, NOW()) RETURNING id
        `, [
          name,
          name.charAt(0).toUpperCase(),
          CATEGORY_COLORS[results.categoriesCreated.length % CATEGORY_COLORS.length],
          'Created by Excel import',
        ]);
        id = created.rows[0].id;
        results.categoriesCreated.push(name);
      }
      categoryIds.set(key, id);
      return id;
    };

    const insertAsset = async (assetData) => {
      const exists = await client.query(
        'SELECT id FROM assets WHERE serial_number = $1', [assetData.serialNumber]
      );
      if (exists.rows.length > 0) {
        results.skipped.push(`Duplicate serial: ${assetData.serialNumber}`);
        return null;
      }

      const { rows: inserted } = await client.query(`
        INSERT INTO assets (
          name, category_id, model, serial_number, status, asset_type,
          purchase_date, assigned_to, assigned_date, cost_cents, notes,
          warranty_expiry_date, brand, vendor, processor, ram, storage,
          screen_size, graphics_card, os, ms_office, anti_virus,
          warranty_plan, warranty_upgrade, color, hardware_type,
          client_name, return_date, received_on, parent_id, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,NOW(),NOW()
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
        assetData.parentId ?? null,
      ]);

      await logHistoryEvent(
        inserted[0].id, 'created', actorUser, null, assetData.createdNote || 'Imported via Excel upload', null, client
      );
      results.imported++;
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
          const reason = [row.statusText, row.comments].filter(Boolean).join(' — ');
          await logHistoryEvent(assetId, retired ? 'retired' : 'returned', actorUser, row.employeeId,
            `${retired ? 'Retired' : 'Returned'} by ${holder}${reason ? `: ${reason}` : ''} (from Excel import)`, null, client);
        }
      }
    };

    for (const item of items) {
      const finalRow = item.rows[item.rows.length - 1];
      const lifecycle = rowLifecycle(finalRow);

      let status;
      if (lifecycle === 'retired' || lifecycle === 'available') {
        status = lifecycle;
      } else if (finalRow.issuedTo) {
        if (!finalRow.employeeId) {
          results.skipped.push(`Employee not found: ${finalRow.issuedTo} (${finalRow.sheetName}, serial ${item.serial})`);
          continue;
        }
        status = 'in-use';
      } else {
        status = 'available';
      }
      const assignedTo = status === 'in-use' ? finalRow.employeeId : null;

      const notes = [];
      for (const row of item.rows) {
        if (row.comments) notes.push(row.comments);
        if (row.statusText && !IN_USE_PATTERN.test(row.statusText)) notes.push(`Sheet status: ${row.statusText}`);
      }
      if (status !== 'in-use' && finalRow.issuedTo) notes.push(`Last issued to ${finalRow.issuedTo}`);
      if (finalRow.serialGenerated) notes.push('No serial number in the sheet; serial generated on import');
      if (item.serial !== finalRow.serial) notes.push(`Sheet serial ${finalRow.serial} is shared with another item`);

      const { fields } = finalRow;
      const assetId = await insertAsset({
        ...fields,
        name: [fields.brand, fields.model].map(withoutPlaceholder).filter(Boolean).join(' ') || item.serial,
        categoryId: await resolveCategory(finalRow.categoryType),
        serialNumber: item.serial,
        status,
        assignedTo,
        assignedDate: assignedTo ? finalRow.issueDate : null,
        notes: notes.length ? notes.join('\n') : null,
      });
      if (!assetId) continue;

      if (finalRow.serialGenerated) results.generatedSerials++;
      if (item.rows.length > 1) results.handovers += item.rows.length - 1;
      await logHoldingHistory(assetId, item.rows, status);

      // Adaptor S/N (Laptops sheet) becomes a linked accessory that follows
      // its laptop's holder and status.
      if (finalRow.adaptorSerial) {
        const adaptorSerial = withoutPlaceholder(finalRow.adaptorSerial)
          || `${generatedSerialFor(finalRow.sheetName, finalRow.rowNum)}-ADP`;
        await insertAsset({
          name: `Adaptor for ${item.serial}`,
          categoryId: await resolveCategory('Adaptor'),
          serialNumber: adaptorSerial,
          status,
          assignedTo,
          assignedDate: assignedTo ? finalRow.issueDate : null,
          parentId: assetId,
          assetType: fields.assetType,
          createdNote: `Adaptor linked to laptop ${item.serial} via Excel upload`,
        });
      }
    }
  });

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
  generatedSerialFor,
  groupRowsIntoItems,
};
