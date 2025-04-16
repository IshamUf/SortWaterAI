import crypto from "crypto";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("Set TELEGRAM_BOT_TOKEN in env");
}

// Каждый запрос логируем для диагностики
export default async function verifyTelegramInit(req, res, next) {
  try {
    // Берём initData из query или из заголовка
    const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
    console.log(">>> raw initData:", raw);
    if (!raw) {
      return res.status(401).json({ error: "No initData" });
    }

    // Парсим параметры
    const params = new URLSearchParams(raw);

    // Оригинальный хеш, переданный Telegram
    const clientHash = params.get("hash");
    console.log(">>> clientHash:", clientHash);
    if (!clientHash) {
      return res.status(401).json({ error: "No hash param" });
    }

    // Удаляем поля, которые не участвуют в проверке
    params.delete("hash");
    params.delete("signature");

    // Собираем из оставшихся checkString
    const dataCheck = [...params]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");
    console.log(">>> dataCheck:\n", dataCheck);

    // Вычисляем HMAC-SHA256
    const secretKey = crypto
      .createHash("sha256")
      .update(BOT_TOKEN)
      .digest();
    const calcHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheck)
      .digest("hex");
    console.log(">>> calcHash:", calcHash);

    // Сверяем
    if (calcHash !== clientHash) {
      console.log(">>> Signature mismatch!");
      return res.status(401).json({ error: "Bad signature" });
    }

    // Всё ок — достаём user и создаём/ищем в БД
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

    // Прокидываем пользователя в контроллеры
    req.user = user;
    next();
  } catch (err) {
    console.error("verifyTelegramInit error:", err);
    return res.status(500).json({ error: "Auth middleware failed" });
  }
}
