import User from "../models/User.mjs";

/**
 * GET /api/users/me
 */
export async function getSelf(req, res) {
  const u = req.user;
  res.json({ id: u.id, username: u.username, coins: u.coins });
}

/**
 * POST /api/users/me/daily
 */
export async function claimDailyGift(req, res) {
  try {
    const user       = req.user;
    const now        = Date.now();
    const last       = user.last_daily_reward ? +user.last_daily_reward : 0;
    const cooldownMs = 5 * 60 * 1000;

    if (now - last < cooldownMs) {
      return res.status(429).json({
        message: "Подождите 5 минут",
        nextClaimAvailableAt: new Date(last + cooldownMs),
      });
    }

    user.coins += 50;
    user.last_daily_reward = new Date(now);
    await user.save();

    res.json({
      message              : "Ежедневный подарок получен!",
      coins                : user.coins,
      nextClaimAvailableAt : new Date(now + cooldownMs),
    });
  } catch (err) {
    console.error("claimDailyGift:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
