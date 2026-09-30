import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSerialPattern, generateUniqueSerial } from './serialGenerator';
import { checkSerialExists } from '../api/assetsApi';

vi.mock('../api/assetsApi', () => ({
  checkSerialExists: vi.fn(),
}));

describe('serialGenerator Unit Tests', () => {
  beforeEach(() => {
    vi.mocked(checkSerialExists).mockReset();
  });

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

  it('generateUniqueSerial should return immediately when the serial is unused', async () => {
    vi.mocked(checkSerialExists).mockResolvedValueOnce(false);

    const serial = await generateUniqueSerial();
    expect(serial).toMatch(/^SN-[A-Z]{3}[0-9]{3}$/);
    expect(checkSerialExists).toHaveBeenCalledTimes(1);
    expect(checkSerialExists).toHaveBeenCalledWith(serial);
  });

  it('generateUniqueSerial should retry on collision', async () => {
    vi.mocked(checkSerialExists)
      .mockResolvedValueOnce(true)   // 1st collision
      .mockResolvedValueOnce(false); // 2nd unique

    const serial = await generateUniqueSerial();
    expect(serial).toMatch(/^SN-[A-Z]{3}[0-9]{3}$/);
    expect(checkSerialExists).toHaveBeenCalledTimes(2);
  });

  it('generateUniqueSerial should recover from a transient check error', async () => {
    vi.mocked(checkSerialExists)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(false);

    await expect(generateUniqueSerial()).resolves.toMatch(/^SN-[A-Z]{3}[0-9]{3}$/);
    expect(checkSerialExists).toHaveBeenCalledTimes(2);
  });

  it('generateUniqueSerial should throw with the server message when checks keep failing', async () => {
    vi.mocked(checkSerialExists).mockRejectedValue({
      message: 'Request failed with status code 403',
      response: { data: { message: 'Forbidden' } },
    });

    await expect(generateUniqueSerial(3)).rejects.toThrow('Forbidden');
    expect(checkSerialExists).toHaveBeenCalledTimes(3);
  });

  it('generateUniqueSerial should throw when every candidate collides', async () => {
    vi.mocked(checkSerialExists).mockResolvedValue(true);

    await expect(generateUniqueSerial(2)).rejects.toThrow('Could not find an unused serial number');
  });
});
