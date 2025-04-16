import crypto from "crypto";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN");

const secret = crypto.createHash("sha256").update(BOT_TOKEN).digest();

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) return res.status(401).json({ error: "No initData" });

  const paramsObj = {};
  raw.split("&").forEach((pair) => {
    const [key, value] = pair.split("=");
    paramsObj[key] = value;
  });

  const signature = paramsObj["signature"];
  if (!signature) return res.status(401).json({ error: "No signature" });

  const dataCheck = Object.entries(paramsObj)
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  console.log(">>> dataCheck:\n", dataCheck);

  const calcSignature = crypto
    .createHmac("sha256", secret)
    .update(dataCheck)
    .digest("base64url"); // <--- ВАЖНО

  console.log(">>> clientSignature:", signature);
  console.log(">>> calcSignature:  ", calcSignature);

  if (signature !== calcSignature) {
    console.error(">>> Signature mismatch!");
    return res.status(401).json({ error: "Bad signature" });
  }

  const userRaw = decodeURIComponent(paramsObj["user"]);
  const userJson = JSON.parse(userRaw);

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
