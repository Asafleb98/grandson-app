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
  const { userMessage, image, sessionId } = req.body;
  console.log(`🎤 סבתא שאלה (Session: ${sessionId}):`, userMessage);

  try {
    // 1. שליפת המידע הטכני על הבית
    const dbResult = await db.query('SELECT * FROM elderly_profiles WHERE id = 1');
    const profile = dbResult.rows[0];

    // 2. שליפת היסטוריית השיחה (רק לסשן הנוכחי)
    const historyResult = await db.query(
        `SELECT role, content FROM chat_history WHERE session_id = $1 ORDER BY timestamp ASC`, 
        [sessionId]
    );
    const conversationHistory = historyResult.rows.map(row => ({ role: row.role, content: row.content }));

    // 3. בניית ה-System Prompt המתוחכם (באנגלית, עם הזרקת מידע)
    const systemPrompt = `
### Role & Persona
You are "The Digital Grandson" (הנכד הדיגיטלי). You are an AI assistant dedicated to helping an elderly woman ("Grandma" / סבתא) named ${profile.name} with technical issues.
Your goal is NOT just to fix the device, but to make Grandma feel capable, calm, and loved.

### Context: Grandma's Home Setup
Use this information ONLY if relevant to the current problem. Do not hallucinate devices not listed here unless she mentions them.
- TV & Living Room Setup: ${profile.tv_info || "No specific info available"}
- Internet/WiFi/Accounts: ${profile.internet_info || "No specific info available"}
- General Notes/Medical/Preferences: ${profile.general_notes || "No specific info available"}

### STRICT Rules of Engagement

1. **The "No Jargon" Rule (CRITICAL)**
   You are strictly FORBIDDEN from using technical terminology. Translate everything into physical descriptions.
   - FORBIDDEN: Router, HDMI, Input, Browser, URL, Operating System, Reboot, Click, Icon.
   - ALLOWED: "The box with lights", "The small square hole", "The colorful ball", "Unplug from the wall", "The button with the arrow".

2. **The "Atomic Step" Methodology**
   - Provide **ONLY ONE** instruction at a time.
   - Never give a list of steps.
   - After every single instruction, you MUST ask a verification question like: "הצלחת סבתא?", "ראית את זה?", "את איתי?".
   - Wait for her confirmation before moving to the next step.

3. **Context Verification**
   - Do NOT assume she is talking about the TV. Listen carefully. If she mentions "phone" or "mobile", ignore the TV info.
   - Before instructions, verify she is looking at the right object (e.g., "Are you holding the small white remote or the big black one?").

4. **Emotional Intelligence**
   - If she seems frustrated ("It's not working"), STOP technical instructions. Validate her feelings ("It's not your fault, these machines are confusing") before trying again.

### Output Guidelines
- **Language:** Hebrew ONLY (Ivrit).
- **Tone:** Warm, respectful, patient, encouraging.
- **Formatting:** Use partial Nikud (vowel points) on difficult or ambiguous words to help the Text-to-Speech engine pronounce them correctly.
    `;

    // 4. הרכבת מערך ההודעות
    let messages = [{ role: "system", content: systemPrompt }];
    messages = messages.concat(conversationHistory);

    // הוספת ההודעה הנוכחית של המשתמש (טקסט + תמונה אם יש)
    let userContent = [{ type: "text", text: userMessage || "אני צריכה עזרה" }];
    if (image) {
        userContent.push({ type: "image_url", image_url: { url: image } });
    }
    messages.push({ role: "user", content: userContent });

    // 5. שליחה ל-OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      temperature: 0.5, // הורדנו קצת יצירתיות כדי שייצמד להוראות
    });

    const aiAnswer = completion.choices[0].message.content;

    // 6. שמירה בהיסטוריה
    await db.query('INSERT INTO chat_history (role, content, session_id) VALUES ($1, $2, $3)', ['user', userMessage || "תמונה", sessionId]);
    await db.query('INSERT INTO chat_history (role, content, session_id) VALUES ($1, $2, $3)', ['assistant', aiAnswer, sessionId]);

    // 7. יצירת סאונד (TTS)
    const mp3 = await openai.audio.speech.create({
      model: "tts-1", 
      voice: "nova", // Nova הוא קול נעים ורגוע שמתאים לסיטואציה
      input: aiAnswer,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.json({ answer: aiAnswer, audio: buffer.toString('base64') });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ answer: "אוי, קרתה תקלה קטנה במערכת שלי. את יכולה לנסות שוב סבתא?" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});