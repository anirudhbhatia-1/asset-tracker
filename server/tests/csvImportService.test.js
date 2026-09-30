import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { importAssetsFromCsv, parseCsvDate, parseCsvStatus } from '../services/csvImportService';

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
    expect(parseCsvDate('8-6-2026')).toBe('2026-06-08');
    expect(parseCsvDate('17 Feb 2025')).toBe('2025-02-17');
    expect(parseCsvDate('')).toBeNull();
  });

  it('rejects impossible or unrecognised dates', () => {
    expect(parseCsvDate('31/02/2025')).toBeUndefined();
    expect(parseCsvDate('next week')).toBeUndefined();
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
  const fakeDatabase = () => {
    const inserted = [];
    const pool = {
      query: vi.fn(async (sql, params) => {
        if (/FROM categories/.test(sql)) return { rows: [{ id: 1, name: 'Laptop' }] };
        if (/FROM locations/.test(sql)) return { rows: [{ name: 'Bangalore' }] };
        if (/FROM employees/.test(sql)) return { rows: params[0] === 'a@x.com' ? [{ id: 7 }] : [] };
        if (/FROM assets/.test(sql)) return { rows: [] };
        throw new Error(`Unexpected pool query: ${sql}`);
      }),
    };
    const client = {
      query: vi.fn(async (sql, params) => {
        if (/SELECT id FROM assets/.test(sql)) return { rows: [] };
        if (/INSERT INTO assets/.test(sql)) {
          inserted.push({ serial: params[3], status: params[4], assignedTo: params[8], location: params[6], costCents: params[10] });
          return { rows: [{ id: inserted.length }] };
        }
        throw new Error(`Unexpected transaction query: ${sql}`);
      }),
    };
    return { pool, client, inserted };
  };

  it('validates rows, keeps text serials intact and imports the valid ones', async () => {
    const filePath = await writeCsv([
      '﻿Serial Number,Category,Brand,Model,Assigned To Email,Location,Cost',
      '0244515680,laptop,Dell,Latitude,a@x.com,bangalore,"1,234.50"',
      'BAD-1,Laptpo,Dell,Latitude,,,',
      'BAD-2,Laptop,Dell,Latitude,missing@x.com,,',
    ].join('\r\n'));
    const { pool, client, inserted } = fakeDatabase();

    const result = await importAssetsFromCsv(filePath, { id: 1 }, {}, {
      pool,
      withTransaction: (callback) => callback(client),
      logEvent: vi.fn(),
    });

    expect(result.imported).toBe(1);
    expect(inserted).toEqual([{ serial: '0244515680', status: 'in-use', assignedTo: 7, location: 'Bangalore', costCents: 123450 }]);
    expect(result.errors.map((error) => error.row)).toEqual([3, 4]);
    expect(result.errors[0].messages[0]).toContain('category "Laptpo" does not exist');
    expect(result.errors[1].messages[0]).toContain('is not an employee');
  });

  it('rolls back a dry run while still reporting what would be imported', async () => {
    const filePath = await writeCsv('category,name\nLaptop,Spare laptop\n');
    const { pool, client } = fakeDatabase();
    let transactionOutcome;

    const result = await importAssetsFromCsv(filePath, { id: 1 }, { dryRun: true }, {
      pool,
      withTransaction: async (callback) => {
        try {
          await callback(client);
          transactionOutcome = 'committed';
        } catch (err) {
          transactionOutcome = 'rolled back';
          throw err;
        }
      },
      logEvent: vi.fn(),
    });

    expect(result.imported).toBe(1);
    expect(result.dryRun).toBe(true);
    expect(transactionOutcome).toBe('rolled back');
  });

  it('requires a header row with a category column', async () => {
    const filePath = await writeCsv('foo,bar\n1,2\n');
    await expect(importAssetsFromCsv(filePath, { id: 1 }, {}, fakeDatabase()))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
