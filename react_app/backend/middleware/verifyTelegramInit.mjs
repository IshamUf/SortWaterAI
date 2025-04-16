// backend/middleware/verifyTelegramInit.mjs
import crypto from "crypto";
import User   from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("У тебя не задан TELEGRAM_BOT_TOKEN в окружении");

const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) {
    console.warn("нет initData");
    return res.status(401).json({ error: "No initData" });
  }

  const params = new URLSearchParams(raw);
  const hash   = params.get("hash");
  console.log(">>> hash from client:", hash);
  if (!hash) {
    console.warn("нет hash");
    return res.status(401).json({ error: "No hash in initData" });
  }

  params.delete("hash");
  const dataCheck = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  console.log(">>> dataCheck string:\n", dataCheck);

  const calcHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheck)
    .digest("hex");
  console.log(">>> calcHash:", calcHash);

  if (calcHash !== hash) {
    console.error("Bad signature — подписи не совпадают");
    return res.status(401).json({ error: "Bad signature" });
  }

  // подпись ок — теперь создаём/ищем пользователя
  const userJson = JSON.parse(decodeURIComponent(params.get("user")));
  const [user] = await User.findOrCreate({
    where: { telegram_id: String(userJson.id) },
    defaults: {
      telegram_id: String(userJson.id),
      username:    userJson.username || `${userJson.first_name || "Player"}_${userJson.id}`,
      coins:       0,
    },
  });

  req.user = user;
  next();
}
