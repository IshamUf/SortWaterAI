import crypto from "crypto";
import User from "../models/User.mjs";

// Получаем и очищаем токен
const rawToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
console.log(">>> BOT_TOKEN (first 10 chars):", JSON.stringify(rawToken.slice(0, 10)) + "...");

// Формируем секретный ключ из SHA-256 токена
const secretKey = crypto.createHash("sha256").update(rawToken).digest();
console.log(">>> secretKey (hex):", secretKey.toString("hex"));

export default async function verifyTelegramInit(req, res, next) {
  // Берём initData из query или заголовка
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);

  if (!raw) {
    return res.status(401).json({ error: "No initData" });
  }

  const params = new URLSearchParams(raw);
  // В Telegram WebApp параметр с подписью называется hash
  const clientHash = params.get("hash");
  if (!clientHash) {
    return res.status(401).json({ error: "No hash in initData" });
  }

  // Убираем ключ подписи из параметров для расчёта
  params.delete("hash");
  params.delete("signature");

  // Строим строку для проверки: сортируем ключи по алфавиту
  const dataCheck = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  console.log(">>> dataCheck:\n", dataCheck);

  // Считаем HMAC-SHA256
  const calcHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheck)
    .digest("hex");
  console.log(">>> clientHash:", clientHash);
  console.log(">>> calcHash:", calcHash);

  if (calcHash !== clientHash) {
    console.log(">>> Signature mismatch!");
    return res.status(401).json({ error: "Bad signature" });
  }

  // Если подпись верна — извлекаем пользователя
  const userJson = JSON.parse(decodeURIComponent(params.get("user")));
  const [user] = await User.findOrCreate({
    where: { telegram_id: String(userJson.id) },
    defaults: {
      telegram_id: String(userJson.id),
      username:
        userJson.username ||
        `${userJson.first_name || "Player"}_${userJson.id}`,
      coins: 0,
    },
  });

  req.user = user;
  next();
}
