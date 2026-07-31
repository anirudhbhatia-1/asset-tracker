require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
  try {
    // Revoke from ravananirudh10@gmail.com (id 20)
    await pool.query("UPDATE employees SET role = NULL, password_hash = NULL WHERE id = 20");
    console.log("Revoked access from ravananirudh10@gmail.com");

    // Grant to anirudhbhatia@company.com (id 9)
    const tempPass = crypto.randomBytes(6).toString('hex');
    const hash = await bcrypt.hash(tempPass, 10);
    await pool.query("UPDATE employees SET role = 'employee', password_hash = $1 WHERE id = 9", [hash]);
    console.log("Granted access to anirudhbhatia@company.com with temporary password:", tempPass);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fix();
