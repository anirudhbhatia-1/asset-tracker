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
  niteshkumarkumawat: 'nitesh.kumawat@thinkvibes.com',
});

const findEmployeeIdByImportName = async (databasePool, value) => {
  const normalizedName = normalizeEmployeeImportName(value);
  if (!normalizedName) return null;

  const emailAlias = EMPLOYEE_IMPORT_EMAIL_ALIASES[normalizedName];
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
    const err = new Error(`Multiple active employees match imported name: ${optionalExcelText(value)}`);
    err.statusCode = 409;
    throw err;
  }
  return rows[0]?.id || null;
};

// ────────────────────────────────────────────
// EXPORT — Generate .xlsx file with 4 sheets
// ────────────────────────────────────────────
const exportAssetsToExcel = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AssetTrack';
  workbook.created = new Date();

  // Fetch all assets with full joins
  const { rows: assets } = await pool.query(`
    SELECT a.*,
           c.name AS category_name,
           e.name AS assignee_name,
           adaptor.serial_number AS adaptor_serial_number
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN employees e ON a.assigned_to = e.id
    LEFT JOIN assets adaptor ON adaptor.parent_id = a.id
    WHERE a.parent_id IS NULL
    ORDER BY a.category_id, a.id
  `);

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
    'Issued To','Brand','Model','Serial Number','Date of Invoice','Date of Issue',
    'Adaptor S/N','Processor','RAM','HDD','Screen Size','Graphics Card','OS',
    'MS Office','Anti-Virus','Service/Warranty','Purchase Price','Comments',
    'Warranty Last Date','Remaining Days','Warranty Upgrade','Vendor'
  ]);
  const laptops = assets.filter(a => a.category_name?.toLowerCase() === 'laptop');
  for (const a of laptops) {
    laptopSheet.addRow([
      a.assignee_name || '',
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
    'Issued To','Brand','Type','Model','Color','Serial Number',
    'Date of Invoice','Service/Warranty','Purchase Price',
    'Issue Date','Return Date','Status','Vendor'
  ]);
  const headphones = assets.filter(a => a.category_name?.toLowerCase() === 'headphones' || a.category_name?.toLowerCase() === 'headphone');
  for (const a of headphones) {
    headphoneSheet.addRow([
      a.assignee_name || '', a.brand || '', a.hardware_type || '',
      a.model || '', a.color || '', a.serial_number,
      a.purchase_date || '', a.warranty_plan || '',
      a.cost_cents ? a.cost_cents / 100 : '',
      a.assigned_date || '', a.return_date || '', a.status, a.vendor || ''
    ]);
  }

  // ── Sheet 3: Keyboard / Mouse ──
  const kbSheet = workbook.addWorksheet('Keyboard Mouse');
  kbSheet.addRow([
    'Issued To','Date of Issue','Hardware Type','Brand','Model',
    'Serial Number','Date of Invoice','Service/Warranty',
    'Purchase Price','Comments','Vendor Name'
  ]);
  const keyboards = assets.filter(a =>
    a.category_name?.toLowerCase().includes('keyboard') ||
    a.category_name?.toLowerCase().includes('mouse')
  );
  for (const a of keyboards) {
    kbSheet.addRow([
      a.assignee_name || '', a.assigned_date || '',
      a.category_name || '', a.brand || '', a.model || '',
      a.serial_number, a.purchase_date || '',
      a.warranty_plan || '', a.cost_cents ? a.cost_cents / 100 : '',
      a.notes || '', a.vendor || ''
    ]);
  }

  // ── Sheet 4: Client Laptops ──
  const clientSheet = workbook.addWorksheet('Client Laptops');
  clientSheet.addRow([
    'Issued To','Brand','Type','Model','Serial Number',
    'Status','Received On','Returned On','Client Name','Comments'
  ]);
  const clientLaptops = assets.filter(a => a.asset_type === 'client');
  for (const a of clientLaptops) {
    clientSheet.addRow([
      a.assignee_name || '', a.brand || '', a.hardware_type || '',
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
const importAssetsFromExcel = async (filePath, actorUser, dependencies = {}) => {
  const databasePool = dependencies.pool || pool;
  const runInTransaction = dependencies.withTransaction || withTransaction;
  const logHistoryEvent = dependencies.logEvent || historyService.logEvent;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const results = { imported: 0, skipped: [], errors: [] };

  const findEmployee = (name) => findEmployeeIdByImportName(databasePool, name);

  const shouldSkipMissingEmployee = (issuedTo, employeeId, serial, sheetName) => {
    if (!issuedTo || employeeId) return false;
    results.skipped.push(`Employee not found: ${issuedTo} (${sheetName}, serial ${serial})`);
    return true;
  };

  // Helper: look up category ID by name
  const findCategory = async (name) => {
    if (!name) return null;
    const { rows } = await databasePool.query(
      `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [name.trim()]
    );
    return rows[0]?.id || null;
  };

  // Helper: insert one asset row
  const insertAsset = async (client, assetData, actorUser) => {
    // Check for duplicate serial
    const exists = await client.query(
      'SELECT id FROM assets WHERE serial_number = $1', [assetData.serialNumber]
    );
    if (exists.rows.length > 0) {
      results.skipped.push(`Duplicate serial: ${assetData.serialNumber}`);
      return null;
    }

    const { rows } = await client.query(`
      INSERT INTO assets (
        name, category_id, model, serial_number, status, asset_type,
        purchase_date, assigned_to, assigned_date, cost_cents, notes,
        warranty_expiry_date, brand, vendor, processor, ram, storage,
        screen_size, graphics_card, os, ms_office, anti_virus,
        warranty_plan, warranty_upgrade, color, hardware_type,
        client_name, return_date, received_on, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,NOW(),NOW()
      ) RETURNING id
    `, [
      assetData.name, assetData.categoryId, assetData.model,
      assetData.serialNumber, assetData.status || 'in-use',
      assetData.assetType || 'company',
      assetData.purchaseDate ?? null, assetData.assignedTo ?? null, assetData.assignedDate ?? null,
      assetData.costCents ?? 0, assetData.notes ?? null,
      assetData.warrantyExpiryDate ?? null, assetData.brand ?? null, assetData.vendor ?? null,
      assetData.processor ?? null, assetData.ram ?? null, assetData.storage ?? null,
      assetData.screenSize ?? null, assetData.graphicsCard ?? null, assetData.os ?? null,
      assetData.msOffice ?? null, assetData.antiVirus ?? null, assetData.warrantyPlan ?? null,
      assetData.warrantyUpgrade ?? null, assetData.color ?? null, assetData.hardwareType ?? null,
      assetData.clientName ?? null, assetData.returnDate ?? null, assetData.receivedOn ?? null,
    ]);

    await logHistoryEvent(
      rows[0].id, 'created', actorUser, assetData.assignedTo,
      'Imported via Excel upload', null, client
    );

    results.imported++;
    return rows[0].id;
  };

  await runInTransaction(async (client) => {
    // ── Process Laptops Sheet ──
    const laptopSheet = workbook.getWorksheet('Laptops');
    if (laptopSheet) {
      const rows = [];
      laptopSheet.eachRow((row, rowNum) => { if (rowNum > 1) rows.push(row.values); });
      const laptopCategoryId = await findCategory('Laptop');

      for (const r of rows) {
        const serial = optionalExcelText(r[4]);
        if (!serial) { results.skipped.push('Row missing serial number (Laptops sheet)'); continue; }

        const issuedTo = optionalExcelText(r[1]);
        const brand = optionalExcelText(r[2]);
        const model = optionalExcelText(r[3]);
        const employeeId = await findEmployee(issuedTo);
        if (shouldSkipMissingEmployee(issuedTo, employeeId, serial, 'Laptops')) continue;

        const assetId = await insertAsset(client, {
          name: `${brand || ''} ${model || ''}`.trim() || serial,
          categoryId: laptopCategoryId,
          model,
          serialNumber: serial,
          assetType: 'company',
          assignedTo: employeeId,
          brand,
          purchaseDate: excelDateToISO(r[5]),
          assignedDate: excelDateToISO(r[6]),
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
          notes: optionalExcelText(r[18]),
          warrantyExpiryDate: excelDateToISO(r[19]),
          warrantyUpgrade: optionalExcelText(r[21]),
          vendor: optionalExcelText(r[22]),
          status: employeeId ? 'in-use' : 'available',
        }, actorUser);

        // Handle Adaptor S/N (column 7) — create linked sub-asset
        const adaptorSerial = optionalExcelText(r[7]);
        if (assetId && adaptorSerial) {
          const adaptorCategory = await findCategory('Adaptor');
          const adaptorExists = await client.query('SELECT id FROM assets WHERE serial_number = $1', [adaptorSerial]);

          if (adaptorExists.rows.length === 0) {
            const { rows: subRows } = await client.query(`
              INSERT INTO assets (name, category_id, serial_number, status, parent_id, asset_type, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, 'company', NOW(), NOW()) RETURNING id
            `, [`Adaptor for ${serial}`, adaptorCategory, adaptorSerial, 'in-use', assetId]);

            await logHistoryEvent(subRows[0].id, 'created', actorUser, null, `Adaptor linked to laptop ${serial}`, null, client);
          }
        }
      }
    }

    // ── Process Headphones Sheet ──
    const headphoneSheet = workbook.getWorksheet('Headphones');
    if (headphoneSheet) {
      const rows = [];
      headphoneSheet.eachRow((row, rowNum) => { if (rowNum > 1) rows.push(row.values); });
      const catId = await findCategory('Headphones');

      for (const r of rows) {
        const serial = optionalExcelText(r[6]);
        if (!serial) { results.skipped.push('Row missing serial (Headphones sheet)'); continue; }

        const issuedTo = optionalExcelText(r[1]);
        const brand = optionalExcelText(r[2]);
        const model = optionalExcelText(r[4]);
        const employeeId = await findEmployee(issuedTo);
        if (shouldSkipMissingEmployee(issuedTo, employeeId, serial, 'Headphones')) continue;

        await insertAsset(client, {
          name: `${brand || ''} ${model || ''}`.trim() || serial,
          categoryId: catId,
          model,
          serialNumber: serial,
          brand,
          hardwareType: optionalExcelText(r[3]),
          color: optionalExcelText(r[5]),
          purchaseDate: excelDateToISO(r[7]),
          warrantyPlan: optionalExcelText(r[8]),
          costCents: excelNumberToCents(r[9]),
          assignedTo: employeeId,
          assignedDate: excelDateToISO(r[10]),
          returnDate: excelDateToISO(r[11]),
          status: normalizeAssetStatus(r[12], employeeId ? 'in-use' : 'available'),
          vendor: optionalExcelText(r[13]),
          assetType: 'company',
        }, actorUser);
      }
    }

    // ── Process Keyboard Mouse Sheet ──
    const kbSheet = workbook.getWorksheet('Keyboard Mouse');
    if (kbSheet) {
      const rows = [];
      kbSheet.eachRow((row, rowNum) => { if (rowNum > 1) rows.push(row.values); });

      for (const r of rows) {
        const serial = optionalExcelText(r[6]);
        if (!serial) { results.skipped.push('Row missing serial (Keyboard Mouse sheet)'); continue; }

        const hardwareType = optionalExcelText(r[3]);
        const brand = optionalExcelText(r[4]);
        const model = optionalExcelText(r[5]);
        const catId = await findCategory(hardwareType || 'Keyboard');
        const issuedTo = optionalExcelText(r[1]);
        const employeeId = await findEmployee(issuedTo);
        if (shouldSkipMissingEmployee(issuedTo, employeeId, serial, 'Keyboard Mouse')) continue;

        await insertAsset(client, {
          name: `${brand || ''} ${model || ''}`.trim() || serial,
          categoryId: catId,
          model,
          serialNumber: serial,
          assignedDate: excelDateToISO(r[2]),
          hardwareType,
          brand,
          purchaseDate: excelDateToISO(r[7]),
          warrantyPlan: optionalExcelText(r[8]),
          costCents: excelNumberToCents(r[9]),
          notes: optionalExcelText(r[10]),
          vendor: optionalExcelText(r[11]),
          assignedTo: employeeId,
          status: employeeId ? 'in-use' : 'available',
          assetType: 'company',
        }, actorUser);
      }
    }

    // ── Process Client Laptops Sheet ──
    const clientSheet = workbook.getWorksheet('Client Laptops');
    if (clientSheet) {
      const rows = [];
      clientSheet.eachRow((row, rowNum) => { if (rowNum > 1) rows.push(row.values); });
      const catId = await findCategory('Laptop');

      for (const r of rows) {
        const serial = optionalExcelText(r[5]);
        if (!serial) { results.skipped.push('Row missing serial (Client Laptops sheet)'); continue; }

        const brand = optionalExcelText(r[2]);
        const model = optionalExcelText(r[4]);
        const issuedTo = optionalExcelText(r[1]);
        const employeeId = await findEmployee(issuedTo);
        if (shouldSkipMissingEmployee(issuedTo, employeeId, serial, 'Client Laptops')) continue;

        await insertAsset(client, {
          name: `${brand || ''} ${model || ''}`.trim() || serial,
          categoryId: catId,
          model,
          serialNumber: serial,
          brand,
          hardwareType: optionalExcelText(r[3]),
          status: normalizeAssetStatus(r[6], 'available'),
          receivedOn: excelDateToISO(r[7]),
          returnDate: excelDateToISO(r[8]),
          clientName: optionalExcelText(r[9]),
          notes: optionalExcelText(r[10]),
          assignedTo: employeeId,
          assetType: 'client',
        }, actorUser);
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
};
