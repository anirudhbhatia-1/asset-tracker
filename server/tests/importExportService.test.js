import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  excelDateToISO,
  excelNumberToCents,
  normalizeAssetStatus,
  optionalExcelText,
  normalizeEmployeeImportName,
  findEmployeeIdByImportName,
  exportAssetsToExcel,
  importAssetsFromExcel,
  importCategoryName,
  parseLifecycleText,
  parseStatusKeyword,
  groupRowsIntoItems,
} from '../services/importExportService';
import { parseMoneyToCents, parseImportDate, normalizeHeader } from '../services/importHelpers';
import { createImportTestDb, STANDARD_CATEGORIES } from './importTestDb';

const temporaryFiles = [];

afterEach(async () => {
  await Promise.all(temporaryFiles.splice(0).map((file) => rm(file, { force: true })));
});

// Legacy workbook layouts, exactly as the real "Assets and Appliances" sheet
// spells them (including "Vender" and "Recieved on").
const LAPTOP_HEADERS = [
  'Issued To', 'Brand', 'Model', 'Serial Number', 'Date of Invoice', 'Date of Issue', 'Adaptor S/N',
  'Processor', 'RAM', 'HDD', 'Screen Size', 'Graphics Card', 'OS', 'MS Office', 'Anti-Virus',
  'Service/Warranty', 'Purchase Price', 'Comments', 'Warranty Last Date', 'Remaining Days',
  'Warranty Upgrade', 'Vendor',
];
const HEADPHONE_HEADERS = [
  'Issued To', 'Brand', 'Type', 'Model', 'Color', 'Serial Number', 'Date of Invoice',
  'Service/Warranty', 'Purchase Price', 'Issue Date', 'Return Date', 'Status', 'Vender',
];
const KEYBOARD_HEADERS = [
  'Issued To', 'Date of Issue', 'Hardware Type', 'Brand', 'Model', 'Serial Number',
  'Date of Invoice', 'Service / Warranty', 'Purchase Price', 'Comments', 'Vender Name',
];
const CLIENT_HEADERS = [
  'Issued To', 'Brand', 'Type', 'Model', 'Serial Number', 'Status', 'Recieved on',
  'Returned on', 'Client Name', 'Comments',
];

// Builds a row array from { header: value } so tests don't depend on positions.
const rowFor = (headers, values) => headers.map((header) => (header in values ? values[header] : null));

