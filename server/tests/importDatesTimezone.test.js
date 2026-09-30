// Runs with the server clock in India: Excel date cells must keep their
// calendar day (ExcelJS reads them as UTC midnight) instead of shifting.
process.env.TZ = 'Asia/Kolkata';

import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ExcelJS from 'exceljs';
import { afterAll, describe, expect, it } from 'vitest';

import { importAssetsFromExcel } from '../services/importExportService';
import { parseImportDate } from '../services/importHelpers';
import { createImportTestDb, STANDARD_CATEGORIES } from './importTestDb';

const filePath = join(tmpdir(), `asset-import-tz-${process.pid}-${Date.now()}.xlsx`);
afterAll(() => rm(filePath, { force: true }));

describe('Excel dates under Asia/Kolkata', () => {
  it('runs in IST', () => {
    expect(new Date(Date.UTC(2029, 5, 14)).getTimezoneOffset()).toBe(-330);
  });

  it('converts a native Date cell for 2029-06-14 to 2029-06-14', () => {
    expect(parseImportDate(new Date(Date.UTC(2029, 5, 14)))).toBe('2029-06-14');
  });

  it('keeps the day through a written and re-read workbook', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Laptops');
    sheet.addRow(['Issued To', 'Brand', 'Serial Number', 'Date of Invoice', 'Warranty Last Date']);
    sheet.addRow([null, 'Lenovo', 'LAP-TZ', new Date(Date.UTC(2026, 5, 8)), new Date(Date.UTC(2029, 5, 14))]);
    await workbook.xlsx.writeFile(filePath);
    const db = createImportTestDb({ categories: STANDARD_CATEGORIES });

    const result = await importAssetsFromExcel(filePath, { id: 1 }, db.dependencies);

    expect(result.errors).toEqual([]);
    expect(db.bySerial('LAP-TZ')).toMatchObject({ purchase_date: '2026-06-08', warranty_expiry_date: '2029-06-14' });
  });
});
