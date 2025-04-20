import Progress from "../models/Progress.mjs";
import Level from "../models/Level.mjs";
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";
import { Op, fn, col, literal } from "sequelize";
import User from "../models/User.mjs";

export default function registerHandlers(socket) {
  /* ---------- User ---------- */
  socket.on("user:get", (ack) => {
    const u = socket.user;
    ack({ id: u.id, username: u.username, coins: u.coins });
  });

  socket.on("user:daily", async (ack) => {
    const cooldownMs = 5 * 60 * 1000;
    const now = Date.now();
    const last = socket.user.last_daily_reward
      ? +socket.user.last_daily_reward
      : 0;

    if (now - last < cooldownMs)
      return ack({ error: "cooldown", next: last + cooldownMs });

    socket.user.coins += 50;
    socket.user.last_daily_reward = new Date(now);
    await socket.user.save();
    ack({ coins: socket.user.coins, next: now + cooldownMs });
  });

  /* ---------- Levels ---------- */
  socket.on("levels:count", async (ack) => {
    const count = await Level.count();
    ack({ count });
  });

  /* ---------- Leaderboard ---------- */
  socket.on("leaderboard:get", async (ack) => {
    const rows = await Progress.findAll({
      where: { status: "completed" },
      attributes: ["userId", [fn("COUNT", col("status")), "cnt"]],
      group: ["userId", "User.id"],
      order: [[literal("cnt"), "DESC"]],
      include: [{ model: User, attributes: ["username"] }],
      raw: true,
    });
    const board = rows.map((r) => ({
      username: r["User.username"],
      completedLevels: r.cnt,
    }));
    ack(board);
  });

  /* ---------- Progress (ранее) ---------- */
  socket.on("progress:get", async (ack) => {
    const p = await Progress.findOne({
      where: { userId: socket.user.id, status: "in_progress" },
      order: [["updatedAt", "DESC"]],
    });
    if (!p) return ack({ error: "no_progress" });
    ack({ levelId: p.levelId, state: p.state, status: p.status });
  });

  socket.on("progress:start", async ({ levelId, state }, ack) => {
    const [p] = await Progress.findOrCreate({
      where: { userId: socket.user.id, levelId },
      defaults: { state, status: "in_progress" },
    });
    p.state = state;
    p.status = "in_progress";
    await p.save();
    ack({ levelId: p.levelId, state: p.state, status: p.status });
  });

  socket.on("progress:move", async ({ levelId, from, to }, ack) => {
    const p = await Progress.findOne({
      where: { userId: socket.user.id, levelId },
    });
    if (!p) return ack({ error: "no_progress" });
    if (p.status === "completed") return ack({ error: "completed" });

    const cur = p.state;
    if (
      from < 0 ||
      from >= cur.length ||
      to < 0 ||
      to >= cur.length ||
      !canPour(cur[from], cur[to])
    )
      return ack({ error: "illegal" });

    const { newSource, newTarget } = pour(cur[from], cur[to]);
    const next = [...cur];
    next[from] = newSource;
    next[to] = newTarget;

    p.state = next;
    p.status = isSolved(next) ? "completed" : "in_progress";
    await p.save();

    if (p.status === "completed") {
      const nextLevel = await Level.findByPk(levelId + 1);
      if (nextLevel) {
        await Progress.findOrCreate({
          where: { userId: socket.user.id, levelId: nextLevel.id },
          defaults: {
            state: JSON.parse(nextLevel.level_data).state,
            status: "in_progress",
          },
        });
      }
    }
    ack({ state: p.state, status: p.status });
  });
}