let fileCounter = 0;
const saveWorkbook = async (workbook) => {
  const filePath = join(tmpdir(), `asset-import-${process.pid}-${Date.now()}-${fileCounter++}.xlsx`);
  temporaryFiles.push(filePath);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

// sheets: { 'Sheet name': [headers, ...rows] }
const writeWorkbook = async (sheets) => {
  const workbook = new ExcelJS.Workbook();
  for (const [name, [headers, ...rows]] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    for (const row of rows) sheet.addRow(Array.isArray(row) ? row : rowFor(headers, row));
  }
  return saveWorkbook(workbook);
};

const testDb = (options = {}) => createImportTestDb({
  categories: STANDARD_CATEGORIES,
  locations: ['Bangalore', 'Mumbai'],
  employees: [
    { id: 1, name: 'A Person', email: 'a@x.com', deleted_at: null },
    { id: 2, name: 'B Person', email: 'b@x.com', deleted_at: null },
    { id: 3, name: 'Gone Person', email: 'gone@x.com', deleted_at: '2026-01-01T00:00:00Z' },
  ],
  ...options,
});

describe('Excel import value normalization', () => {
  it.each([0, '0', ' 0 ', '', '   ', null, undefined, { formula: 'A1', result: 0 }])(
    'treats a zero or empty date (%s) as null',
    (value) => {
      expect(excelDateToISO(value)).toBeNull();
    },
  );

  it('keeps valid Excel and native dates', () => {
    expect(excelDateToISO(new Date('2026-08-25T00:00:00.000Z'))).toBe('2026-08-25');
    expect(excelDateToISO(46259)).toBe('2026-08-25');
  });

  it.each([0, '0', '', null, undefined, 'not a price'])('defaults an empty or invalid price (%s) to zero', (value) => {
    expect(excelNumberToCents(value)).toBe(0);
  });

  it('converts a formatted purchase price to cents', () => {
    expect(excelNumberToCents('1,234.50')).toBe(123450);
  });

  it('defaults empty, zero, and invalid statuses while accepting common in-use spellings', () => {
    expect(normalizeAssetStatus(0, 'available')).toBe('available');
    expect(normalizeAssetStatus('', 'in-use')).toBe('in-use');
    expect(normalizeAssetStatus('unknown', 'available')).toBe('available');
    expect(normalizeAssetStatus('IN USE', 'available')).toBe('in-use');
    expect(normalizeAssetStatus('assigned', 'available')).toBe('in-use');
  });

  it('treats zero and blank optional text as empty', () => {
    expect(optionalExcelText(0)).toBeNull();
    expect(optionalExcelText('')).toBeNull();
    expect(optionalExcelText(' Dell ')).toBe('Dell');
  });

  it('unwraps rich text, hyperlinks and formula results', () => {
    expect(optionalExcelText({ richText: [{ text: ' Dell' }, { text: ' Inc. ' }] })).toBe('Dell Inc.');
    expect(optionalExcelText({ formula: 'A1', result: 0 })).toBeNull();
    expect(optionalExcelText({ text: 'a@x.com', hyperlink: 'mailto:a@x.com' })).toBe('a@x.com');
    expect(optionalExcelText({ sharedFormula: 'T2' })).toBeNull();
  });

  it.each([
    ['Lakshya Soni / Intern', 'lakshyasoni'],
    ['Arun Kumar Soni', 'arunkumarsoni'],
    ['Gunwant Singh Hada / Intern', 'gunwantsinghhada'],
    [0, ''],
  ])('normalizes imported employee names safely (%s)', (input, expected) => {
    expect(normalizeEmployeeImportName(input)).toBe(expected);
  });

  it('resolves normalized names and verified email aliases from import forms', async () => {
    const databasePool = { query: vi.fn().mockResolvedValue({ rows: [{ id: 120 }] }) };

    await expect(findEmployeeIdByImportName(databasePool, 'Lakshya Soni / Intern')).resolves.toBe(120);
    expect(databasePool.query.mock.calls[0][1]).toEqual(['lakshyasoni']);

    await expect(findEmployeeIdByImportName(databasePool, 'Nitesh Kumar Kumawat')).resolves.toBe(120);
    expect(databasePool.query.mock.calls[1][1]).toEqual(['nitesh.kumawat@thinkvibes.com']);

    const aliases = [
      ['Deebandhu Ghosh', 'deebandu.ghosh@thinkvibes.com'],
      ['Lalit Vitthalrao Umap', 'lalit.umap@thinkvibes.com'],
      ['Lalit Umpa', 'lalit.umap@thinkvibes.com'],
      ['Smita Pandy', 'smita@thinkvibes.com'],
    ];
    for (const [name, email] of aliases) {
      await expect(findEmployeeIdByImportName(databasePool, name)).resolves.toBe(120);
      expect(databasePool.query.mock.lastCall[1]).toEqual([email]);
    }
  });

  it('uses a supplied email as the primary case-insensitive employee identifier', async () => {
    const databasePool = { query: vi.fn().mockResolvedValue({ rows: [{ id: 87 }] }) };

    await expect(findEmployeeIdByImportName(databasePool, ' Amit@Thinkvibes.com ')).resolves.toBe(87);

    expect(databasePool.query.mock.calls[0][0]).toContain('LOWER(email)');
    expect(databasePool.query.mock.calls[0][1]).toEqual(['amit@thinkvibes.com']);
  });

  it('does not guess missing or ambiguous employee mappings', async () => {
    await expect(findEmployeeIdByImportName(
      { query: vi.fn().mockResolvedValue({ rows: [] }) },
      'Abhay Deewan',
    )).resolves.toBeNull();

    await expect(findEmployeeIdByImportName(
      { query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] }) },
      'Duplicate Name',
    )).rejects.toMatchObject({ statusCode: 409 });
  });

  it('turns invalid date strings and invalid native dates into null', () => {
    expect(excelDateToISO('not a date')).toBeNull();
    expect(excelDateToISO(new Date('invalid'))).toBeNull();
  });
});

describe('Strict money and date parsing (fuzz cases)', () => {
  it.each([
    ['Rs. 500', 50000],
    ['rs 500', 50000],
    ['₹1,234.50', 123450],
    ['INR 99', 9900],
    ['82,950', 8295000],
    ['12510.99', 1251099],
    ['500/-', 50000],
    ['21474836.47', 2147483647],
    [12510.99, 1251099],
    [0, 0],
    ['0', 0],
    ['Free', 0],
  ])('accepts %j as %i paise', (value, cents) => {
    expect(parseMoneyToCents(value)).toBe(cents);
  });

  it.each(['1e3', '1.234,50', '-500', '99999999', '21474836.48', '12.345', 'abc', '5 00x', -5, 1e12])(
    'rejects %j',
    (value) => {
      expect(parseMoneyToCents(value)).toBeUndefined();
    },
  );

  it.each(['', '  ', null, 'N/A', '-'])('treats %j as no price', (value) => {
    expect(parseMoneyToCents(value)).toBeNull();
  });

  it('reads day-first strings, serials and native date cells within 1900–2100', () => {
    expect(parseImportDate('05/02/2025')).toBe('2025-02-05');
    expect(parseImportDate('2025-02-17')).toBe('2025-02-17');
    expect(parseImportDate('17 Feb 2025')).toBe('2025-02-17');
    expect(parseImportDate(46259)).toBe('2026-08-25');
    expect(parseImportDate(46259.75)).toBe('2026-08-25');
    expect(parseImportDate(new Date(Date.UTC(2029, 5, 14)))).toBe('2029-06-14');
  });

  it.each(['31/02/2025', '02/31/2025', '1899-12-31', '2101-01-01', 'next week', 3000000, -1, new Date('invalid')])(
    'rejects the date %j',
    (value) => {
      expect(parseImportDate(value)).toBeUndefined();
    },
  );

  it('normalizes legacy header spellings to snake_case keys', () => {
    expect(normalizeHeader('Adaptor S/N')).toBe('adaptor_s_n');
    expect(normalizeHeader('Service / Warranty')).toBe('service_warranty');
    expect(normalizeHeader(' Issued To Email ')).toBe('issued_to_email');
  });
});

