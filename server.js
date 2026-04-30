const express = require('express');
const { Telegraf } = require('telegraf');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;
let siteEnabled = true;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

// Telegram Bot Setup
const botToken = process.env.TELEGRAM_BOT_TOKEN || '8231745752:AAHfWkyN70yJBbUdlXxXsWu47JifNMtJGTE'; // Set your bot token in environment or replace here
const ownerChatId = process.env.TELEGRAM_CHAT_ID || '5968641533'; // Set your chat ID in environment or replace here
const bot = new Telegraf(botToken);

const useWebhook = false;
console.log('Using polling for Telegram');

function encodeCallbackData(email) {
  return Buffer.from(email, 'utf8').toString('base64url');
}

function decodeCallbackData(encoded) {
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, 'base64url').toString('utf8');
  } catch (error) {
    return encoded;
  }
}

// Database Setup
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter, { users: [] });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize DB
async function initDB() {
  await db.read();
  if (!db.data.users) db.data.users = [];
  await db.write();
}
initDB();

// Routes
app.post('/signup', async (req, res) => {
  if (!siteEnabled) return res.status(503).json({ error: 'الموقع مغلق حالياً' });
  let { name, last, email, password } = req.body;
  if (!name || !last || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  email = email.toString().trim().toLowerCase();

  const existingUser = db.data.users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const user = {
    name,
    last,
    email,
    password: hashPassword(password),
    status: 'new',
    pkg: null,
    price: 0,
    type: 'normal',
    paymentProof: null,
    createdAt: new Date().toISOString()
  };

  db.data.users.push(user);
  await db.write();
  res.json({ message: 'تم التسجيل بنجاح. سجل دخول الآن', user });
});

app.post('/register', upload.single('paymentProof'), async (req, res) => {
  if (!siteEnabled) return res.status(503).json({ error: 'الموقع مغلق حالياً' });
  let { email, contactInfo, planType, paymentNote } = req.body;
  const paymentProof = req.file;

  if (!email || !contactInfo || !planType || !paymentProof) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  email = email.toString().trim().toLowerCase();

  const user = db.data.users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.status = 'pending';
  user.pkg = planType;
  user.price = planType === 'يومي' ? 10 : planType === 'أسبوعي' ? 25 : planType === 'شهري' ? 69 : planType === 'سنوي' ? 150 : 0;
  user.contactInfo = contactInfo;
  user.paymentNote = paymentNote || '';
  user.paymentProof = paymentProof.filename;
  user.pendingAt = new Date().toISOString();
  await db.write();

  if (botToken !== 'YOUR_TELEGRAM_BOT_TOKEN') {
    user.requestType = 'payment';
    user.pendingAt = new Date().toISOString();
    await db.write();
    const message = `طلب دفع جديد\n\n👤 الاسم: ${user.name} ${user.last}\n📧 الايميل: ${email}\n🕒 سجل في: ${formatDate(user.createdAt)}\n📦 الباقة: ${planType}\n📱 تواصل: ${contactInfo}\n📝 ملاحظة: ${paymentNote || 'لا يوجد'}`;
    try {
      await bot.telegram.sendPhoto(ownerChatId, { source: path.join(__dirname, 'uploads', paymentProof.filename) }, {
        caption: message,
        reply_markup: makeRequestKeyboard(email)
      });
    } catch (error) {
      console.error('Error sending to Telegram:', error);
    }
  }

  res.json({ message: 'تم إرسال الطلب. انتظر موافقة الأدمن.' });
});

app.post('/agent-request', async (req, res) => {
  if (!siteEnabled) return res.status(503).json({ error: 'الموقع مغلق حالياً' });
  let { email, contactInfo, agentId, message } = req.body;
  if (!email || !contactInfo || !agentId) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  email = email.toString().trim().toLowerCase();

  const user = db.data.users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.status = 'agent-pending';
  user.type = 'agent';
  user.pkg = 'وكيل معتمد';
  user.agentId = agentId;
  user.contactInfo = contactInfo;
  user.agentMessage = message || '';
  user.requestedAt = new Date().toISOString();
  await db.write();

  if (botToken !== 'YOUR_TELEGRAM_BOT_TOKEN') {
    user.requestType = 'agent';
    user.requestedAt = new Date().toISOString();
    await db.write();
    const caption = `طلب وكيل جديد\n\n👤 الاسم: ${user.name} ${user.last}\n📧 الايميل: ${email}\n🕒 سجل في: ${formatDate(user.createdAt)}\n🆔 ID الوكيل: ${agentId}\n📱 تواصل: ${contactInfo}\n📝 ملاحظة: ${message || 'لا يوجد'}`;
    try {
      await bot.telegram.sendMessage(ownerChatId, caption, { reply_markup: makeRequestKeyboard(email) });
    } catch (error) {
      console.error('Error sending agent request to Telegram:', error);
    }
  }

  res.json({ message: 'تم إرسال طلب البوت. انتظر الموافقة.' });
});

app.post('/status', async (req, res) => {
  let { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  email = email.toString().trim().toLowerCase();

  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ user });
});

