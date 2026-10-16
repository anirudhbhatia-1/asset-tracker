const fs = require('fs');
const path = require('path');
const logger = require('../logger');

// Where multer puts uploaded import files until the import handler deletes
// them (routes/assets.js).
const UPLOAD_TMP_DIR = path.join(__dirname, '../tmp');
// Older than any import could still be running.
const STALE_AFTER_MS = 60 * 60 * 1000;

/**
 * Deletes upload files left behind by a crash mid-import. Runs at start-up;
 * a missing folder is fine. Returns how many files were removed.
 */
const sweepUploadTmp = (dir = UPLOAD_TMP_DIR, now = Date.now()) => {
  let removed = 0;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name);
    try {
      if (now - fs.statSync(file).mtimeMs > STALE_AFTER_MS) {
        fs.unlinkSync(file);
        removed += 1;
      }
    } catch (err) {
      logger.warn({ err: err.message, file: entry.name }, 'Could not remove leftover upload');
    }
  }
  if (removed) logger.info({ removed }, 'Removed leftover upload files');
  return removed;
};

module.exports = { sweepUploadTmp, UPLOAD_TMP_DIR };