describe('Excel export', () => {
  it('exports assignee emails as the first column on every supported sheet', async () => {
    const databasePool = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          id: 1,
          category_name: 'Laptop',
          asset_type: 'company',
          assignee_name: 'Amit Jain',
          assignee_email: 'amit@thinkvibes.com',
          serial_number: 'LAP-EMAIL',
          status: 'in-use',
        }],
      }),
    };

    const workbook = await exportAssetsToExcel({ pool: databasePool });

    expect(databasePool.query.mock.calls[0][0]).toContain('e.email AS assignee_email');
    expect(databasePool.query.mock.calls[0][0]).not.toContain('LIMIT 1');
    for (const sheetName of ['Laptops', 'Headphones', 'Keyboard Mouse', 'Client Laptops']) {
      const headers = workbook.getWorksheet(sheetName).getRow(1).values.slice(1);
      expect(headers[0]).toBe('Issued To Email');
      expect(headers).toEqual(expect.arrayContaining(['Status', 'Category', 'Location', 'Parent Serial']));
    }
    expect(workbook.getWorksheet('Laptops').getCell(2, 1).value).toBe('amit@thinkvibes.com');
  });

  it('puts every exported asset, children included, on exactly one sheet', async () => {
    const asset = (id, serial, categoryName, extra = {}) => ({
      id, serial_number: serial, category_name: categoryName, asset_type: 'company', status: 'available', ...extra,
    });
    const databasePool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          asset(1, 'LAP-1', 'Laptop'),
          asset(2, 'ADP-1', 'Adaptor', { parent_id: 1, parent_serial_number: 'LAP-1' }),
          asset(3, 'HEAD-1', 'Audio & Headset', { hardware_type: 'Headphone' }),
          asset(4, 'MOUSE-1', 'Keyboard & Mouse', { hardware_type: 'Wireless Mouse' }),
          asset(5, 'MON-1', 'Monitor'),
          asset(6, 'STAND-1', 'Laptop Stand'),
          asset(7, 'CL-1', 'Laptop', { asset_type: 'client', hardware_type: 'Laptop' }),
        ],
      }),
    };

    const workbook = await exportAssetsToExcel({ pool: databasePool });
    const serialsOn = (sheetName, column) => {
      const serials = [];
      workbook.getWorksheet(sheetName).eachRow((row, rowNum) => { if (rowNum > 1) serials.push(row.getCell(column).value); });
      return serials;
    };

    expect(serialsOn('Laptops', 4)).toEqual(['LAP-1']);
    // Legacy column still names a laptop's single adaptor…
    expect(workbook.getWorksheet('Laptops').getCell(2, 7).value).toBe('ADP-1');
    expect(serialsOn('Headphones', 6)).toEqual(['HEAD-1']);
    // …and the adaptor also has its own row with its parent.
    expect(serialsOn('Keyboard Mouse', 6)).toEqual(['ADP-1', 'MOUSE-1', 'MON-1', 'STAND-1']);
    expect(workbook.getWorksheet('Keyboard Mouse').getCell(2, 15).value).toBe('LAP-1');
    expect(workbook.getWorksheet('Keyboard Mouse').getCell(3, 3).value).toBe('Wireless Mouse');
    expect(serialsOn('Client Laptops', 5)).toEqual(['CL-1']);
  });
});

