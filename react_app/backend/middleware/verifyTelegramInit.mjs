import crypto from "crypto";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
console.log(">>> TELEGRAM_BOT_TOKEN:", BOT_TOKEN);
if (!BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN");

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) return res.status(401).json({ error: "No initData" });

  // 👇 manually split without decoding values
  const params = raw.split("&")
    .map(kv => kv.split("="))
    .filter(([k]) => k !== "hash" && k !== "signature")
    .sort(([a], [b]) => a.localeCompare(b));

  const dataCheck = params.map(([k, v]) => `${k}=${v}`).join("\n");
  console.log(">>> dataCheck:\n", dataCheck);

  const clientHash = raw.match(/(?:^|&)hash=([a-f0-9]+)/)?.[1];
  console.log(">>> clientHash:", clientHash);

  const secret = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const calcHash = crypto
    .createHmac("sha256", secret)
    .update(dataCheck)
    .digest("hex");

  console.log(">>> calcHash:  ", calcHash);

  if (clientHash !== calcHash) {
    console.error(">>> Signature mismatch!");
    return res.status(401).json({ error: "Bad signature" });
  }

  // ✅ Парсим user после валидации
  const userMatch = raw.match(/user=([^&]+)/);
  if (!userMatch) return res.status(401).json({ error: "No user field" });

  const userJson = JSON.parse(decodeURIComponent(userMatch[1]));
  const [user] = await User.findOrCreate({
    where: { telegram_id: String(userJson.id) },
    defaults: {
      telegram_id: String(userJson.id),
      username: userJson.username || `${userJson.first_name}_${userJson.id}`,
      coins: 0,
    },
  });

  req.user = user;
  next();
}
