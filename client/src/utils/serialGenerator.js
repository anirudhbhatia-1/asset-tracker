import { checkSerialExists } from '../api/assetsApi';

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
 * Generates a serial and checks uniqueness via GET /api/assets/serial-exists.
 * Retries on collision. Throws if no unused serial could be confirmed (e.g. the
 * check keeps failing) rather than returning an unchecked one.
 */
export async function generateUniqueSerial(maxRetries = 10) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const candidate = generateSerialPattern();
    try {
      if (!(await checkSerialExists(candidate))) {
        return candidate;
      }
    } catch (err) {
      lastError = err;
    }
  }
  const error = new Error(
    lastError
      ? (lastError.response?.data?.message || lastError.message || 'Could not check serial uniqueness')
      : 'Could not find an unused serial number'
  );
  error.cause = lastError;
  throw error;
}