app.post('/login', async (req, res) => {
  if (!siteEnabled) return res.status(503).json({ error: 'الموقع مغلق حالياً' });
  let { email, password } = req.body;
  email = email.toString().trim().toLowerCase();
  const user = db.data.users.find(u => u.email === email);

  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'بيانات خاطئة' });
  }

  res.json({ message: 'Login successful', user });
});

function makeControlKeyboard(email) {
  email = email.toString().trim().toLowerCase();
  const payload = encodeCallbackData(email);
  return {
    inline_keyboard: [
      [{ text: 'قبول', callback_data: `accept:${payload}` }, { text: 'رفض', callback_data: `reject:${payload}` }],
      [{ text: 'إيقاف الشخص', callback_data: `stop:${payload}` }, { text: 'تشغيل الشخص', callback_data: `start:${payload}` }]
    ]
  };
}

function makeRequestKeyboard(email) {
  return makeControlKeyboard(email);
}

function buildAdminCaption(user, action, extra = '') {
  const createdAt = formatDate(user.createdAt);
  const packageInfo = user.pkg || 'لم يتم اختيار باقة بعد';
  const statusText = action === 'accept' ? 'مفعل' : action === 'reject' ? 'مرفوض' : action === 'stop' ? 'موقوف' : 'قيد المراجعة';
  return `🔔 ${action === 'accept' ? 'تم القبول' : action === 'reject' ? 'تم الرفض' : action === 'stop' ? 'تم الإيقاف' : 'طلب جديد'}

👤 الاسم: ${user.name} ${user.last}
📧 الايميل: ${user.email}
🕒 سجل في: ${createdAt}
📦 الباقة: ${packageInfo}
📌 الحالة: ${statusText}
${extra}`;
}

async function updateTelegramMessage(ctx, text, replyMarkup) {
  const message = ctx.callbackQuery.message;
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;
  if (!chatId || !messageId) return;
  const hasMedia = !!(message.photo || message.document || message.video || message.animation || message.audio);
  if (hasMedia) {
    return ctx.telegram.editMessageCaption(chatId, messageId, undefined, text, { reply_markup: replyMarkup });
  }
  return ctx.telegram.editMessageText(chatId, messageId, undefined, text, { reply_markup: replyMarkup });
}

// Telegram Bot Handlers
bot.on('callback_query', async (ctx) => {
  try {
    console.log('Callback received:', ctx.callbackQuery.data);
    const data = ctx.callbackQuery.data;
    const [action, payloadEncoded] = data.includes(':') ? data.split(':') : data.split('_');
    let email = decodeCallbackData(payloadEncoded);
    if (!email && payloadEncoded) email = payloadEncoded;
    console.log('Action:', action, 'Email:', email);
    const message = ctx.callbackQuery.message;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;

  if (!chatId || !messageId) {
    await ctx.answerCbQuery('لا يمكن تحديث الرسالة');
    return;
  }

  if (!email) {
    await ctx.answerCbQuery('بيانات غير صالحة');
    return;
  }

  if (action === 'stop' || action === 'start') {
    const user = db.data.users.find(u => u.email === email);
    if (!user) {
      console.log('Callback user not found for stop/start:', email);
      return ctx.answerCbQuery('المستخدم غير موجود');
    }

    if (action === 'stop') {
      user.status = 'blocked';
      await db.write();
      await ctx.answerCbQuery('تم إيقاف المستخدم');
      return updateTelegramMessage(ctx, buildAdminCaption(user, 'stop', `🔴 المستخدم موقوف الآن وسيشاهد الباقات فقط.`), makeControlKeyboard(email));
    }
    if (action === 'start') {
      user.status = 'active';
      await db.write();
      await ctx.answerCbQuery('تم تشغيل المستخدم');
      return updateTelegramMessage(ctx, buildAdminCaption(user, 'accept', `🟢 المستخدم مفعل الآن ويمكنه التداول.`), makeControlKeyboard(email));
    }
  }

  const user = db.data.users.find(u => u.email === email);
  if (!user) return ctx.answerCbQuery('المستخدم غير موجود');

  if (action === 'accept') {
    user.status = 'active';
    await db.write();
    await ctx.answerCbQuery('تم القبول');
    return updateTelegramMessage(ctx, buildAdminCaption(user, 'accept', `🟢 المستخدم مفعل الآن ويمكنه التداول.`), makeControlKeyboard(email));
  }

  if (action === 'reject') {
    user.status = 'rejected';
    await db.write();
    await ctx.answerCbQuery('تم الرفض');
    return updateTelegramMessage(ctx, buildAdminCaption(user, 'reject', `🔴 المستخدم مرفوض ولن يتمكن من المتابعة.`), makeControlKeyboard(email));
  }

  await ctx.answerCbQuery('الإجراء غير معروف');
  return;
  } catch (error) {
    console.error('Callback processing error:', error);
    try {
      await ctx.answerCbQuery('حدث خطأ أثناء المعالجة');
    } catch (e) {
      console.error('Failed to answer callback:', e);
    }
  }
});

// Start Bot
if (botToken !== 'YOUR_TELEGRAM_BOT_TOKEN') {
  bot.launch().catch(err => console.log('Bot launch failed:', err.message));
} else {
  console.log('Telegram Bot not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.');
}

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});