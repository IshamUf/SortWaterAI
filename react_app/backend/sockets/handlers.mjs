import Progress from "../models/Progress.mjs";
import Level    from "../models/Level.mjs";
import User     from "../models/User.mjs";
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";
import { fn, col, literal } from "sequelize";

export default function registerHandlers(socket) {
  /* ---------- User ---------- */
  socket.on("user:get", (_i, ack) => {
    const u = socket.user;
    ack({ id: u.id, username: u.username, coins: u.coins });
  });

  socket.on("user:daily", async (_i, ack) => {
    const cooldownMs = 5 * 60 * 1000;
    const now  = Date.now();
    const last = socket.user.last_daily_reward ? +socket.user.last_daily_reward : 0;
    if (now - last < cooldownMs)
      return ack({ error: "cooldown", next: last + cooldownMs });

    socket.user.coins += 50;
    socket.user.last_daily_reward = new Date(now);
    await socket.user.save();
    ack({ coins: socket.user.coins, next: now + cooldownMs });
  });

  /* ---------- Levels ---------- */
  socket.on("levels:count", (_i, ack) => Level.count().then((c) => ack({ count: c })));

  socket.on("levels:get", async (id, ack) => {
    const lvl = await Level.findByPk(id);
    if (!lvl) return ack({ error: "not_found" });
    ack({
      id: lvl.id,
      state: JSON.parse(lvl.level_data).state,
      difficulty: lvl.difficulty,
    });
  });

  /* ---------- Leaderboard ---------- */
  socket.on("leaderboard:get", (_i, ack) => {
    Progress.findAll({
      where: { status: "completed" },
      attributes: ["userId", [fn("COUNT", col("status")), "cnt"]],
      group: ["userId", "User.id"],
      order: [[literal("cnt"), "DESC"]],
      include: [{ model: User, attributes: ["username"] }],
      raw: true,
    }).then((rows) =>
      ack(rows.map((r) => ({
        username: r["User.username"],
        completedLevels: r.cnt,
      })))
    );
  });

  /* ---------- Progress ---------- */
  socket.on("progress:get", (_i, ack) => {
    Progress.findOne({
      where: { userId: socket.user.id, status: "in_progress" },
      order: [["updatedAt", "DESC"]],
    }).then((p) => {
      if (!p) return ack({ error: "no_progress" });
      ack({
        levelId: p.levelId,
        state:   p.state,
        status:  p.status,
        moves:   p.moves,
      });
    });
  });

  /* --- Reset / Start --- */
  socket.on("progress:start", async ({ levelId }, ack) => {
    try {
      const lvl = await Level.findByPk(levelId);
      if (!lvl) return ack({ error: "level_not_found" });
      const originalState = JSON.parse(lvl.level_data).state;

      const [p] = await Progress.findOrCreate({
        where: { userId: socket.user.id, levelId },
        defaults: {
          state: originalState,
          status: "in_progress",
          moves:  0,
        },
      });

      p.state  = originalState;
      p.status = "in_progress";
      p.moves  = 0;            // ← сброс счётчика
      await p.save();

      ack({
        levelId: p.levelId,
        state:   p.state,
        status:  p.status,
        moves:   p.moves,
      });
    } catch (err) {
      console.error("progress:start:", err);
      ack({ error: "internal" });
    }
  });

  /* --- Один ход --- */
  socket.on("progress:move", async ({ levelId, from, to }, ack) => {
    const p = await Progress.findOne({
      where: { userId: socket.user.id, levelId },
    });
    if (!p)               return ack({ error: "no_progress" });
    if (p.status === "completed") return ack({ error: "completed" });

    const cur = p.state;
    if (from < 0 || from >= cur.length || to < 0 || to >= cur.length ||
        !canPour(cur[from], cur[to]))
      return ack({ error: "illegal" });

    const { newSource, newTarget } = pour(cur[from], cur[to]);
    const next = [...cur];
    next[from] = newSource;
    next[to]   = newTarget;

    p.state  = next;
    p.moves += 1;                               // ← +1 ход
    p.status = isSolved(next) ? "completed" : "in_progress";
    await p.save();

    /* создаём следующий уровень */
    if (p.status === "completed") {
      const nextLevel = await Level.findByPk(levelId + 1);
      if (nextLevel) {
        await Progress.findOrCreate({
          where: { userId: socket.user.id, levelId: nextLevel.id },
          defaults: {
            state: JSON.parse(nextLevel.level_data).state,
            status: "in_progress",
            moves:  0,
          },
        });
      }
    }
    ack({ state: p.state, status: p.status, moves: p.moves });
  });
}
