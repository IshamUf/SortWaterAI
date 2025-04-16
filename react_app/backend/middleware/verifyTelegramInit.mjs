// backend/middleware/verifyTelegramInit.mjs
import { validate, parse } from '@telegram-apps/init-data-node';
import crypto from 'crypto';
import User from '../models/User.mjs';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('Set TELEGRAM_BOT_TOKEN');

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get('X-TG-Init-Data');
  if (!raw) return res.status(401).json({ error: 'No initData' });

  try {
    validate(raw, BOT_TOKEN);
    const initData = parse(raw);
    // нашли или создали пользователя в БД
    const [user] = await User.findOrCreate({
      where: { telegram_id: String(initData.user.id) },
      defaults: {
        telegram_id: String(initData.user.id),
        username: initData.user.username ?? `${initData.user.first_name}_${initData.user.id}`,
        coins: 0,
        last_daily_reward: null,
      },
    });
    req.user = user;          // теперь это Sequelize‐instance!
    next();
  } catch (err) {
    console.error('Validation error:', err);
    res.status(401).json({ error: 'Invalid initData' });
  }
}
