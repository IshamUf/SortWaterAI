// backend/middleware/verifyTelegramInit.mjs
import crypto from "crypto";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
console.log(">>> TELEGRAM_BOT_TOKEN:", BOT_TOKEN);

if (!BOT_TOKEN) {
  throw new Error("Set TELEGRAM_BOT_TOKEN in env");
}

const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) return res.status(401).json({ error: "No initData" });

  const params = new URLSearchParams(raw);
  const signature = params.get("signature");
  const hash = params.get("hash");
  console.log(">>> clientHash:", hash);
  if (!hash || !signature) return res.status(401).json({ error: "No hash/signature in initData" });

  // Собираем checkString: все параметры кроме hash, в отсортированном виде
  params.delete("hash");
  params.delete("signature");
  const dataCheck = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  console.log(">>> dataCheck:\n", dataCheck);

  const calcHmac = crypto.createHmac("sha256", secretKey).update(dataCheck).digest("hex");
  console.log(">>> calcHash:", calcHmac);

  if (calcHmac !== hash) {
    console.error(">>> Signature mismatch!");
    return res.status(401).json({ error: "Bad signature" });
  }

  // Если всё ок — парсим user и создаём/ищем запись в БД
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
