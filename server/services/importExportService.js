const ExcelJS = require('exceljs');
const { pool, withTransaction } = require('../db');
const historyService = require('./historyService');

// Convert Excel date (serial, native Date, or string) to YYYY-MM-DD string
const excelDateToISO = (val) => {
  if (!val) return null;
  
  // If ExcelJS parsed it as a native Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().substring(0, 10);
  }
  
  // If it's a formula result containing a Date
  if (typeof val === 'object' && val.result instanceof Date) {
    if (isNaN(val.result.getTime())) return null;
    return val.result.toISOString().substring(0, 10);
  }

  // If it's an Excel serial number (e.g. 44652)
  const num = Number(val);
  if (!isNaN(num)) {
    const ms = (num - 25569) * 86400 * 1000;
    const date = new Date(ms);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().substring(0, 10);
  }
  
  // Try standard string parsing as a fallback
  const strDate = new Date(val.toString());
  if (!isNaN(strDate.getTime())) {
    return strDate.toISOString().substring(0, 10);
  }
  
  return null;
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
const importAssetsFromExcel = async (filePath, actorUser) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const results = { imported: 0, skipped: [], errors: [] };

  // Helper: look up employee ID by name
  const findEmployee = async (name) => {
    if (!name || !name.trim()) return null;
    const { rows } = await pool.query(
      `SELECT id FROM employees WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [name.trim()]
    );
    return rows[0]?.id || null;
  };

  // Helper: look up category ID by name
  const findCategory = async (name) => {
    if (!name) return null;
    const { rows } = await pool.query(
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
      assetData.purchaseDate, assetData.assignedTo, assetData.assignedDate,
      assetData.costCents || 0, assetData.notes,
      assetData.warrantyExpiryDate, assetData.brand, assetData.vendor,
      assetData.processor, assetData.ram, assetData.storage,
      assetData.screenSize, assetData.graphicsCard, assetData.os,
      assetData.msOffice, assetData.antiVirus, assetData.warrantyPlan,
      assetData.warrantyUpgrade, assetData.color, assetData.hardwareType,
      assetData.clientName, assetData.returnDate, assetData.receivedOn,
    ]);

    await historyService.logEvent(
      rows[0].id, 'created', actorUser, assetData.assignedTo,
      'Imported via Excel upload', null, client
    );

    results.imported++;
    return rows[0].id;
  };

  await withTransaction(async (client) => {
    // ── Process Laptops Sheet ──
    const laptopSheet = workbook.getWorksheet('Laptops');
    if (laptopSheet) {
      const rows = [];
      laptopSheet.eachRow((row, rowNum) => { if (rowNum > 1) rows.push(row.values); });
      const laptopCategoryId = await findCategory('Laptop');

      for (const r of rows) {
        const serial = r[4]?.toString()?.trim();
        if (!serial) { results.skipped.push('Row missing serial number (Laptops sheet)'); continue; }

        const employeeId = await findEmployee(r[1]?.toString());

        const assetId = await insertAsset(client, {
          name: `${r[2] || ''} ${r[3] || ''}`.trim() || serial,
          categoryId: laptopCategoryId,
          model: r[3]?.toString() || null,
          serialNumber: serial,
          assetType: 'company',
          assignedTo: employeeId,
          brand: r[2]?.toString() || null,
          purchaseDate: excelDateToISO(r[5]) || r[5]?.toString() || null,
          assignedDate: excelDateToISO(r[6]) || r[6]?.toString() || null,
          processor: r[8]?.toString() || null,
          ram: r[9]?.toString() || null,
          storage: r[10]?.toString() || null,
          screenSize: r[11]?.toString() || null,
          graphicsCard: r[12]?.toString() || null,
          os: r[13]?.toString() || null,
          msOffice: r[14]?.toString() || null,
          antiVirus: r[15]?.toString() || null,
          warrantyPlan: r[16]?.toString() || null,
          costCents: r[17] ? Math.round(Number(r[17]) * 100) : 0,
          notes: r[18]?.toString() || null,
          warrantyExpiryDate: excelDateToISO(r[19]) || r[19]?.toString() || null,
          warrantyUpgrade: r[21]?.toString() || null,
          vendor: r[22]?.toString() || null,
          status: employeeId ? 'in-use' : 'available',
        }, actorUser);

        // Handle Adaptor S/N (column 7) — create linked sub-asset
        const adaptorSerial = r[7]?.toString()?.trim();
        if (assetId && adaptorSerial) {
          const adaptorCategory = await findCategory('Adaptor');
          const adaptorExists = await client.query('SELECT id FROM assets WHERE serial_number = $1', [adaptorSerial]);

          if (adaptorExists.rows.length === 0) {
            const { rows: subRows } = await client.query(`
              INSERT INTO assets (name, category_id, serial_number, status, parent_id, asset_type, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, 'company', NOW(), NOW()) RETURNING id
            `, [`Adaptor for ${serial}`, adaptorCategory, adaptorSerial, 'in-use', assetId]);

            await historyService.logEvent(subRows[0].id, 'created', actorUser, null, `Adaptor linked to laptop ${serial}`, null, client);
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
        const serial = r[6]?.toString()?.trim();
        if (!serial) { results.skipped.push('Row missing serial (Headphones sheet)'); continue; }

        const employeeId = await findEmployee(r[1]?.toString());

        await insertAsset(client, {
          name: `${r[2] || ''} ${r[4] || ''}`.trim() || serial,
          categoryId: catId,
          model: r[4]?.toString() || null,
          serialNumber: serial,
          brand: r[2]?.toString() || null,
          hardwareType: r[3]?.toString() || null,
          color: r[5]?.toString() || null,
          purchaseDate: excelDateToISO(r[7]) || r[7]?.toString() || null,
          warrantyPlan: r[8]?.toString() || null,
          costCents: r[9] ? Math.round(Number(r[9]) * 100) : 0,
          assignedTo: employeeId,
          assignedDate: excelDateToISO(r[10]) || r[10]?.toString() || null,
          returnDate: excelDateToISO(r[11]) || r[11]?.toString() || null,
          status: r[12]?.toString()?.toLowerCase() || (employeeId ? 'in-use' : 'available'),
          vendor: r[13]?.toString() || null,
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
        const serial = r[6]?.toString()?.trim();
        if (!serial) { results.skipped.push('Row missing serial (Keyboard Mouse sheet)'); continue; }

        const catId = await findCategory(r[3]?.toString() || 'Keyboard');
        const employeeId = await findEmployee(r[1]?.toString());

        await insertAsset(client, {
          name: `${r[4] || ''} ${r[5] || ''}`.trim() || serial,
          categoryId: catId,
          model: r[5]?.toString() || null,
          serialNumber: serial,
          assignedDate: excelDateToISO(r[2]) || r[2]?.toString() || null,
          hardwareType: r[3]?.toString() || null,
          brand: r[4]?.toString() || null,
          purchaseDate: excelDateToISO(r[7]) || r[7]?.toString() || null,
          warrantyPlan: r[8]?.toString() || null,
          costCents: r[9] ? Math.round(Number(r[9]) * 100) : 0,
          notes: r[10]?.toString() || null,
          vendor: r[11]?.toString() || null,
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
        const serial = r[5]?.toString()?.trim();
        if (!serial) { results.skipped.push('Row missing serial (Client Laptops sheet)'); continue; }

        const employeeId = await findEmployee(r[1]?.toString());

        await insertAsset(client, {
          name: `${r[2] || ''} ${r[4] || ''}`.trim() || serial,
          categoryId: catId,
          model: r[4]?.toString() || null,
          serialNumber: serial,
          brand: r[2]?.toString() || null,
          hardwareType: r[3]?.toString() || null,
          status: r[6]?.toString()?.toLowerCase() || 'available',
          receivedOn: excelDateToISO(r[7]) || r[7]?.toString() || null,
          returnDate: excelDateToISO(r[8]) || r[8]?.toString() || null,
          clientName: r[9]?.toString() || null,
          notes: r[10]?.toString() || null,
          assignedTo: employeeId,
          assetType: 'client',
        }, actorUser);
      }
    }
  });

  return results;
};

module.exports = { exportAssetsToExcel, importAssetsFromExcel };
