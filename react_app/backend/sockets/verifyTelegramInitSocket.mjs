// backend/sockets/verifyTelegramInitSocket.mjs
import { validate, parse } from "@telegram-apps/init-data-node";
import jwt from "jsonwebtoken";
import User from "../models/User.mjs";

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_TTL    = process.env.JWT_TTL || "1h";

export default async function verifyInitData(socket, next) {
  if (socket.user) return next(); // уже авторизован через token

  const raw = socket.handshake.auth?.initData;
  if (!raw) return next(new Error("no_initData"));

  try {
    validate(raw, BOT_TOKEN);
    const data = parse(raw);

    const [user] = await User.findOrCreate({
      where: { telegram_id: String(data.user.id) },
      defaults: {
        telegram_id: String(data.user.id),
        username:
          data.user.username ?? `${data.user.first_name}_${data.user.id}`,
      },
    });

    // генерируем JWT
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
