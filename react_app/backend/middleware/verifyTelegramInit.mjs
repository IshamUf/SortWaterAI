import crypto from "crypto";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN in env");

const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  if (!raw) return res.status(401).json({ error: "No initData" });

  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) return res.status(401).json({ error: "No hash in initData" });

  // Собираем check_string
  params.delete("hash");
  const dataCheck = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const calcHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheck)
    .digest("hex");

  if (calcHash !== hash) return res.status(401).json({ error: "Bad signature" });

  // Декодируем user и upsert в БД
  const userJson = JSON.parse(decodeURIComponent(params.get("user")));
  const [user] = await User.findOrCreate({
    where: { telegram_id: String(userJson.id) },
    defaults: {
      telegram_id: String(userJson.id),
      username: userJson.username || `${userJson.first_name || "Player"}_${userJson.id}`,
      coins: 0,
    },
  });

  req.user = user;
  next();
}
