require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- ADMIN ROUTES ---
app.get('/api/profile', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM elderly_profiles WHERE id = 1');
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profile', async (req, res) => {
    const { tv_info, internet_info, general_notes } = req.body;
    try {
        await db.query(`UPDATE elderly_profiles SET tv_info = $1, internet_info = $2, general_notes = $3 WHERE id = 1`, [tv_info, internet_info, general_notes]);
        res.json({ message: "Updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- MAIN ROUTE ---
app.post('/api/ask', async (req, res) => {
  const { userMessage, image } = req.body;
  console.log("🎤 סבתא שאלה:", userMessage);

  try {
    const dbResult = await db.query('SELECT * FROM elderly_profiles WHERE id = 1');
    const profile = dbResult.rows[0];

    const historyResult = await db.query(`SELECT role, content FROM chat_history ORDER BY timestamp ASC LIMIT 6`);
    const conversationHistory = historyResult.rows.map(row => ({ role: row.role, content: row.content }));

    // --- שדרוג הפרומפט: אישיות חמה + ניקוד ---
    let systemPrompt = `
      אתה הנכד הדיגיטלי של ${profile.name}.
      
      תפקידך: לעזור בסבלנות אין-קץ בכל בעיה טכנית (טלוויזיה, טלפון, מחשב ועוד).
      
      מידע זמין בתיק האישי (השתמש רק אם רלוונטי):
      - ${profile.tv_info}
      - ${profile.internet_info}
      - ${profile.general_notes}
      
      הנחיות דיבור קריטיות (כדי שההקראה תהיה מושלמת):
      1. **נקד מילים בעייתיות!** (למשל: כתוב "תִּלְחֲצִי" ולא "תלחצי", "כַּבְּלִים" ולא "כבלים"). הניקוד עוזר להקראה להיות מדויקת.
      2. הימנע ממילים לועזיות מסובכות (כמו "Configuration"). תגיד "הגדרות".
      3. ענה תשובה קצרה, חמה ומרגיעה.
      4. תן הוראה אחת בלבד בכל פעם.
      5. סיים בשאלה בודקת: "הִצְלַחְתְּ?", "הִסְתַּדַּרְתְּ?".
    `;

    let messages = [{ role: "system", content: systemPrompt }];
    messages = messages.concat(conversationHistory);

    let userContent = [{ type: "text", text: userMessage || "מה זה?" }];
    if (image) {
        userContent.push({ type: "image_url", image_url: { url: image } });
    }
    messages.push({ role: "user", content: userContent });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
    });

    const aiAnswer = completion.choices[0].message.content;
    console.log("🤖 הנכד ענה:", aiAnswer);

    await db.query('INSERT INTO chat_history (role, content) VALUES ($1, $2)', ['user', userMessage || "תמונה"]);
    await db.query('INSERT INTO chat_history (role, content) VALUES ($1, $2)', ['assistant', aiAnswer]);

    // --- יצירת אודיו עם הקול החדש ---
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova", // שינינו מ-onyx ל-nova (קול נשי נעים)
      input: aiAnswer,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.json({ answer: aiAnswer, audio: buffer.toString('base64') });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ answer: "תקלה במערכת" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});