describe('Excel import: header mapping', () => {
  it('maps reordered, extra and legacy-spelled columns by header name', async () => {
    const laptopHeaders = ['Notes For Me', 'Serial Number', 'Vender Name', 'Model', 'Issued To', 'Brand', 'Purchase Price', 'Date of Invoice'];
    const clientHeaders = ['Client Name', 'Serial Number', 'Recieved on', 'Issued To', 'Brand', 'Status'];
    const filePath = await writeWorkbook({
      Laptops: [laptopHeaders, { 'Notes For Me': 'ignored', 'Serial Number': 'LAP-R', 'Vender Name': 'Swastik', Model: 'IdeaPad', 'Issued To': 'a@x.com', Brand: 'Lenovo', 'Purchase Price': 61900, 'Date of Invoice': new Date(Date.UTC(2025, 1, 17)) }],
      'Client Laptops': [clientHeaders, { 'Client Name': 'Salesforce', 'Serial Number': 'CL-R', 'Recieved on': '08/09/2023', 'Issued To': 'b@x.com', Brand: 'HP', Status: 'In-use' }],
    });
    const db = testDb();

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.errors).toEqual([]);
    expect(db.bySerial('LAP-R')).toMatchObject({
      vendor: 'Swastik', model: 'IdeaPad', brand: 'Lenovo', assigned_to: 1, cost_cents: 6190000, purchase_date: '2025-02-17', status: 'in-use',
    });
    expect(db.bySerial('CL-R')).toMatchObject({
      client_name: 'Salesforce', received_on: '2023-09-08', assigned_date: '2023-09-08', assigned_to: 2, asset_type: 'client', status: 'in-use',
    });
  });

  it('rejects the whole file with 400 when a present sheet lacks required headers', async () => {
    const filePath = await writeWorkbook({
      Laptops: [['Brand', 'Model'], ['Dell', 'Latitude']],
      Headphones: [['Serial Number', 'Color'], ['HP-1', 'Black']],
      'Keyboard Mouse': [KEYBOARD_HEADERS],
    });
    const db = testDb();

    const error = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies).catch((err) => err);

    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('Laptops: Serial Number');
    expect(error.message).toContain('Headphones: one of Issued To, Brand, Model');
    expect(error.message).not.toContain('Keyboard Mouse');
    expect(db.state.assets).toEqual([]);
  });

  it('rejects a workbook with none of the expected sheets', async () => {
    const filePath = await writeWorkbook({ Sheet1: [['a'], ['b']] });
    await expect(importAssetsFromExcel(filePath, { id: 1 }, testDb().dependencies)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Excel import: rows', () => {
  it('imports an unknown or departed holder as available with a warning instead of skipping', async () => {
    const filePath = await writeWorkbook({
      Laptops: [LAPTOP_HEADERS,
        { 'Issued To': 'Abhay Deewan', Brand: 'Dell', Model: 'Latitude', 'Serial Number': 'LAP-UNMAPPED' },
        { 'Issued To': 'gone@x.com', Brand: 'Dell', Model: 'Latitude', 'Serial Number': 'LAP-GONE' },
      ],
    });
    const db = testDb();

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.imported).toBe(2);
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([
      'Employee not found: Abhay Deewan (Laptops, serial LAP-UNMAPPED); imported as available',
      'Employee gone@x.com is no longer active (Laptops, serial LAP-GONE); imported as available',
    ]);
    expect(db.bySerial('LAP-UNMAPPED')).toMatchObject({ status: 'available', assigned_to: null });
    expect(db.bySerial('LAP-GONE').notes).toContain('Previously held by gone@x.com');
  });

  it('maps zero and empty cells to safe insert values across every supported sheet', async () => {
    const zeros = (headers, values) => headers.map((header) => (header in values ? values[header] : 0));
    const filePath = await writeWorkbook({
      Laptops: [LAPTOP_HEADERS, zeros(LAPTOP_HEADERS, { 'Serial Number': 'LAP-ZERO' })],
      Headphones: [HEADPHONE_HEADERS, zeros(HEADPHONE_HEADERS, { 'Serial Number': 'HEAD-ZERO' })],
      'Keyboard Mouse': [KEYBOARD_HEADERS, zeros(KEYBOARD_HEADERS, { 'Serial Number': 'KEY-ZERO' })],
      'Client Laptops': [CLIENT_HEADERS, zeros(CLIENT_HEADERS, { 'Serial Number': 'CLIENT-ZERO' })],
    });
    const db = testDb();

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.imported).toBe(4);
    expect(result.errors).toEqual([]);
    for (const asset of db.state.assets) {
      expect(asset).toMatchObject({
        purchase_date: null, assigned_date: null, cost_cents: 0, notes: null,
        warranty_expiry_date: null, return_date: null, received_on: null,
      });
    }
  });

  it('skips missing and duplicate serials while creating only new adaptors', async () => {
    const laptop = (serial, adaptorSerial) => ({ Brand: 'Dell', 'Serial Number': serial, 'Adaptor S/N': adaptorSerial });
    const filePath = await writeWorkbook({
      Laptops: [LAPTOP_HEADERS,
        LAPTOP_HEADERS.map(() => 0),
        laptop('LAP-DUP', 0),
        laptop('LAP-NEW', 'ADAPTOR-NEW'),
        laptop('LAP-EXISTING-ADAPTOR', 'ADAPTOR-DUP'),
      ],
    });
    const db = testDb({ assets: [{ serial_number: 'LAP-DUP' }, { serial_number: 'adaptor-dup' }] });

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    // Two laptops plus the one new adaptor, which is an asset in its own right.
    expect(result.imported).toBe(3);
    expect(result.skipped).toEqual([
      'Row missing serial (Laptops sheet, row 2)',
      'Duplicate serial: LAP-DUP',
      'Duplicate serial: ADAPTOR-DUP',
    ]);
    expect(db.state.assets.map((asset) => asset.serial_number)).toEqual(
      expect.arrayContaining(['LAP-NEW', 'ADAPTOR-NEW', 'LAP-EXISTING-ADAPTOR']),
    );
    expect(db.bySerial('ADAPTOR-NEW').parent_id).toBe(db.bySerial('LAP-NEW').id);
  });

  it('reports a failing row insert for that row only and keeps the rest', async () => {
    const filePath = await writeWorkbook({
      Laptops: [LAPTOP_HEADERS,
        { Brand: 'Dell', 'Serial Number': 'LAP-OK-1' },
        { Brand: 'Dell', 'Serial Number': 'LAP-BAD' },
        { Brand: 'Dell', 'Serial Number': 'LAP-OK-2' },
      ],
    });
    const db = testDb({ failInsertFor: ['LAP-BAD'] });

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.imported).toBe(2);
    expect(result.errors).toEqual([{
      row: 3, sheet: 'Laptops', serial: 'LAP-BAD', messages: ['Could not be saved: simulated failure for LAP-BAD'],
    }]);
    expect(db.state.outcome).toBe('committed');
    expect(db.state.assets.map((asset) => asset.serial_number)).toEqual(['LAP-OK-1', 'LAP-OK-2']);
  });

  it('reports invalid values per row with the original text, never aborting the file', async () => {
    const filePath = await writeWorkbook({
      'Keyboard Mouse': [KEYBOARD_HEADERS,
        { Brand: 'Dell', 'Serial Number': 'KM-BAD', 'Purchase Price': '1.234,50', 'Date of Invoice': '31/02/2025' },
        { Brand: 'Dell', 'Serial Number': 'KM-NEG', 'Purchase Price': '-500' },
        { Brand: 'Dell', 'Serial Number': 'KM-OK', 'Purchase Price': 'Rs. 500', 'Date of Invoice': '05/02/2025' },
      ],
    });
    const db = testDb();

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatchObject({ row: 2, sheet: 'Keyboard Mouse', serial: 'KM-BAD' });
    expect(result.errors[0].messages).toEqual([
      expect.stringContaining('Purchase Price "1.234,50" is not a valid amount'),
      expect.stringContaining('Date of Invoice "31/02/2025" is not a valid date'),
    ]);
    expect(result.errors[1].messages[0]).toContain('"-500"');
    expect(db.bySerial('KM-OK')).toMatchObject({ cost_cents: 50000, purchase_date: '2025-02-05' });
  });

  it('rejects serials that Excel turned into scientific notation', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Headphones');
    sheet.addRow(HEADPHONE_HEADERS);
    sheet.addRow(rowFor(HEADPHONE_HEADERS, { Brand: 'Boat', 'Serial Number': 2.44516e17 }));
    sheet.addRow(rowFor(HEADPHONE_HEADERS, { Brand: 'Boat', 'Serial Number': 12345678 }));
    sheet.getCell(3, 6).numFmt = '0.00E+00';
    sheet.addRow(rowFor(HEADPHONE_HEADERS, { Brand: 'Boat', 'Serial Number': '2.44516E+17' }));
    sheet.addRow(rowFor(HEADPHONE_HEADERS, { Brand: 'Boat', 'Serial Number': 904130866043 }));
    const filePath = await saveWorkbook(workbook);
    const db = testDb();

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.errors.map((error) => error.row)).toEqual([2, 3, 4]);
    for (const error of result.errors) expect(error.messages[0]).toMatch(/scientific notation/);
    expect(db.state.assets.map((asset) => asset.serial_number)).toEqual(['904130866043']);
  });

  it('prefetches every lookup: four pool queries regardless of row count, no per-row SELECTs', async () => {
    const rows = Array.from({ length: 300 }, (_, index) => ({
      'Issued To': index % 2 ? 'a@x.com' : 'Unknown Person', Brand: 'Dell', 'Hardware Type': 'Mouse', 'Serial Number': `M-${index}`,
    }));
    const filePath = await writeWorkbook({ 'Keyboard Mouse': [KEYBOARD_HEADERS, ...rows] });
    const db = testDb();

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.imported).toBe(300);
    expect(db.pool.query).toHaveBeenCalledTimes(4);
    const selects = db.client.query.mock.calls.filter(([sql]) => /^\s*SELECT/i.test(sql));
    expect(selects).toEqual([]);
  });

  it('rolls back a dry run while reporting what would be imported', async () => {
    const filePath = await writeWorkbook({
      Laptops: [LAPTOP_HEADERS, { 'Issued To': 'a@x.com', Brand: 'Dell', 'Serial Number': 'LAP-DRY', 'Adaptor S/N': 'ADP-DRY' }],
    });
    const db = testDb();

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies, { dryRun: true });

    expect(result).toMatchObject({ dryRun: true, imported: 2, errors: [], skipped: [] });
    expect(db.state.outcome).toBe('rolled back');
    expect(db.state.assets).toEqual([]);
  });
});

