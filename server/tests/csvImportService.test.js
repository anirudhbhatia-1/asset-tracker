import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { importAssetsFromCsv, parseCsvDate, parseCsvStatus } from '../services/csvImportService';
import { createImportTestDb } from './importTestDb';

const temporaryFiles = [];
afterEach(async () => {
  await Promise.all(temporaryFiles.splice(0).map((file) => rm(file, { force: true })));
});

const writeCsv = async (content) => {
  const filePath = join(tmpdir(), `asset-csv-${process.pid}-${Date.now()}-${temporaryFiles.length}.csv`);
  temporaryFiles.push(filePath);
  await writeFile(filePath, content);
  return filePath;
};

describe('CSV value parsing', () => {
  it('reads ISO, day-first and month-name dates', () => {
    expect(parseCsvDate('2025-02-17')).toBe('2025-02-17');
    expect(parseCsvDate('08/06/2026')).toBe('2026-06-08');
    expect(parseCsvDate('05/02/2025')).toBe('2025-02-05');
    expect(parseCsvDate('8-6-2026')).toBe('2026-06-08');
    expect(parseCsvDate('17 Feb 2025')).toBe('2025-02-17');
    expect(parseCsvDate('')).toBeNull();
  });

  it('rejects impossible, unrecognised or out-of-range dates', () => {
    expect(parseCsvDate('31/02/2025')).toBeUndefined();
    expect(parseCsvDate('next week')).toBeUndefined();
    expect(parseCsvDate('01/01/1899')).toBeUndefined();
    expect(parseCsvDate('2101-01-01')).toBeUndefined();
  });

  it('accepts only explicit statuses', () => {
    expect(parseCsvStatus('In Use')).toBe('in-use');
    expect(parseCsvStatus('assigned')).toBe('in-use');
    expect(parseCsvStatus('Available')).toBe('available');
    expect(parseCsvStatus('retired')).toBe('retired');
    expect(parseCsvStatus('broken-ish')).toBeUndefined();
    expect(parseCsvStatus('')).toBeNull();
  });
});

