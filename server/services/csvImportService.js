const ExcelJS = require('exceljs');
const { pool, withTransaction } = require('../db');
const historyService = require('./historyService');
const { importCategoryName } = require('./importExportService');
const {
  optionalExcelText,
  normalizeHeader,
  PLACEHOLDER_PATTERN,
  parseMoneyToCents,
  parseCsvDate,
  SCIENTIFIC_SERIAL_PATTERN,
  createSerialGenerator,
  loadImportLookups,
  withRowSavepoint,
} = require('./importHelpers');

// Column order of the downloadable template (client/public/asset-import-template.csv).
// Only `category` is required; every other column may be left empty.
const CSV_COLUMNS = [
  'serial_number', 'name', 'category', 'brand', 'model', 'status',
  'assigned_to_email', 'assigned_date', 'location', 'ownership', 'client_name',
  'purchase_date', 'cost', 'vendor', 'warranty_plan', 'warranty_expiry_date',
  'warranty_upgrade', 'processor', 'ram', 'storage', 'screen_size', 'graphics_card',
  'os', 'ms_office', 'anti_virus', 'color', 'hardware_type', 'received_on',
  'return_date', 'parent_serial', 'notes',
];

// Unlike the legacy Excel sheets, the CSV template takes explicit statuses only.
const parseCsvStatus = (value) => {
  const text = optionalExcelText(value)?.toLowerCase().replace(/[\s_]+/g, '-');
  if (!text) return null;
  if (text === 'in-use' || text === 'inuse' || text === 'assigned') return 'in-use';
  if (text === 'returned' || text === 'returned-to-client') return 'returned';
  return ['available', 'retired'].includes(text) ? text : undefined;
};

const readCsvRows = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  // Identity map: keep every cell as text so serials like "0244515680" keep
  // their leading zeros and dates are parsed by our day-first rules.
  const sheet = await workbook.csv.readFile(filePath, { map: (value) => value });
  const rows = [];
  let headers = null;
  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const values = row.values.slice(1).map((value) => (value == null ? '' : String(value)));
    if (!headers) {
      headers = values.map(normalizeHeader);
      const duplicates = headers.filter((header, index) => header && headers.indexOf(header) !== index);
      if (duplicates.length > 0) {
        const err = new Error(`The CSV header row repeats these columns: ${[...new Set(duplicates)].join(', ')}. Each column may appear only once.`);
        err.statusCode = 400;
        throw err;
      }
      return;
    }
    if (values.every((value) => !value.trim())) return;
    const record = {};
    headers.forEach((header, index) => { if (header) record[header] = values[index] ?? ''; });
    rows.push({ rowNum, record });
  });
  return { headers: headers || [], rows };
};