describe('Excel import: export-format Status, Category and Location', () => {
  const HEADERS = ['Issued To Email', 'Hardware Type', 'Brand', 'Serial Number', 'Comments', 'Status', 'Category', 'Location'];

  it('uses the Status column as written and never infers lifecycle from comments', async () => {
    const filePath = await writeWorkbook({
      'Keyboard Mouse': [HEADERS,
        { 'Issued To Email': 'a@x.com', Brand: 'Dell', 'Serial Number': 'S-INUSE', Status: 'In Use', Category: 'keyboard & mouse' },
        { Brand: 'Dell', 'Serial Number': 'S-AVAIL', Comments: 'Broken - returned to store', Status: 'available', Category: 'Monitor', Location: 'mumbai' },
        { Brand: 'Dell', 'Serial Number': 'S-RETIRED', Comments: 'Returned on 13 Feb', Status: 'RETIRED', Category: 'Monitor' },
        { 'Issued To Email': 'b@x.com', Brand: 'Dell', 'Serial Number': 'S-ASSIGNED', Status: 'assigned', Category: 'Monitor' },
        { Brand: 'Dell', 'Serial Number': 'S-BLANK', Comments: 'broken', Category: 'Monitor' },
      ],
    });
    const db = testDb();

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.errors).toEqual([]);
    expect(db.bySerial('S-INUSE')).toMatchObject({ status: 'in-use', assigned_to: 1, category_id: 3 });
    expect(db.bySerial('S-AVAIL')).toMatchObject({ status: 'available', location: 'Mumbai', category_id: 2 });
    expect(db.bySerial('S-RETIRED')).toMatchObject({ status: 'retired' });
    expect(db.bySerial('S-ASSIGNED')).toMatchObject({ status: 'in-use', assigned_to: 2 });
    expect(db.bySerial('S-BLANK')).toMatchObject({ status: 'available' });
    expect(result.categoriesCreated).toEqual([]);
  });

  it('reports invalid status, unknown category and unknown location per row', async () => {
    const filePath = await writeWorkbook({
      'Keyboard Mouse': [HEADERS,
        { Brand: 'Dell', 'Serial Number': 'S-LOST', Status: 'lost', Category: 'Monitor' },
        { Brand: 'Dell', 'Serial Number': 'S-RET', Status: 'returned', Category: 'Monitor' },
        { Brand: 'Dell', 'Serial Number': 'S-CAT', Status: 'available', Category: 'Spaceship' },
        { Brand: 'Dell', 'Serial Number': 'S-LOC', Status: 'available', Category: 'Monitor', Location: 'Pune' },
        { Brand: 'Dell', 'Serial Number': 'S-NOHOLDER', Status: 'in-use', Category: 'Monitor' },
        { Brand: 'Dell', 'Serial Number': 'S-OK', Status: 'available', Category: 'Monitor' },
      ],
    });
    const db = testDb();

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.imported).toBe(1);
    const messages = Object.fromEntries(result.errors.map((error) => [error.serial, error.messages.join(' | ')]));
    expect(messages['S-LOST']).toContain('Status "lost" must be');
    expect(messages['S-RET']).toContain('returned is only for client-owned assets');
    expect(messages['S-CAT']).toContain('Category "Spaceship" does not exist');
    expect(messages['S-LOC']).toContain('Location "Pune" does not exist');
    expect(messages['S-NOHOLDER']).toContain('Status in-use needs Issued To Email');
    expect(result.categoriesCreated).toEqual([]);
  });
});

