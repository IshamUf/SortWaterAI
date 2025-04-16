import { InitData } from "@telegram-apps/init-data-node";
import User from "../models/User.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN");

export default async function verifyTelegramInit(req, res, next) {
  const raw = req.query.tgWebAppData || req.get("X-TG-Init-Data");
  console.log(">>> raw initData:", raw);
  if (!raw) return res.status(401).json({ error: "No initData" });

  let initData;
  try {
    initData = InitData.parse(raw);
  } catch (err) {
    console.error(">>> InitData parse error:", err);
    return res.status(400).json({ error: "Invalid initData format" });
  }

  if (!initData.validate(BOT_TOKEN)) {
    console.error(">>> Signature mismatch!");
    return res.status(401).json({ error: "Bad signature" });
  }

  const user = initData.user;
  if (!user) return res.status(401).json({ error: "No user in initData" });

  const [dbUser] = await User.findOrCreate({
    where: { telegram_id: String(user.id) },
    defaults: {
      telegram_id: String(user.id),
      username: user.username || `${user.first_name || "Player"}_${user.id}`,
      coins: 0,
    },
  });

  req.user = dbUser;
  next();
}
