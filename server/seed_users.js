const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function seedUsers() {
  try {
    await client.connect();
    const saltRounds = 10;
    const placeholderPasswordHash = await bcrypt.hash('password123', saltRounds);

    const users = [
      { email: 'admin@company.com', passwordHash: placeholderPasswordHash, role: 'admin', employeeId: null },
      { email: 'employee@company.com', passwordHash: placeholderPasswordHash, role: 'employee', employeeId: 4 }, // linked to Arjun Rao
      { email: 'hr@company.com', passwordHash: placeholderPasswordHash, role: 'hr', employeeId: null }
    ];
    
    for (const u of users) {
      await client.query(
        `INSERT INTO users (email, password_hash, role, employee_id) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
        [u.email, u.passwordHash, u.role, u.employeeId]
      );
    }
    console.log('3 Users created/verified successfully.');
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
seedUsers();