describe('Excel import: generated serials', () => {
  it('generates the same NOSN serial from row content, whatever the row number', async () => {
    const headphone = { 'Issued To': 'a@x.com', Brand: 'Boat', Type: 'Headphone', Model: 'Rockerz', 'Serial Number': 'NA', 'Purchase Price': 1999 };
    const other = { 'Issued To': 'b@x.com', Brand: 'Boat', Type: 'Headphone', Model: 'Other', 'Serial Number': 'HP-2' };
    const first = testDb();
    await importAssetsFromExcel(await writeWorkbook({ Headphones: [HEADPHONE_HEADERS, headphone] }), { id: 1 }, first.dependencies);
    const second = testDb();
    await importAssetsFromExcel(await writeWorkbook({ Headphones: [HEADPHONE_HEADERS, other, other, headphone] }), { id: 1 }, second.dependencies);

    const generated = first.state.assets[0].serial_number;
    expect(generated).toMatch(/^NOSN-HP-[0-9A-F]{8}$/);
    expect(second.bySerial(generated)).toBeDefined();
  });

  it('tells identical serial-less rows apart and skips them all on re-import', async () => {
    const row = { Brand: 'Boat', Type: 'Headphone', Model: 'Rockerz', 'Serial Number': 'N/A' };
    const filePath = await writeWorkbook({ Headphones: [HEADPHONE_HEADERS, row, row] });
    const db = testDb();

    const first = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);
    const serials = db.state.assets.map((asset) => asset.serial_number);
    const again = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(first.generatedSerials).toBe(2);
    expect(new Set(serials).size).toBe(2);
    expect(again.imported).toBe(0);
    expect(again.skipped).toEqual(serials.map((serial) => `Duplicate serial: ${serial}`));
  });
});

