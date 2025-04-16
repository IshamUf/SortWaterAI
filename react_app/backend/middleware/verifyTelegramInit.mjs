import crypto from "crypto";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
console.log(">>> TELEGRAM_BOT_TOKEN:", BOT_TOKEN);

if (!BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN");

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) return res.status(401).json({ error: "No initData" });

  const rawParams = new URLSearchParams(raw);
  const clientHash = rawParams.get("hash");
  if (!clientHash) return res.status(401).json({ error: "Missing hash" });

  const dataToCheck = [...rawParams.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, val]) => `${key}=${val}`)
    .join("\n");

  console.log(">>> dataCheck:\n", dataToCheck);

  const secret = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const calcHash = crypto
    .createHmac("sha256", secret)
    .update(dataToCheck)
    .digest("hex");

  console.log(">>> clientHash:", clientHash);
  console.log(">>> calcHash:  ", calcHash);

  if (calcHash !== clientHash) {
    console.error(">>> Signature mismatch!");
    return res.status(401).json({ error: "Bad signature" });
  }

  const userJson = JSON.parse(rawParams.get("user"));
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
