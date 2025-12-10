require('dotenv').config();
const { Pool } = require('pg');

const isProduction = process.env.DATABASE_URL.includes('neon.tech');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Error executing query', err.stack);
    }
    console.log(isProduction ? '✅ Connected to NEON (Cloud)!' : '✅ Connected to LOCAL DB!');
  });
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};