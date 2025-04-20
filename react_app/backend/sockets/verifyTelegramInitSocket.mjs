// backend/sockets/verifyTelegramInitSocket.mjs
import { validate, parse } from "@telegram-apps/init-data-node";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN");

export default async function verifySocketAuth(socket, next) {
  try {
    const raw =
      socket.handshake.auth?.initData ||
      socket.handshake.headers["x-tg-init-data"];
    if (!raw) return next(new Error("No initData"));

    // проверяем подпись Telegram
    validate(raw, BOT_TOKEN);

    // парсим
    const initData = parse(raw);

    // ищем / создаём пользователя
    const [user] = await User.findOrCreate({
      where: { telegram_id: String(initData.user.id) },
      defaults: {
        telegram_id: String(initData.user.id),
        username:
          initData.user.username ??
          `${initData.user.first_name}_${initData.user.id}`,
      },
    });

    socket.user = user; // кладём в объект сокета
    next();
  } catch (err) {
    console.error("WS auth error:", err);
    next(new Error("Auth failed"));
  }
}
