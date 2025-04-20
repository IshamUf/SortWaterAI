// backend/sockets/verifyTelegramInitSocket.mjs
import { validate, parse } from "@telegram-apps/init-data-node";
import jwt from "jsonwebtoken";
import slugify from "slugify";
import User from "../models/User.mjs";

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_TTL    = process.env.JWT_TTL || "1h";

export default async function verifyInitData(socket, next) {
  /* если middleware verifyToken уже присвоил socket.user — просто продолжаем */
  if (socket.user) return next();

  const raw = socket.handshake.auth?.initData;
  if (!raw) return next(new Error("no_initData"));

  try {
    /* 1. Проверяем подпись Telegram */
    validate(raw, BOT_TOKEN);
    const data = parse(raw);

    /* 2. Фильтруем username, чтобы предотвратить XSS/HTML‑tricks */
    const safeUsername =
      data.user.username
        ? slugify(data.user.username, { lower: true, strict: true })
        : `${slugify(data.user.first_name || "tg", { lower: true, strict: true })}_${data.user.id}`;

    /* 3. Создаём / получаем пользователя */
    const [user] = await User.findOrCreate({
      where: { telegram_id: String(data.user.id) },
      defaults: { telegram_id: String(data.user.id), username: safeUsername },
    });

    /* 4. JWT на 1 час */
    const token = jwt.sign(
      { sub: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_TTL }
    );

    socket.user = user;
    socket.emit("auth:token", token);
    next();
  } catch (err) {
    console.error("initData validation failed:", err);
    next(new Error("init_invalid"));
  }
}