describe('CSV import', () => {
  const fakeDatabase = (options = {}) => createImportTestDb({
    categories: [{ name: 'Laptop' }],
    locations: ['Bangalore'],
    employees: [
      { id: 7, name: 'A Person', email: 'a@x.com', deleted_at: null },
      { id: 8, name: 'Gone Person', email: 'gone@x.com', deleted_at: '2026-01-01T00:00:00Z' },
    ],
    ...options,
  });

  it('validates rows, keeps text serials intact and imports the valid ones', async () => {
    const filePath = await writeCsv([
      '﻿Serial Number,Category,Brand,Model,Assigned To Email,Location,Cost',
      '0244515680,laptop,Dell,Latitude,a@x.com,bangalore,"1,234.50"',
      'BAD-1,Laptpo,Dell,Latitude,,,',
      'BAD-2,Laptop,Dell,Latitude,missing@x.com,,',
      'BAD-3,Laptop,Dell,Latitude,gone@x.com,,',
    ].join('\r\n'));
    const db = fakeDatabase();

    const result = await importAssetsFromCsv(filePath, { id: 1 }, {}, db.dependencies);

    expect(result.imported).toBe(1);
    expect(db.state.assets).toHaveLength(1);
    expect(db.bySerial('0244515680')).toMatchObject({ status: 'in-use', assigned_to: 7, location: 'Bangalore', cost_cents: 123450 });
    expect(result.errors.map((error) => error.row)).toEqual([3, 4, 5]);
    expect(result.errors[0].messages[0]).toContain('category "Laptpo" does not exist');
    expect(result.errors[1].messages[0]).toContain('is not an employee');
    expect(result.errors[2].messages[0]).toContain('no longer active');
  });

  it('rolls back a dry run while still reporting what would be imported', async () => {
    const filePath = await writeCsv('category,name\nLaptop,Spare laptop\n');
    const db = fakeDatabase();

    const result = await importAssetsFromCsv(filePath, { id: 1 }, { dryRun: true }, db.dependencies);

    expect(result.imported).toBe(1);
    expect(result.dryRun).toBe(true);
    expect(db.state.outcome).toBe('rolled back');
    expect(db.state.assets).toEqual([]);
  });

  it('requires a header row with a category column', async () => {
    const filePath = await writeCsv('foo,bar\n1,2\n');
    await expect(importAssetsFromCsv(filePath, { id: 1 }, {}, fakeDatabase().dependencies))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a header row that repeats a column', async () => {
    const filePath = await writeCsv('category,Serial Number,serial_number\nLaptop,A,B\n');
    const error = await importAssetsFromCsv(filePath, { id: 1 }, {}, fakeDatabase().dependencies).catch((err) => err);
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('serial_number');
  });

  it.each([
    ['Rs. 500', 50000],
    ['₹ 82,950', 8295000],
    ['INR 12510.99', 1251099],
  ])('accepts the cost %j', async (cost, cents) => {
    const filePath = await writeCsv(`category,name,cost\nLaptop,Spare,"${cost}"\n`);
    const db = fakeDatabase();
    const result = await importAssetsFromCsv(filePath, { id: 1 }, {}, db.dependencies);
    expect(result.errors).toEqual([]);
    expect(db.state.assets[0].cost_cents).toBe(cents);
  });

  it('reports bad costs, dates and scientific-notation serials per row without aborting', async () => {
    const filePath = await writeCsv([
      'serial_number,category,name,cost,purchase_date',
      'C-1,Laptop,One,1e3,',
      'C-2,Laptop,Two,"1.234,50",',
      'C-3,Laptop,Three,-500,',
      'C-4,Laptop,Four,99999999,',
      'C-5,Laptop,Five,,31/02/2025',
      '2.44516E+17,Laptop,Six,,',
      'C-7,Laptop,Seven,500,05/02/2025',
    ].join('\n'));
    const db = fakeDatabase();

    const result = await importAssetsFromCsv(filePath, { id: 1 }, {}, db.dependencies);

    expect(result.imported).toBe(1);
    expect(result.errors.map((error) => error.row)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(result.errors[0].messages[0]).toContain('cost "1e3" is not a valid amount');
    expect(result.errors[1].messages[0]).toContain('cost "1.234,50"');
    expect(result.errors[2].messages[0]).toContain('cost "-500"');
    expect(result.errors[3].messages[0]).toContain('cost "99999999"');
    expect(result.errors[4].messages[0]).toContain('purchase_date "31/02/2025" is not a valid date');
    expect(result.errors[5].messages[0]).toContain('scientific notation');
    expect(db.bySerial('C-7')).toMatchObject({ cost_cents: 50000, purchase_date: '2025-02-05' });
  });

  it('generates serials from row content, not the row number', async () => {
    const row = 'Laptop,Spare laptop,Dell,Latitude,08/06/2026,82950';
    const header = 'category,name,brand,model,purchase_date,cost';
    const first = fakeDatabase();
    await importAssetsFromCsv(await writeCsv(`${header}\n${row}\n`), { id: 1 }, {}, first.dependencies);
    const second = fakeDatabase();
    await importAssetsFromCsv(await writeCsv(`${header}\nLaptop,Other,HP,EliteBook,,\n${row}\n${row}\n`), { id: 1 }, {}, second.dependencies);

    const serial = first.state.assets[0].serial_number;
    expect(serial).toMatch(/^NOSN-CSV-[0-9A-F]{8}$/);
    expect(second.bySerial(serial)).toBeDefined();
    // Identical rows get distinct serials via their occurrence counter.
    expect(new Set(second.state.assets.map((asset) => asset.serial_number)).size).toBe(3);
  });

  it('reports a database error on one row and still imports the others', async () => {
    const filePath = await writeCsv('serial_number,category,name\nOK-1,Laptop,One\nFAIL-1,Laptop,Two\nOK-2,Laptop,Three\n');
    const db = fakeDatabase({ failInsertFor: ['FAIL-1'] });

    const result = await importAssetsFromCsv(filePath, { id: 1 }, {}, db.dependencies);

    expect(result.imported).toBe(2);
    expect(result.errors).toEqual([{ row: 3, serial: 'FAIL-1', messages: ['Could not be saved: simulated failure for FAIL-1'] }]);
    expect(db.state.outcome).toBe('committed');
  });

  it('links accessories to parents in the file or in inventory and skips existing serials, with prefetched lookups', async () => {
    const filePath = await writeCsv([
      'serial_number,category,name,parent_serial',
      'ADP-A,Laptop,Adaptor A,LAP-NEW',
      'LAP-NEW,Laptop,New laptop,',
      'ADP-B,Laptop,Adaptor B,lap-old',
      'LAP-OLD,Laptop,Old laptop,',
      'ADP-C,Laptop,Adaptor C,NOPE',
    ].join('\n'));
    const db = fakeDatabase({ assets: [{ serial_number: 'LAP-OLD' }] });

    const result = await importAssetsFromCsv(filePath, { id: 1 }, {}, db.dependencies);

    expect(result.imported).toBe(3);
    expect(result.skipped).toEqual([{ row: 5, serial: 'LAP-OLD', reason: 'An asset with this serial number already exists' }]);
    expect(result.errors).toEqual([{ row: 6, serial: 'ADP-C', messages: ['parent_serial "NOPE" is not in this file or in inventory'] }]);
    expect(db.bySerial('ADP-A').parent_id).toBe(db.bySerial('LAP-NEW').id);
    expect(db.bySerial('ADP-B').parent_id).toBe(db.bySerial('LAP-OLD').id);
    expect(db.pool.query).toHaveBeenCalledTimes(4);
    expect(db.client.query.mock.calls.filter(([sql]) => /^\s*SELECT/i.test(sql))).toEqual([]);
  });
});
