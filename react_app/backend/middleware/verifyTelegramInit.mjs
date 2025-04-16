import initData from "@telegram-apps/init-data-node";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN");

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) return res.status(401).json({ error: "No initData" });

  let data;
  try {
    data = initData.checkInitData(raw, BOT_TOKEN);
  } catch (err) {
    console.error(">>> Signature check failed:", err.message);
    return res.status(401).json({ error: "Invalid initData signature" });
  }

  console.log(">>> verified user:", data.user);

  const userJson = data.user;
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
