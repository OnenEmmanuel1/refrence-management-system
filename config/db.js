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

let pool;

async function connectWithRetry(retries = 10, delay = 4000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Connecting to database (attempt ${i + 1}/${retries})...`);

      // Create a temporary connection to verify and ensure DB exists
      const conn = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port,
        multipleStatements: true
      });
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
      await conn.end();

      // Setup the pool
      pool = mysql.createPool(dbConfig);

      // Retrieve a test connection
      const testConn = await pool.getConnection();
      console.log('Database connection pool established successfully.');
      testConn.release();

      // Automatically check/load schema and seed data
      await autoInitialize();

      return pool;
    } catch (err) {
      console.error(`Database connection failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error('Database connection failed after maximum retries.');
}

async function autoInitialize() {
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'users'");
    if (rows.length === 0) {
      console.log('Database tables not found. Initializing schema...');
      const schemaPath = path.join(__dirname, '..', 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('Schema initialized successfully.');

      const seedPath = path.join(__dirname, '..', 'seed.sql');
      if (fs.existsSync(seedPath)) {
        console.log('Seeding database...');
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await pool.query(seedSql);
        console.log('Database seeded successfully.');
      }
    } else {
      console.log('Database tables verified.');
    }
  } catch (err) {
    console.error('Error during database auto-initialization:', err);
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call connectWithRetry first.');
  }
  return pool;
}

module.exports = {
  connectWithRetry,
  getPool
};
