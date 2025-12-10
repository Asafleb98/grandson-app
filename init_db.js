const db = require('./db');

async function initDB() {
  try {
    // 1. יצירת טבלת הפרופילים (כמו קודם)
    await db.query(`
      CREATE TABLE IF NOT EXISTS elderly_profiles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        tv_info TEXT,
        internet_info TEXT,
        general_notes TEXT
      );
    `);
    console.log("✅ Table 'elderly_profiles' verified.");

    // 2. יצירת טבלה חדשה להיסטוריית השיחה 🆕
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Table 'chat_history' created/verified.");

    // בדיקה והכנסת נתונים ראשוניים לפרופיל (כמו קודם)
    const check = await db.query('SELECT * FROM elderly_profiles');
    if (check.rows.length === 0) {
      await db.query(`
        INSERT INTO elderly_profiles (name, tv_info, internet_info, general_notes)
        VALUES ($1, $2, $3, $4)
      `, [
        'סבתא רחל', 
        'טלוויזיה של סמסונג, ממיר של פרטנר TV (שלט עם כפתור נטפליקס)', 
        'ראוטר של בזק (קופסה לבנה עומדת בסלון)',
        'חסרת סבלנות, צריכה הוראות קצרות מאוד. רואה טוב.'
      ]);
      console.log("✅ Inserted initial data for Grandma Rachel.");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error initializing DB:", err);
    process.exit(1);
  }
}

initDB();