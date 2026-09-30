const { defineConfig } = require('vitest/config');

// Integration tests share one database (and its sessions), so run test files
// one at a time to keep them from interfering with each other.
module.exports = defineConfig({
  test: {
    fileParallelism: false,
  },
});
