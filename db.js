require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // מחקנו את ה-ssl שהיה כאן קודם
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
    console.log('✅ Connected to LOCAL PostgreSQL successfully!');
  });
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};