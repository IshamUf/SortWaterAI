// backend/middleware/verifyTelegramInit.mjs
import crypto from "crypto";
import User   from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN in env");

const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();

export default async function verifyTelegramInit(req, res, next) {
  // Raw initData из query или заголовка
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) return res.status(401).json({ error: "No initData" });

  const params = new URLSearchParams(raw);
  const hash   = params.get("hash");
  console.log(">>> hash from client:", hash);
  if (!hash) return res.status(401).json({ error: "No hash" });

  // Собираем строку для подписи
  params.delete("hash");
  const dataCheck = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  console.log(">>> dataCheck string:\n", dataCheck);

  // Вычисляем HMAC
  const calcHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheck)
    .digest("hex");
  console.log(">>> calcHash:", calcHash);

  if (calcHash !== hash) {
    console.error("❌ Bad signature");
    return res.status(401).json({ error: "Bad signature" });
  }

  // Всё ок — создаём/ищем пользователя
  const userJson = JSON.parse(decodeURIComponent(params.get("user")));
  console.log(">>> user payload:", userJson);
  const [user] = await User.findOrCreate({
    where: { telegram_id: String(userJson.id) },
    defaults: {
      telegram_id: String(userJson.id),
      username:    userJson.username || `${userJson.first_name}_${userJson.id}`,
      coins:       0,
    },
  });

  req.user = user;
  next();
}
