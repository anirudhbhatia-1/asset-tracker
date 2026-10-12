// Size limits for uploaded spreadsheets, on top of the upload size cap.
// A small .xlsx can expand enormously once unzipped, so before ExcelJS loads
// it every entry is actually inflated (the sizes a zip declares can be
// forged) and the real total checked; data rows are counted while they are
// read.
const fs = require('fs/promises');
const zlib = require('zlib');
const JSZip = require('jszip');

const MAX_SHEETS = 20;
const MAX_DATA_ROWS_PER_SHEET = 10000;
// Generous for 20 sheets of 10,000 rows; stops "zip bombs".
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

// `what` names the source: 'sheet "Laptops"' or 'CSV file'.
const tooManyRowsError = (what) => badRequest(
  `The ${what} has more than ${MAX_DATA_ROWS_PER_SHEET.toLocaleString('en-US')} data rows. `
  + 'Split it into smaller files and import them one at a time.'
);

const notAWorkbook = () => badRequest(
  'This file is not a valid .xlsx workbook. Save it from Excel as "Excel Workbook (.xlsx)" and try again.'
);
const tooLargeUnpacked = () => badRequest(
  'The workbook is too large to import once unpacked. Split it into smaller files and try again.'
);

// The entries of a zip file, read from its central directory:
// [{ name, method, data }] where `data` is the entry's compressed bytes.
const readZipEntries = (buffer) => {
  const EOCD = 0x06054b50;
  const CENTRAL = 0x02014b50;
  const LOCAL = 0x04034b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw notAWorkbook();
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL) throw notAWorkbook();
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL) throw notAWorkbook();
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    if (dataStart + compressedSize > buffer.length) throw notAWorkbook();
    entries.push({ name, method, data: buffer.subarray(dataStart, dataStart + compressedSize) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

// Inflates one entry, counting the bytes it really produces (nothing is
// kept) and stopping as soon as it passes `budget`. Returns the byte count.
const inflatedSize = (entry, budget) => {
  if (entry.method === 0) {
    if (entry.data.length > budget) throw tooLargeUnpacked();
    return Promise.resolve(entry.data.length);
  }
  if (entry.method !== 8) return Promise.reject(notAWorkbook());
  return new Promise((resolve, reject) => {
    let total = 0;
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      if (err) reject(err); else resolve(value);
    };
    const inflate = zlib.createInflateRaw();
    inflate.on('data', (chunk) => {
      total += chunk.length;
      if (total > budget) {
        finish(tooLargeUnpacked());
        inflate.destroy();
      }
    });
    inflate.on('error', () => finish(notAWorkbook()));
    inflate.on('end', () => finish(null, total));
    inflate.end(entry.data);
  });
};

// The real uncompressed size of the whole zip, failing once it passes
// maxBytes.
const checkRealUncompressedSize = async (buffer, maxBytes) => {
  let total = 0;
  for (const entry of readZipEntries(buffer)) {
    if (!entry.name.endsWith('/')) total += await inflatedSize(entry, maxBytes - total);
  }
  return total;
};

const checkXlsxStructure = async (filePath, limits = {}) => {
  const maxSheets = limits.maxSheets || MAX_SHEETS;
  const maxBytes = limits.maxUncompressedBytes || MAX_UNCOMPRESSED_BYTES;
  let zip;
  const buffer = await fs.readFile(filePath);
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw notAWorkbook();
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const sheetCount = entries.filter((entry) => /^xl\/worksheets\/[^/]+\.xml$/i.test(entry.name)).length;
  if (sheetCount > maxSheets) {
    throw badRequest(`The workbook has ${sheetCount} sheets; at most ${maxSheets} are allowed. Remove the sheets you don't need and try again.`);
  }
  // Declared sizes first (cheap, catches honest giants), then the real ones.
  // eslint-disable-next-line no-underscore-dangle
  const declared = entries.reduce((sum, entry) => sum + (entry._data?.uncompressedSize || 0), 0);
  if (declared > maxBytes) throw tooLargeUnpacked();
  const uncompressed = await checkRealUncompressedSize(buffer, maxBytes);
  return { sheetCount, uncompressedBytes: uncompressed };
};

// Call once per data row while reading a sheet; throws when the sheet
// passes the limit so reading stops there.
const createRowCounter = (what, maxRows = MAX_DATA_ROWS_PER_SHEET) => {
  let count = 0;
  return () => {
    count += 1;
    if (count > maxRows) throw tooManyRowsError(what);
    return count;
  };
};

module.exports = {
  MAX_SHEETS,
  MAX_DATA_ROWS_PER_SHEET,
  MAX_UNCOMPRESSED_BYTES,
  checkXlsxStructure,
  checkRealUncompressedSize,
  createRowCounter,
  tooManyRowsError,
};
