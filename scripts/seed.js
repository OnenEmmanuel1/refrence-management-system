const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'refertrack_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'refertrack_db',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  multipleStatements: true
};

async function seed() {
  let pool;
  try {
    const bootstrap = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    await bootstrap.end();

    pool = mysql.createPool(dbConfig);
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    const seedSql = fs.readFileSync(path.join(__dirname, '..', 'seed.sql'), 'utf8');

    await pool.query(schemaSql);
    await pool.query(seedSql);
    console.log('Database schema applied and seed data loaded.');
  } finally {
    if (pool) await pool.end();
  }
}

seed().catch((err) => {
  console.error('Database seeding failed:', err.message);
  process.exitCode = 1;
});
