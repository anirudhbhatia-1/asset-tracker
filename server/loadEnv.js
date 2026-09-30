const path = require('path');

// Settings live in server/.env. Load it by absolute path so it is found no
// matter which directory the process starts in (PM2's ecosystem.config.js
// runs from the repository root). A .env in the working directory is still
// read as a fallback, and variables already set by the host always win.
require('dotenv').config({
  path: [path.join(__dirname, '.env'), path.resolve(process.cwd(), '.env')],
  quiet: true,
});
