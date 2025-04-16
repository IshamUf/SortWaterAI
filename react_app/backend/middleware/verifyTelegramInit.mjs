// backend/middleware/verifyTelegramInit.mjs
import crypto from "crypto";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
console.log(">>> TELEGRAM_BOT_TOKEN:", BOT_TOKEN);

if (!BOT_TOKEN) {
  throw new Error("Set TELEGRAM_BOT_TOKEN in .env");
}

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) return res.status(401).json({ error: "No initData" });

  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  console.log(">>> clientHash:", hash);
  if (!hash) return res.status(401).json({ error: "No hash" });

  // Строим data_check_string
  params.delete("hash");
  const dataCheck = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  console.log(">>> dataCheck:\n", dataCheck);

  // Вычисляем хеш через обычный sha256 (НЕ HMAC)
  const calcHash = crypto.createHash("sha256").update(dataCheck).digest("hex");
  console.log(">>> calcHash:", calcHash);

  if (calcHash !== hash) {
    console.error(">>> Signature mismatch!");
    return res.status(401).json({ error: "Bad signature" });
  }

  // Если всё ок — парсим user и ищем/создаём
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