describe('Legacy workbook interpretation', () => {
  it('reads lifecycle from free-text status and comments, treating damage as retired', () => {
    expect(parseLifecycleText('Returned-In Store')).toBe('available');
    expect(parseLifecycleText('Stored in Store room')).toBe('available');
    expect(parseLifecycleText('Retuned on 13th Feb 2026')).toBe('available');
    expect(parseLifecycleText('Return By Mohit Singh')).toBe('available');
    expect(parseLifecycleText('Returned-Broken-In Store')).toBe('retired');
    expect(parseLifecycleText('Returned to Store as Damaged')).toBe('retired');
    expect(parseLifecycleText('One Side earphone not working')).toBe('retired');
    expect(parseLifecycleText('In-use')).toBe('in-use');
    expect(parseLifecycleText('retired')).toBe('retired');
    expect(parseLifecycleText('available')).toBe('available');
    expect(parseLifecycleText('with mouse pad')).toBeNull();
    expect(parseLifecycleText('')).toBeNull();
  });

  it('accepts only explicit statuses from an export Status column', () => {
    expect(parseStatusKeyword('In Use')).toBe('in-use');
    expect(parseStatusKeyword('ASSIGNED')).toBe('in-use');
    expect(parseStatusKeyword('Returned')).toBe('returned');
    expect(parseStatusKeyword('Returned-In Store')).toBeUndefined();
    expect(parseStatusKeyword('')).toBeNull();
  });

  it('maps sheet item types onto existing categories and keeps unknown types', () => {
    expect(importCategoryName('Headphone')).toBe('Audio & Headset');
    expect(importCategoryName('Wireless Mouse')).toBe('Keyboard & Mouse');
    expect(importCategoryName('Wireless Keyboard and Mouse')).toBe('Keyboard & Mouse');
    expect(importCategoryName('Wireless Keyboard & Mouse')).toBe('Keyboard & Mouse');
    expect(importCategoryName('Monitor')).toBe('Monitor');
    expect(importCategoryName('Laptop  Stand')).toBe('Laptop Stand');
    expect(importCategoryName(null)).toBeNull();
  });

  it('merges handovers but keeps different items that share a product code', () => {
    const row = (order, issuedTo, issueDate, comments = null) => ({
      order, serial: 'SER', issuedTo, issueDate, comments, fields: {},
    });
    const handover = groupRowsIntoItems([
      row(1, 'b@x.com', '2026-02-13'),
      row(0, 'a@x.com', '2024-12-03', 'Retuned on 13th Feb 2026'),
    ]);
    expect(handover).toHaveLength(1);
    expect(handover[0].rows.map((r) => r.issuedTo)).toEqual(['a@x.com', 'b@x.com']);

    const sharedCode = groupRowsIntoItems([
      row(0, 'a@x.com', '2025-07-11'),
      row(1, 'b@x.com', '2025-07-11'),
    ]);
    expect(sharedCode.map((item) => item.serial)).toEqual(['SER', 'SER-2']);
  });

  it('imports returned, broken, serial-less and handed-over items consistently', async () => {
    const filePath = await writeWorkbook({
      Laptops: [LAPTOP_HEADERS, { 'Issued To': 'a@x.com', Brand: 'Lenovo', Model: 'IdeaPad', 'Serial Number': 'LAP-1', 'Adaptor S/N': 'N/A' }],
      Headphones: [HEADPHONE_HEADERS,
        { 'Issued To': 'a@x.com', Brand: 'Boat', Type: 'Headphone', Model: 'Rockerz', 'Serial Number': 'NA', Status: 'Returned-Broken-In Store' },
        { 'Issued To': 'b@x.com', Brand: 'Boat', Type: 'Headphone', Model: 'Rockerz', 'Serial Number': 'HP-2', Status: 'Returned-In Store' },
      ],
      'Keyboard Mouse': [KEYBOARD_HEADERS,
        { 'Issued To': 'a@x.com', 'Date of Issue': new Date('2024-12-03'), 'Hardware Type': 'Wireless Mouse', Brand: 'Dell', Model: 'MS116', 'Serial Number': 'MOUSE-1', Comments: 'Retuned on 13th Feb 2026' },
        { 'Issued To': 'b@x.com', 'Date of Issue': new Date('2026-02-13'), 'Hardware Type': 'Wireless Mouse', Brand: 'Dell', Model: 'MS116', 'Serial Number': 'MOUSE-1' },
      ],
    });
    // No Adaptor category yet: legacy free-text types may still create one.
    const db = testDb({ categories: STANDARD_CATEGORIES.filter((category) => category.name !== 'Adaptor') });

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.skipped).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.categoriesCreated).toEqual(['Adaptor']);
    expect(result.generatedSerials).toBe(1);
    expect(result.handovers).toBe(1);

    // Laptop is in use and its placeholder adaptor serial is generated and follows it.
    const laptop = db.bySerial('LAP-1');
    expect(laptop).toMatchObject({ status: 'in-use', assigned_to: 1, category_id: 1 });
    const adaptor = db.state.assets.find((asset) => asset.parent_id === laptop.id);
    expect(adaptor.serial_number).toMatch(/^NOSN-ADP-[0-9A-F]{8}$/);
    expect(adaptor).toMatchObject({ status: 'in-use', assigned_to: 1, name: 'Adaptor for LAP-1' });

    // Broken headphone with "NA" serial is retired and unassigned; returned one is available.
    const broken = db.state.assets.find((asset) => /^NOSN-HP-/.test(asset.serial_number));
    expect(broken).toMatchObject({ status: 'retired', assigned_to: null, category_id: 4 });
    expect(broken.notes).toContain('Sheet status: Returned-Broken-In Store');
    expect(db.bySerial('HP-2')).toMatchObject({ status: 'available', assigned_to: null });

    // Mouse handed from a@ to b@ is one asset held by b@, with a@'s return in history.
    expect(db.state.assets.filter((asset) => asset.serial_number.startsWith('MOUSE-1'))).toHaveLength(1);
    const mouse = db.bySerial('MOUSE-1');
    expect(mouse).toMatchObject({ status: 'in-use', assigned_to: 2, category_id: 3 });
    expect(db.state.history.filter((event) => event.assetId === mouse.id).map((event) => `${event.eventType}:${event.employeeId}`))
      .toEqual(['created:null', 'assigned:1', 'returned:1', 'assigned:2']);
  });
});

