import { validate, parse } from '@telegram-apps/init-data-node';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get('X-TG-Init-Data');
  if (!raw) return res.status(401).json({ error: 'No initData' });

  try {
    validate(raw, BOT_TOKEN);
    const initData = parse(raw);
    req.user = initData.user;
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(401).json({ error: 'Invalid initData' });
  }
}
