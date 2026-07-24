import { describe, it, expect, vi } from 'vitest';
import { generateSerialPattern, generateUniqueSerial } from './serialGenerator';
import * as assetsApi from '../api/assetsApi';

describe('serialGenerator Unit Tests', () => {
  it('generateSerialPattern should return string matching SN-[A-Z]{3}[0-9]{3}', () => {
    const serial = generateSerialPattern();
    expect(typeof serial).toBe('string');
    expect(serial).toMatch(/^SN-[A-Z]{3}[0-9]{3}$/);
  });

  it('generateSerialPattern should generate diverse strings across multiple calls', () => {
    const set = new Set();
    for (let i = 0; i < 20; i++) {
      set.add(generateSerialPattern());
    }
    expect(set.size).toBeGreaterThan(15);
  });

  it('generateUniqueSerial should return immediately if scanSerial throws 404 (unique)', async () => {
    vi.spyOn(assetsApi, 'scanSerial').mockRejectedValueOnce({ status: 404, message: 'No asset found' });

    const serial = await generateUniqueSerial();
    expect(serial).toMatch(/^SN-[A-Z]{3}[0-9]{3}$/);
    expect(assetsApi.scanSerial).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('generateUniqueSerial should retry if scanSerial returns existing asset on first attempt', async () => {
    const spy = vi.spyOn(assetsApi, 'scanSerial')
      .mockResolvedValueOnce({ data: { id: 10, serial_number: 'SN-ABC123' } }) // 1st collision
      .mockRejectedValueOnce({ status: 404, message: 'No asset found' });      // 2nd unique

    const serial = await generateUniqueSerial();
    expect(serial).toMatch(/^SN-[A-Z]{3}[0-9]{3}$/);
    expect(spy).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});
