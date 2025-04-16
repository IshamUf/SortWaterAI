// backend/middleware/verifyTelegramInit.mjs
import crypto from "crypto";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN in env");

const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();

export default async function verifyTelegramInit(req, res, next) {
  // 1) Получаем «сырые» initData
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) return res.status(401).json({ error: "No initData" });

  // 2) Распарсим все пары ключ=значение
  const params = new URLSearchParams(raw);

  // 3) Смотрим, где у нас подпись: может быть в hash, а может в signature
  const clientHash = params.get("hash") ?? params.get("signature");
  console.log(">>> clientHash:", clientHash);
  if (!clientHash) return res.status(401).json({ error: "No hash" });

  // 4) Убираем оба поля из params, чтобы они не попали в dataCheck
  params.delete("hash");
  params.delete("signature");

  // 5) Собираем строку dataCheck из оставшихся полей
  const dataCheck = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  console.log(">>> dataCheck:\n", dataCheck);

  // 6) Вычисляем HMAC‑SHA256
  const calcHash = crypto.createHmac("sha256", secretKey)
    .update(dataCheck)
    .digest("hex");
  console.log(">>> calcHash:", calcHash);

  // 7) Сравниваем
  if (calcHash !== clientHash) {
    console.log(">>> Signature mismatch!");
    return res.status(401).json({ error: "Bad signature" });
  }

  // 8) Всё ок — извлекаем пользователя и сохраняем в req.user
  const userJson = JSON.parse(decodeURIComponent(params.get("user")));
  console.log(">>> user payload:", userJson);

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
