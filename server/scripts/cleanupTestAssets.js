require('dotenv').config();
const db = require('../db');

const DRY_RUN = process.argv.includes('--dry-run');

async function runCleanup() {
  console.log(`Starting cleanup script...${DRY_RUN ? ' (DRY RUN)' : ''}`);
  
  const client = await db.pool.connect();
  try {
    if (!DRY_RUN) {
      await client.query('BEGIN');
    }
    
    // The explicit query based on user instructions
    const selectQuery = `
      SELECT id, name, serial_number, status
      FROM assets
      WHERE name IN ('MacBook Pro M2', 'Dell XPS 15')
      AND status = 'available'
    `;
    
    const { rows: assetsToDelete } = await client.query(selectQuery);
    
    console.log(`Found ${assetsToDelete.length} matching test assets:`);
    assetsToDelete.forEach(a => {
      console.log(`- ID: ${a.id} | Name: ${a.name} | Serial: ${a.serial_number} | Status: ${a.status}`);
    });
    
    if (assetsToDelete.length > 0) {
      if (DRY_RUN) {
        console.log(`\\n[DRY RUN] Would delete ${assetsToDelete.length} rows.`);
      } else {
        const deleteQuery = `
          DELETE FROM assets
          WHERE name IN ('MacBook Pro M2', 'Dell XPS 15')
          AND status = 'available'
        `;
        const deleteResult = await client.query(deleteQuery);
        console.log(`\\n[REAL RUN] Successfully deleted ${deleteResult.rowCount} rows.`);
      }
    } else {
      console.log('\\nNo matching assets found to delete.');
    }
    
    if (!DRY_RUN) {
      await client.query('COMMIT');
    }
  } catch (err) {
    if (!DRY_RUN) {
      await client.query('ROLLBACK');
    }
    console.error('Error during cleanup:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

runCleanup();
