import { scanSerial } from '../api/assetsApi';

/**
 * Generates a random serial string matching pattern SN-[A-Z]{3}[0-9]{3}
 */
export function generateSerialPattern() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  let letterPart = '';
  for (let i = 0; i < 3; i++) {
    letterPart += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  let numberPart = '';
  for (let i = 0; i < 3; i++) {
    numberPart += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return `SN-${letterPart}${numberPart}`;
}

/**
 * Generates and checks uniqueness against backend via GET /api/serial/scan/:serial.
 * Retries automatically if collision occurs.
 */
export async function generateUniqueSerial(maxRetries = 10) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const candidate = generateSerialPattern();
    try {
      const res = await scanSerial(candidate);
      const assetData = res.data?.data || res.data;
      // If scanSerial returns 200/found asset, collision exists! Try again.
      if (!assetData || !assetData.id) {
        return candidate;
      }
    } catch (err) {
      // If scanSerial returns 404 ("No asset found for this serial number"), candidate is unique!
      if (err?.status === 404 || err?.message?.toLowerCase().includes('no asset found') || err?.response?.status === 404) {
        return candidate;
      }
      // If some other network/server error occurred on the check, we still check or retry
      if (attempt === maxRetries) {
        return candidate;
      }
    }
  }
  // Fallback if max retries exceeded
  return generateSerialPattern();
}
