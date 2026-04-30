# BullRuniX Trading Website

This is a trading signals website with Telegram Bot integration for admin approval.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Telegram Bot:
   - Create a bot with @BotFather on Telegram.
   - Get the bot token.
   - Send a message إلى البوت ثم استخدم الرابط التالي للحصول على التحديثات:
     `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`

3. Set environment variables:
   - `TELEGRAM_BOT_TOKEN`: Your bot token.
   - `TELEGRAM_CHAT_ID`: Your chat ID.

   يمكنك تعديل `server.js` مباشرة إذا لم تكن تستخدم متغيرات بيئة.

4. Run the server locally:
   ```bash
   npm start
   ```

5. Open the site in browser:
   ```text
   http://127.0.0.1:3000/index.html
   ```

## Features

- واجهة تسجيل دخول وحسابات.
- رفع إثبات الدفع.
- إشعارات Telegram مع أزرار قبول/رفض/إيقاف الشخص/تشغيل الشخص.
- الصفحة تتحدث تلقائياً عند تغيير حالة المستخدم من الأدمن.
- التحكم والتفعيل عبر Telegram فقط.

## Final upload files

ارفع هذه الملفات فقط:
- `index.html`
- `server.js`
- `package.json`
- `package-lock.json`
- `db.json` (إذا أردت حفظ بيانات المستخدم)
- `DOOT.png` أو أي صورة مستخدمة
- `uploads/` إذا كانت تحتوي على ملفات الدفع
- `README.md`
- `.gitignore`

## Hosting without تشغيل الحاسوب

يمكنك استخدام خدمة مجانية مثل:
- Railway.app
- Render.com
- Fly.io

لا ترفع `node_modules`.

## Important

- إذا رفعت المشروع على خدمة استضافة، فإن `BACKEND_URL` يعمل تلقائياً كمسار نسبي.
- فقط شغّل السيرفر من خلال الأمر `npm start`.
- صفحة الموقع والمكالمات تعمل بشكل صحيح بعد رفعه.