describe('Excel export → import round trip', () => {
  it('re-imports every exported asset with the same status, links, dates, cost, category and location', async () => {
    const base = { asset_type: 'company', status: 'available', cost_cents: 0 };
    const exportedRows = [
      {
        ...base, id: 1, category_id: 1, category_name: 'Laptop', serial_number: 'LAP-100', name: 'Lenovo IdeaPad 5',
        brand: 'Lenovo', model: 'IdeaPad 5', status: 'in-use', assigned_to: 11, assignee_email: 'a@x.com',
        purchase_date: '2025-02-17', assigned_date: '2025-03-01', warranty_expiry_date: '2028-02-16',
        cost_cents: 6190050, location: 'Bangalore', processor: 'i5', vendor: 'Swastik',
      },
      {
        ...base, id: 2, category_id: 5, category_name: 'Adaptor', serial_number: 'ADP-1', name: 'Adaptor 1',
        parent_id: 1, parent_serial_number: 'LAP-100', status: 'in-use', assignee_email: 'a@x.com', assigned_date: '2025-03-01',
      },
      {
        ...base, id: 3, category_id: 5, category_name: 'Adaptor', serial_number: 'ADP-2', name: 'Adaptor 2',
        parent_id: 1, parent_serial_number: 'LAP-100', status: 'in-use', assignee_email: 'a@x.com', assigned_date: '2025-03-01',
      },
      { ...base, id: 4, category_id: 1, category_name: 'Laptop', serial_number: 'LAP-200', name: 'Spare laptop', brand: 'Dell' },
      {
        ...base, id: 5, category_id: 5, category_name: 'Adaptor', serial_number: 'ADP-3', name: 'Adaptor 3',
        parent_id: 4, parent_serial_number: 'LAP-200',
      },
      {
        ...base, id: 6, category_id: 2, category_name: 'Monitor', serial_number: 'MON-1', name: 'Lenovo L27i',
        brand: 'Lenovo', status: 'retired', cost_cents: 1251099, purchase_date: '2023-09-29', location: 'Mumbai', notes: 'Cracked panel',
      },
      {
        ...base, id: 7, category_id: 1, category_name: 'Laptop', serial_number: 'CL-1', name: 'HP ZBook', brand: 'HP',
        asset_type: 'client', status: 'returned', client_name: 'Salesforce', received_on: '2023-09-08', return_date: '2024-01-10',
        hardware_type: 'Laptop',
      },
      {
        ...base, id: 8, category_id: 4, category_name: 'Audio & Headset', serial_number: 'HP-9', name: 'Boat Rockerz',
        brand: 'Boat', hardware_type: 'Headphone', status: 'in-use', assignee_email: 'gone@x.com',
        assignee_deleted_at: '2026-01-01T00:00:00Z', purchase_date: '2022-11-20', cost_cents: 199900,
      },
    ];
    const workbook = await exportAssetsToExcel({ pool: { query: vi.fn().mockResolvedValue({ rows: exportedRows }) } });

    // Legacy column: only a laptop with exactly one adaptor names it.
    const laptopRows = {};
    workbook.getWorksheet('Laptops').eachRow((row, rowNum) => { if (rowNum > 1) laptopRows[row.getCell(4).value] = row.getCell(7).value; });
    expect(laptopRows).toEqual({ 'LAP-100': '', 'LAP-200': 'ADP-3' });

    const filePath = await saveWorkbook(workbook);
    const db = testDb();
    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.errors).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.imported).toBe(exportedRows.length);
    expect(db.state.assets).toHaveLength(exportedRows.length);
    expect(result.warnings).toEqual(['Employee gone@x.com is no longer active (Headphones, serial HP-9); imported as available']);

    const categoryId = (name) => db.state.categories.find((category) => category.name === name).id;
    const laptop = db.bySerial('LAP-100');
    expect(laptop).toMatchObject({
      status: 'in-use', assigned_to: 1, asset_type: 'company', category_id: categoryId('Laptop'), location: 'Bangalore',
      purchase_date: '2025-02-17', assigned_date: '2025-03-01', warranty_expiry_date: '2028-02-16',
      cost_cents: 6190050, name: 'Lenovo IdeaPad 5', processor: 'i5', vendor: 'Swastik', parent_id: null,
    });
    for (const serial of ['ADP-1', 'ADP-2']) {
      expect(db.bySerial(serial)).toMatchObject({
        status: 'in-use', assigned_to: 1, category_id: categoryId('Adaptor'), parent_id: laptop.id,
      });
    }
    expect(db.bySerial('ADP-3')).toMatchObject({ status: 'available', parent_id: db.bySerial('LAP-200').id });
    expect(db.bySerial('MON-1')).toMatchObject({
      status: 'retired', category_id: categoryId('Monitor'), location: 'Mumbai', cost_cents: 1251099,
      purchase_date: '2023-09-29', notes: 'Cracked panel', asset_type: 'company',
    });
    expect(db.bySerial('CL-1')).toMatchObject({
      status: 'returned', asset_type: 'client', client_name: 'Salesforce', received_on: '2023-09-08',
      return_date: '2024-01-10', category_id: categoryId('Laptop'),
    });
    const headphone = db.bySerial('HP-9');
    expect(headphone).toMatchObject({
      status: 'available', assigned_to: null, category_id: categoryId('Audio & Headset'), cost_cents: 199900, purchase_date: '2022-11-20',
    });
    expect(headphone.notes).toBe('Previously held by gone@x.com');

    // Importing the same export again changes nothing.
    const again = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);
    expect(again.imported).toBe(0);
    expect(again.skipped).toHaveLength(exportedRows.length);
  });
});
