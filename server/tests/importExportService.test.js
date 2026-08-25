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
  importAssetsFromExcel,
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
        if (/^SELECT id FROM assets/.test(sql.trim())) {
          return { rows: ['LAP-DUP', 'ADAPTOR-DUP'].includes(params[0]) ? [{ id: 1 }] : [] };
        }
        if (/INSERT INTO assets/.test(sql)) {
          insertedSerials.push(sql.includes('parent_id') ? params[2] : params[3]);
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

    expect(result.imported).toBe(2);
    expect(result.skipped).toEqual(expect.arrayContaining([
      'Row missing serial number (Laptops sheet)',
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
