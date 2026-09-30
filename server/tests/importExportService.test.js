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
  generatedSerialFor,
  groupRowsIntoItems,
} from '../services/importExportService';

const temporaryFiles = [];

afterEach(async () => {
  await Promise.all(temporaryFiles.splice(0).map((file) => rm(file, { force: true })));
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

  it('unwraps rich text and formula results', () => {
    expect(optionalExcelText({ richText: [{ text: ' Dell' }, { text: ' Inc. ' }] })).toBe('Dell Inc.');
    expect(optionalExcelText({ formula: 'A1', result: 0 })).toBeNull();
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
    for (const sheetName of ['Laptops', 'Headphones', 'Keyboard Mouse', 'Client Laptops']) {
      expect(workbook.getWorksheet(sheetName).getCell(1, 1).value).toBe('Issued To Email');
    }
    expect(workbook.getWorksheet('Laptops').getCell(2, 1).value).toBe('amit@thinkvibes.com');
  });

  it('puts every exported asset on exactly one sheet based on its category', async () => {
    const asset = (serial, categoryName, extra = {}) => ({
      serial_number: serial, category_name: categoryName, asset_type: 'company', status: 'available', ...extra,
    });
    const databasePool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          asset('LAP-1', 'Laptop', { adaptor_serial_number: 'ADP-1' }),
          asset('HEAD-1', 'Audio & Headset', { hardware_type: 'Headphone' }),
          asset('MOUSE-1', 'Keyboard & Mouse', { hardware_type: 'Wireless Mouse' }),
          asset('MON-1', 'Monitor'),
          asset('STAND-1', 'Laptop Stand'),
          asset('CL-1', 'Laptop', { asset_type: 'client', hardware_type: 'Laptop' }),
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
    expect(workbook.getWorksheet('Laptops').getCell(2, 7).value).toBe('ADP-1');
    expect(serialsOn('Headphones', 6)).toEqual(['HEAD-1']);
    expect(serialsOn('Keyboard Mouse', 6)).toEqual(['MOUSE-1', 'MON-1', 'STAND-1']);
    expect(workbook.getWorksheet('Keyboard Mouse').getCell(2, 3).value).toBe('Wireless Mouse');
    expect(serialsOn('Client Laptops', 5)).toEqual(['CL-1']);
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

  it('skips a named assignee with no employee email record instead of importing it unassigned', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Laptops');
    sheet.addRow(['Issued To', 'Brand', 'Model', 'Serial Number']);
    sheet.addRow(['Abhay Deewan', 'Dell', 'Latitude', 'LAP-UNMAPPED']);
    const filePath = join(tmpdir(), `asset-import-unmapped-${process.pid}-${Date.now()}.xlsx`);
    temporaryFiles.push(filePath);
    await workbook.xlsx.writeFile(filePath);

    const transactionClient = { query: vi.fn() };
    const databasePool = {
      query: vi.fn(async (sql) => (
        sql.includes('FROM categories') ? { rows: [{ id: 10 }] } : { rows: [] }
      )),
    };

    const result = await importAssetsFromExcel(filePath, { id: 1 }, {
      pool: databasePool,
      withTransaction: (callback) => callback(transactionClient),
      logEvent: vi.fn(),
    });

    expect(result.imported).toBe(0);
    expect(result.skipped).toContain('Employee not found: Abhay Deewan (Laptops, serial LAP-UNMAPPED)');
    expect(transactionClient.query).not.toHaveBeenCalled();
  });

  it('turns invalid date strings and invalid native dates into null', () => {
    expect(excelDateToISO('not a date')).toBeNull();
    expect(excelDateToISO(new Date('invalid'))).toBeNull();
  });

  it('maps zero and empty cells to safe insert values across every supported sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheets = [
      ['Laptops', 22, { 4: 'LAP-ZERO' }],
      ['Headphones', 13, { 6: 'HEAD-ZERO' }],
      ['Keyboard Mouse', 11, { 6: 'KEY-ZERO' }],
      ['Client Laptops', 10, { 5: 'CLIENT-ZERO' }],
    ];

    for (const [name, columnCount, values] of sheets) {
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`));
      const row = Array(columnCount).fill(0);
      for (const [column, value] of Object.entries(values)) row[Number(column) - 1] = value;
      sheet.addRow(row);
    }

    const filePath = join(tmpdir(), `asset-import-zero-${process.pid}-${Date.now()}.xlsx`);
    temporaryFiles.push(filePath);
    await workbook.xlsx.writeFile(filePath);

    const inserts = [];
    let nextId = 1;
    const transactionClient = {
      query: vi.fn(async (sql, params) => {
        if (/FROM categories/.test(sql)) return { rows: [{ id: 10 }] };
        if (/^SELECT id FROM assets/.test(sql.trim())) return { rows: [] };
        if (/INSERT INTO assets/.test(sql)) {
          inserts.push(params);
          return { rows: [{ id: nextId++ }] };
        }
        throw new Error(`Unexpected transaction query: ${sql}`);
      }),
    };
    const databasePool = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 10 }] }),
    };

    const result = await importAssetsFromExcel(filePath, { id: 1 }, {
      pool: databasePool,
      withTransaction: (callback) => callback(transactionClient),
      logEvent: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.imported).toBe(4);
    expect(result.errors).toEqual([]);
    expect(inserts).toHaveLength(4);

    for (const params of inserts) {
      expect(params[6]).toBeNull();
      expect(params[8]).toBeNull();
      expect(params[9]).toBe(0);
      expect(params[10]).toBeNull();
    }

    expect(inserts.find((params) => params[3] === 'LAP-ZERO')[11]).toBeNull();
    expect(inserts.find((params) => params[3] === 'HEAD-ZERO')[27]).toBeNull();
    expect(inserts.find((params) => params[3] === 'CLIENT-ZERO')[28]).toBeNull();
  });

  it('skips missing and duplicate serials while creating only new adaptors', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Laptops');
    sheet.addRow(Array.from({ length: 22 }, (_, index) => `Column ${index + 1}`));
    sheet.addRow(Array(22).fill(0));

    const addLaptop = (serial, adaptorSerial) => {
      const row = Array(22).fill(0);
      row[3] = serial;
      row[6] = adaptorSerial;
      sheet.addRow(row);
    };
    addLaptop('LAP-DUP', 0);
    addLaptop('LAP-NEW', 'ADAPTOR-NEW');
    addLaptop('LAP-EXISTING-ADAPTOR', 'ADAPTOR-DUP');

    const filePath = join(tmpdir(), `asset-import-duplicates-${process.pid}-${Date.now()}.xlsx`);
    temporaryFiles.push(filePath);
    await workbook.xlsx.writeFile(filePath);

    const insertedSerials = [];
    let nextId = 100;
    const transactionClient = {
      query: vi.fn(async (sql, params) => {
        if (/FROM categories/.test(sql)) return { rows: [{ id: 10 }] };
        if (/^SELECT id FROM assets/.test(sql.trim())) {
          return { rows: ['LAP-DUP', 'ADAPTOR-DUP'].includes(params[0]) ? [{ id: 1 }] : [] };
        }
        if (/INSERT INTO assets/.test(sql)) {
          insertedSerials.push(params[3]);
          return { rows: [{ id: nextId++ }] };
        }
        throw new Error(`Unexpected transaction query: ${sql}`);
      }),
    };

    const result = await importAssetsFromExcel(filePath, { id: 1 }, {
      pool: { query: vi.fn().mockResolvedValue({ rows: [{ id: 10 }] }) },
      withTransaction: (callback) => callback(transactionClient),
      logEvent: vi.fn().mockResolvedValue(undefined),
    });

    // Two laptops plus the one new adaptor, which is an asset in its own right.
    expect(result.imported).toBe(3);
    expect(result.skipped).toEqual(expect.arrayContaining([
      'Row missing serial (Laptops sheet, row 2)',
      'Duplicate serial: LAP-DUP',
    ]));
    expect(insertedSerials).toEqual(expect.arrayContaining([
      'LAP-NEW',
      'ADAPTOR-NEW',
      'LAP-EXISTING-ADAPTOR',
    ]));
    expect(insertedSerials).not.toContain('ADAPTOR-DUP');
  });

  it('propagates transaction failures so the database can roll back the import', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Laptops');
    sheet.addRow(['Issued To', 'Brand', 'Model', 'Serial Number']);
    sheet.addRow([0, 0, 0, 'LAP-ROLLBACK']);
    const filePath = join(tmpdir(), `asset-import-rollback-${process.pid}-${Date.now()}.xlsx`);
    temporaryFiles.push(filePath);
    await workbook.xlsx.writeFile(filePath);

    await expect(importAssetsFromExcel(filePath, { id: 1 }, {
      pool: { query: vi.fn().mockResolvedValue({ rows: [{ id: 10 }] }) },
      withTransaction: async (callback) => callback({
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockRejectedValueOnce(new Error('insert failed')),
      }),
      logEvent: vi.fn(),
    })).rejects.toThrow('insert failed');
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

  it('maps sheet item types onto existing categories and keeps unknown types', () => {
    expect(importCategoryName('Headphone')).toBe('Audio & Headset');
    expect(importCategoryName('Wireless Mouse')).toBe('Keyboard & Mouse');
    expect(importCategoryName('Wireless Keyboard and Mouse')).toBe('Keyboard & Mouse');
    expect(importCategoryName('Wireless Keyboard & Mouse')).toBe('Keyboard & Mouse');
    expect(importCategoryName('Monitor')).toBe('Monitor');
    expect(importCategoryName('Laptop  Stand')).toBe('Laptop Stand');
    expect(importCategoryName(null)).toBeNull();
  });

  it('generates deterministic serials so re-imports are detected as duplicates', () => {
    expect(generatedSerialFor('Headphones', 7)).toBe('NOSN-HP-R0007');
    expect(generatedSerialFor('Headphones', 7)).toBe(generatedSerialFor('Headphones', 7));
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
    const workbook = new ExcelJS.Workbook();
    const laptops = workbook.addWorksheet('Laptops');
    laptops.addRow(Array.from({ length: 22 }, (_, index) => `Column ${index + 1}`));
    const laptop = Array(22).fill(null);
    Object.assign(laptop, { 0: 'a@x.com', 1: 'Lenovo', 2: 'IdeaPad', 3: 'LAP-1', 6: 'N/A' });
    laptops.addRow(laptop);

    const headphones = workbook.addWorksheet('Headphones');
    headphones.addRow(Array.from({ length: 13 }, (_, index) => `Column ${index + 1}`));
    headphones.addRow(['a@x.com', 'Boat', 'Headphone', 'Rockerz', null, 'NA', null, null, null, null, null, 'Returned-Broken-In Store', null]);
    headphones.addRow(['b@x.com', 'Boat', 'Headphone', 'Rockerz', null, 'HP-2', null, null, null, null, null, 'Returned-In Store', null]);

    const keyboards = workbook.addWorksheet('Keyboard Mouse');
    keyboards.addRow(Array.from({ length: 11 }, (_, index) => `Column ${index + 1}`));
    keyboards.addRow(['a@x.com', new Date('2024-12-03'), 'Wireless Mouse', 'Dell', 'MS116', 'MOUSE-1', null, null, null, 'Retuned on 13th Feb 2026', null]);
    keyboards.addRow(['b@x.com', new Date('2026-02-13'), 'Wireless Mouse', 'Dell', 'MS116', 'MOUSE-1', null, null, null, null, null]);

    const filePath = join(tmpdir(), `asset-import-legacy-${process.pid}-${Date.now()}.xlsx`);
    temporaryFiles.push(filePath);
    await workbook.xlsx.writeFile(filePath);

    const employees = { 'a@x.com': 1, 'b@x.com': 2 };
    const categories = { laptop: 11, 'audio & headset': 12, 'keyboard & mouse': 13 };
    const createdCategories = [];
    const assets = [];
    const client = {
      query: vi.fn(async (sql, params) => {
        if (/SELECT id FROM categories/.test(sql)) {
          const id = categories[params[0].toLowerCase()];
          return { rows: id ? [{ id }] : [] };
        }
        if (/INSERT INTO categories/.test(sql)) {
          createdCategories.push(params[0]);
          return { rows: [{ id: 99 }] };
        }
        if (/SELECT id FROM assets/.test(sql)) return { rows: [] };
        if (/INSERT INTO assets/.test(sql)) {
          assets.push({
            id: assets.length + 1, categoryId: params[1], serial: params[3], status: params[4],
            assignedTo: params[7], notes: params[10], parentId: params[29],
          });
          return { rows: [{ id: assets.length }] };
        }
        throw new Error(`Unexpected transaction query: ${sql}`);
      }),
    };
    const events = [];
    const result = await importAssetsFromExcel(filePath, { id: 1 }, {
      pool: { query: vi.fn(async (sql, params) => ({ rows: employees[params[0]] ? [{ id: employees[params[0]] }] : [] })) },
      withTransaction: (callback) => callback(client),
      logEvent: vi.fn(async (assetId, type, actor, employeeId) => { events.push([assetId, type, employeeId]); }),
    });

    const bySerial = Object.fromEntries(assets.map((asset) => [asset.serial, asset]));
    expect(result.skipped).toEqual([]);
    expect(result.categoriesCreated).toEqual(['Adaptor']);
    expect(result.generatedSerials).toBe(1);
    expect(result.handovers).toBe(1);

    // Laptop is in use and its placeholder adaptor serial is generated and follows it.
    expect(bySerial['LAP-1']).toMatchObject({ status: 'in-use', assignedTo: 1, categoryId: 11 });
    expect(bySerial['NOSN-LAP-R0002-ADP']).toMatchObject({
      status: 'in-use', assignedTo: 1, categoryId: 99, parentId: bySerial['LAP-1'].id,
    });

    // Broken headphone with "NA" serial is retired and unassigned; returned one is available.
    expect(bySerial['NOSN-HP-R0002']).toMatchObject({ status: 'retired', assignedTo: null, categoryId: 12 });
    expect(bySerial['NOSN-HP-R0002'].notes).toContain('Sheet status: Returned-Broken-In Store');
    expect(bySerial['HP-2']).toMatchObject({ status: 'available', assignedTo: null });

    // Mouse handed from a@ to b@ is one asset held by b@, with a@'s return in history.
    expect(assets.filter((asset) => asset.serial.startsWith('MOUSE-1'))).toHaveLength(1);
    expect(bySerial['MOUSE-1']).toMatchObject({ status: 'in-use', assignedTo: 2, categoryId: 13 });
    expect(events.filter(([id]) => id === bySerial['MOUSE-1'].id).map(([, type, emp]) => `${type}:${emp}`))
      .toEqual(['created:null', 'assigned:1', 'returned:1', 'assigned:2']);
  });
});