const importAssetsFromCsv = async (filePath, actorUser, { dryRun = false } = {}, dependencies = {}) => {
  const databasePool = dependencies.pool || pool;
  const runInTransaction = dependencies.withTransaction || withTransaction;
  const logHistoryEvent = dependencies.logEvent || historyService.logEvent;

  const { headers, rows } = await readCsvRows(filePath);
  if (!headers.includes('category')) {
    const err = new Error(`The CSV must have a header row with at least a "category" column. Expected columns: ${CSV_COLUMNS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const results = {
    dryRun,
    total: rows.length,
    imported: 0,
    importedAssets: [],
    skipped: [],
    errors: [],
    unknownColumns: headers.filter((header) => header && !CSV_COLUMNS.includes(header)),
  };

  // Employees, categories, locations and existing serials are loaded once,
  // so each row is validated with map lookups instead of queries.
  const lookups = await loadImportLookups(databasePool);
  const { categoryRows, categoriesByName, locationRows, locationsByName } = lookups;
  const generateSerial = createSerialGenerator('CSV');

  // ── Validate every row before writing anything ──
  const prepared = [];
  const serialsInFile = new Map();
  for (const { rowNum, record } of rows) {
    const problems = [];
    const text = (key) => optionalExcelText(record[key]);
    const date = (key) => {
      const parsed = parseCsvDate(record[key]);
      if (parsed === undefined) problems.push(`${key} "${record[key]}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY, years 1900–2100)`);
      return parsed ?? null;
    };

    const categoryText = text('category');
    const category = categoryText
      && (categoriesByName.get(categoryText.toLowerCase()) || categoriesByName.get(String(importCategoryName(categoryText)).toLowerCase()));
    if (!categoryText) problems.push('category is required');
    else if (!category) problems.push(`category "${categoryText}" does not exist (available: ${categoryRows.map((row) => row.name).join(', ')})`);

    const brand = text('brand');
    const model = text('model');
    const name = text('name') || [brand, model].filter(Boolean).join(' ');
    if (!name) problems.push('name is required when brand and model are empty');

    const costText = text('cost');
    const parsedCost = parseMoneyToCents(record.cost);
    if (parsedCost === undefined) {
      problems.push(`cost "${costText}" is not a valid amount (digits with up to 2 decimals, at most 21474836.47)`);
    }
    const costCents = parsedCost ?? 0;
    const purchaseDate = date('purchase_date');

    const assigneeEmail = text('assigned_to_email');
    const rawSerial = text('serial_number');
    const serialGenerated = !rawSerial || PLACEHOLDER_PATTERN.test(rawSerial);
    const serial = serialGenerated
      ? generateSerial([assigneeEmail, brand, model, category?.name || categoryText, purchaseDate, costCents])
      : rawSerial;
    if (rawSerial && SCIENTIFIC_SERIAL_PATTERN.test(rawSerial)) {
      problems.push(`serial_number "${rawSerial}" looks like Excel scientific notation, so its digits are lost; format the column as Text and re-enter the full serial`);
    }
    if (serialsInFile.has(serial.toLowerCase())) {
      problems.push(`serial_number "${serial}" is repeated in this file (first on row ${serialsInFile.get(serial.toLowerCase())})`);
    } else {
      serialsInFile.set(serial.toLowerCase(), rowNum);
    }

    let assignedTo = null;
    if (assigneeEmail) {
      const employee = lookups.resolveEmployee(assigneeEmail);
      assignedTo = employee?.id || null;
      if (employee?.deleted) problems.push(`assigned_to_email "${assigneeEmail}" belongs to an employee who is no longer active`);
      else if (employee?.ambiguous) problems.push(`assigned_to_email "${assigneeEmail}" matches more than one employee; use their email`);
      else if (!assignedTo) problems.push(`assigned_to_email "${assigneeEmail}" is not an employee (add them on the Employees page first)`);
    }

    const statusText = text('status');
    const status = statusText ? parseCsvStatus(statusText) : (assigneeEmail ? 'in-use' : 'available');
    if (!status) problems.push(`status "${statusText}" must be available, in-use, retired or returned`);
    if (status === 'in-use' && !assigneeEmail) problems.push('status in-use needs assigned_to_email');
    if (status && status !== 'in-use' && assigneeEmail) problems.push(`status ${status} cannot have assigned_to_email; leave it empty or use in-use`);

    const locationText = text('location');
    const location = locationText ? locationsByName.get(locationText.toLowerCase()) : null;
    if (locationText && !location) problems.push(`location "${locationText}" does not exist (available: ${locationRows.map((row) => row.name).join(', ')})`);

    const ownershipText = (text('ownership') || '').toLowerCase();
    const clientName = text('client_name');
    const assetType = ownershipText || (clientName ? 'client' : 'company');
    if (!['company', 'client'].includes(assetType)) problems.push(`ownership "${record.ownership}" must be company or client`);
    if (status === 'returned' && assetType !== 'client') problems.push('status returned is only for client-owned assets (set ownership to client)');

    const assignedDate = date('assigned_date');

    const asset = {
      name,
      categoryId: category?.id,
      serialNumber: serial,
      status,
      assetType,
      assignedTo: status === 'in-use' ? assignedTo : null,
      assignedDate: status === 'in-use' ? assignedDate : null,
      location,
      brand,
      model,
      clientName,
      costCents,
      purchaseDate,
      warrantyExpiryDate: date('warranty_expiry_date'),
      receivedOn: date('received_on'),
      returnDate: date('return_date'),
      vendor: text('vendor'),
      warrantyPlan: text('warranty_plan'),
      warrantyUpgrade: text('warranty_upgrade'),
      processor: text('processor'),
      ram: text('ram'),
      storage: text('storage'),
      screenSize: text('screen_size'),
      graphicsCard: text('graphics_card'),
      os: text('os'),
      msOffice: text('ms_office'),
      antiVirus: text('anti_virus'),
      color: text('color'),
      hardwareType: text('hardware_type'),
      notes: [text('notes'), serialGenerated ? 'No serial number in the CSV; serial generated on import' : null]
        .filter(Boolean).join('\n') || null,
      parentSerial: text('parent_serial'),
    };

    if (problems.length > 0) {
      results.errors.push({ row: rowNum, serial: rawSerial || null, messages: problems });
    } else {
      prepared.push({ rowNum, asset, serialGenerated });
    }
  }

  // Accessories must point at an asset in this file or already in inventory.
  const validSerials = new Set(prepared.map(({ asset }) => asset.serialNumber.toLowerCase()));
  for (let index = prepared.length - 1; index >= 0; index--) {
    const { rowNum, asset } = prepared[index];
    const parentKey = asset.parentSerial?.toLowerCase();
    if (!parentKey || validSerials.has(parentKey) || lookups.assetIdsBySerial.has(parentKey)) continue;
    results.errors.push({ row: rowNum, serial: asset.serialNumber, messages: [`parent_serial "${asset.parentSerial}" is not in this file or in inventory`] });
    prepared.splice(index, 1);
  }
  results.errors.sort((a, b) => a.row - b.row);

  // ── Insert valid rows in one transaction (rolled back for a dry run) ──
  const DRY_RUN_ROLLBACK = Symbol('dry run');
  try {
    await runInTransaction(async (client) => {
      // Existing inventory plus the rows inserted so far.
      const idsBySerial = new Map(lookups.assetIdsBySerial);
      const insertedIds = new Map();

      for (const { rowNum, asset } of prepared) {
        if (idsBySerial.has(asset.serialNumber.toLowerCase())) {
          results.skipped.push({ row: rowNum, serial: asset.serialNumber, reason: 'An asset with this serial number already exists' });
          continue;
        }

        // A database error on one row is reported for that row only.
        const outcome = await withRowSavepoint(client, async () => {
          const { rows: inserted } = await client.query(`
            INSERT INTO assets (
              name, category_id, model, serial_number, status, asset_type, location,
              purchase_date, assigned_to, assigned_date, cost_cents, notes,
              warranty_expiry_date, brand, vendor, processor, ram, storage,
              screen_size, graphics_card, os, ms_office, anti_virus,
              warranty_plan, warranty_upgrade, color, hardware_type,
              client_name, return_date, received_on, created_at, updated_at
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
              $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,NOW(),NOW()
            ) RETURNING id
          `, [
            asset.name, asset.categoryId, asset.model, asset.serialNumber, asset.status, asset.assetType, asset.location,
            asset.purchaseDate, asset.assignedTo, asset.assignedDate, asset.costCents, asset.notes,
            asset.warrantyExpiryDate, asset.brand, asset.vendor, asset.processor, asset.ram, asset.storage,
            asset.screenSize, asset.graphicsCard, asset.os, asset.msOffice, asset.antiVirus,
            asset.warrantyPlan, asset.warrantyUpgrade, asset.color, asset.hardwareType,
            asset.clientName, asset.returnDate, asset.receivedOn,
          ]);
          const assetId = inserted[0].id;

          await logHistoryEvent(assetId, 'created', actorUser, null, 'Imported via CSV upload', null, client);
          if (asset.assignedTo) {
            await logHistoryEvent(assetId, 'assigned', actorUser, asset.assignedTo, 'Assigned via CSV upload', null, client);
          }
          if (asset.status === 'retired') {
            await logHistoryEvent(assetId, 'retired', actorUser, null, 'Retired via CSV upload', null, client);
          }
          return assetId;
        });

        if (!outcome.ok) {
          results.errors.push({ row: rowNum, serial: asset.serialNumber, messages: [`Could not be saved: ${outcome.error.message}`] });
          continue;
        }
        idsBySerial.set(asset.serialNumber.toLowerCase(), outcome.result);
        insertedIds.set(asset.serialNumber.toLowerCase(), outcome.result);
        results.imported++;
        results.importedAssets.push({ row: rowNum, serial: asset.serialNumber, name: asset.name, status: asset.status });
      }

      // Link accessories once every row exists, so a child may come before its parent.
      for (const { rowNum, asset } of prepared) {
        const childId = insertedIds.get(asset.serialNumber.toLowerCase());
        if (!childId || !asset.parentSerial) continue;
        // The parent row may itself have been skipped as an existing serial;
        // parentId then comes from inventory. Never link an asset to itself.
        const parentId = idsBySerial.get(asset.parentSerial.toLowerCase());
        if (!parentId || parentId === childId) continue;
        const outcome = await withRowSavepoint(client, () => (
          client.query('UPDATE assets SET parent_id = $1 WHERE id = $2', [parentId, childId])
        ));
        if (!outcome.ok) {
          results.errors.push({ row: rowNum, serial: asset.serialNumber, messages: [`Imported, but could not be linked to parent ${asset.parentSerial}: ${outcome.error.message}`] });
        }
      }
      results.errors.sort((a, b) => a.row - b.row);

      if (dryRun) throw DRY_RUN_ROLLBACK;
    });
  } catch (err) {
    if (err !== DRY_RUN_ROLLBACK) throw err;
  }

  return results;
};

module.exports = {
  CSV_COLUMNS,
  parseCsvDate,
  parseCsvStatus,
  readCsvRows,
  importAssetsFromCsv,
};
