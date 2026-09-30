const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { pool, withTransaction } = require('../db');
const historyService = require('./historyService');
const {
  optionalExcelText,
  excelNumberToCents,
  importCategoryName,
  findEmployeeIdByImportName,
} = require('./importExportService');

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

const PLACEHOLDER_SERIAL_PATTERN = /^(n\/?a|none|nil|-+)$/i;

// Unlike the legacy Excel sheets, the CSV template takes explicit statuses only.
const parseCsvStatus = (value) => {
  const text = optionalExcelText(value)?.toLowerCase().replace(/[\s_]+/g, '-');
  if (!text) return null;
  if (text === 'in-use' || text === 'inuse' || text === 'assigned') return 'in-use';
  if (text === 'returned' || text === 'returned-to-client') return 'returned';
  return ['available', 'retired'].includes(text) ? text : undefined;
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const normalizeHeader = (value) => String(value ?? '')
  .replace(/^﻿/, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

const toIsoDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }
  return date.toISOString().substring(0, 10);
};

// Accepts 2025-02-17, 17/02/2025, 17-02-2025, 17.02.2025 (day first, as used
// in India) and 17 Feb 2025. Returns null for blank, undefined for invalid.
const parseCsvDate = (value) => {
  const text = optionalExcelText(value);
  if (!text) return null;

  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) return toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));

  match = text.match(/^(\d{1,2})[\s-]+([a-z]{3})[a-z]*[\s-]+(\d{4})$/i);
  if (match) {
    const month = MONTHS.indexOf(match[2].toLowerCase()) + 1;
    if (month > 0) return toIsoDate(Number(match[3]), month, Number(match[1]));
  }
  return undefined;
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
      return;
    }
    if (values.every((value) => !value.trim())) return;
    const record = {};
    headers.forEach((header, index) => { if (header) record[header] = values[index] ?? ''; });
    rows.push({ rowNum, record });
  });
  return { headers: headers || [], rows };
};

// Stable per content, so re-uploading the same file skips these rows as
// duplicates instead of creating them twice.
const generatedSerialFor = (record, rowNum) => {
  const fingerprint = [record.name, record.brand, record.model, record.assigned_to_email, record.category, rowNum]
    .map((value) => String(value || '').trim().toLowerCase())
    .join('|');
  return `NOSN-CSV-${crypto.createHash('sha1').update(fingerprint).digest('hex').substring(0, 8).toUpperCase()}`;
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

  const { rows: categoryRows } = await databasePool.query('SELECT id, name FROM categories');
  const categoriesByName = new Map(categoryRows.map((row) => [row.name.toLowerCase(), row]));
  const { rows: locationRows } = await databasePool.query('SELECT name FROM locations');
  const locationsByName = new Map(locationRows.map((row) => [row.name.toLowerCase(), row.name]));

  // ── Validate every row before writing anything ──
  const prepared = [];
  const serialsInFile = new Map();
  for (const { rowNum, record } of rows) {
    const problems = [];
    const text = (key) => optionalExcelText(record[key]);
    const date = (key) => {
      const parsed = parseCsvDate(record[key]);
      if (parsed === undefined) problems.push(`${key} "${record[key]}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)`);
      return parsed ?? null;
    };

    const categoryText = text('category');
    const category = categoryText
      && (categoriesByName.get(categoryText.toLowerCase()) || categoriesByName.get(String(importCategoryName(categoryText)).toLowerCase()));
    if (!categoryText) problems.push('category is required');
    else if (!category) problems.push(`category "${categoryText}" does not exist (available: ${categoryRows.map((row) => row.name).join(', ')})`);

    const rawSerial = text('serial_number');
    const serialGenerated = !rawSerial || PLACEHOLDER_SERIAL_PATTERN.test(rawSerial);
    const serial = serialGenerated ? generatedSerialFor(record, rowNum) : rawSerial;
    if (serialsInFile.has(serial.toLowerCase())) {
      problems.push(`serial_number "${serial}" is repeated in this file (first on row ${serialsInFile.get(serial.toLowerCase())})`);
    } else {
      serialsInFile.set(serial.toLowerCase(), rowNum);
    }

    const brand = text('brand');
    const model = text('model');
    const name = text('name') || [brand, model].filter(Boolean).join(' ');
    if (!name) problems.push('name is required when brand and model are empty');

    const assigneeEmail = text('assigned_to_email');
    let assignedTo = null;
    if (assigneeEmail) {
      assignedTo = await findEmployeeIdByImportName(databasePool, assigneeEmail);
      if (!assignedTo) problems.push(`assigned_to_email "${assigneeEmail}" is not an employee (add them on the Employees page first)`);
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
    const costText = text('cost');
    const costCents = excelNumberToCents(costText);
    if (costText && costCents === 0 && !/^0+(\.0+)?$/.test(costText.replace(/[₹,\s]/g, ''))) {
      problems.push(`cost "${costText}" is not a number`);
    }

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
      purchaseDate: date('purchase_date'),
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
    if (!asset.parentSerial || validSerials.has(asset.parentSerial.toLowerCase())) continue;
    const { rows: parents } = await databasePool.query(
      'SELECT id FROM assets WHERE LOWER(serial_number) = LOWER($1)', [asset.parentSerial]
    );
    if (parents.length === 0) {
      results.errors.push({ row: rowNum, serial: asset.serialNumber, messages: [`parent_serial "${asset.parentSerial}" is not in this file or in inventory`] });
      prepared.splice(index, 1);
    }
  }
  results.errors.sort((a, b) => a.row - b.row);

  // ── Insert valid rows in one transaction (rolled back for a dry run) ──
  const DRY_RUN_ROLLBACK = Symbol('dry run');
  try {
    await runInTransaction(async (client) => {
      const idsBySerial = new Map();

      for (const { rowNum, asset } of prepared) {
        const exists = await client.query('SELECT id FROM assets WHERE LOWER(serial_number) = LOWER($1)', [asset.serialNumber]);
        if (exists.rows.length > 0) {
          results.skipped.push({ row: rowNum, serial: asset.serialNumber, reason: 'An asset with this serial number already exists' });
          continue;
        }

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
        idsBySerial.set(asset.serialNumber.toLowerCase(), assetId);

        await logHistoryEvent(assetId, 'created', actorUser, null, 'Imported via CSV upload', null, client);
        if (asset.assignedTo) {
          await logHistoryEvent(assetId, 'assigned', actorUser, asset.assignedTo, 'Assigned via CSV upload', null, client);
        }
        if (asset.status === 'retired') {
          await logHistoryEvent(assetId, 'retired', actorUser, null, 'Retired via CSV upload', null, client);
        }

        results.imported++;
        results.importedAssets.push({ row: rowNum, serial: asset.serialNumber, name: asset.name, status: asset.status });
      }

      // Link accessories once every row exists, so a child may come before its parent.
      for (const { asset } of prepared) {
        const childId = idsBySerial.get(asset.serialNumber.toLowerCase());
        if (!childId || !asset.parentSerial) continue;
        let parentId = idsBySerial.get(asset.parentSerial.toLowerCase());
        if (!parentId) {
          const { rows: parents } = await client.query(
            'SELECT id FROM assets WHERE LOWER(serial_number) = LOWER($1)', [asset.parentSerial]
          );
          parentId = parents[0]?.id;
        }
        // The parent row may itself have been skipped as an existing serial;
        // parentId then comes from inventory. Never link an asset to itself.
        if (!parentId || parentId === childId) continue;
        await client.query('UPDATE assets SET parent_id = $1 WHERE id = $2', [parentId, childId]);
      }

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
