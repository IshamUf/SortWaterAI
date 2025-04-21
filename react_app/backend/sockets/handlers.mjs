import Progress from "../models/Progress.mjs";
import Level    from "../models/Level.mjs";
import User     from "../models/User.mjs";
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";
import { fn, col, literal } from "sequelize";

export default function registerHandlers(socket) {
  /* ---------- User ---------- */
  socket.on("user:get", (_i, ack) => {
    try {
      const u = socket.user;
      ack({ id: u.id, username: u.username, coins: u.coins });
    } catch (err) {
      console.error("user:get error:", err);
      ack({ error: "internal" });
    }
  });

  socket.on("user:daily", async (_i, ack) => {
    try {
      const cooldownMs = 5 * 60 * 1000;
      const now  = Date.now();
      const last = socket.user.last_daily_reward
        ? +socket.user.last_daily_reward
        : 0;
      if (now - last < cooldownMs) {
        return ack({ error: "cooldown", next: last + cooldownMs });
      }
      socket.user.coins += 50;
      socket.user.last_daily_reward = new Date(now);
      await socket.user.save();
      ack({ coins: socket.user.coins, next: now + cooldownMs });
    } catch (err) {
      console.error("user:daily error:", err);
      ack({ error: "internal" });
    }
  });

  /* ---------- Levels ---------- */
  socket.on("levels:count", async (_i, ack) => {
    try {
      const count = await Level.count();
      ack({ count });
    } catch (err) {
      console.error("levels:count error:", err);
      ack({ error: "internal" });
    }
  });

  socket.on("levels:get", async (id, ack) => {
    try {
      const lvl = await Level.findByPk(id);
      if (!lvl) return ack({ error: "not_found" });
      const data = JSON.parse(lvl.level_data);
      ack({
        id: lvl.id,
        state: data.state,
        difficulty: lvl.difficulty,
        solution: data.solution || null,
      });
    } catch (err) {
      console.error("levels:get error:", err);
      ack({ error: "internal" });
    }
  });

  /* ---------- Leaderboard ---------- */
  socket.on("leaderboard:get", async (_i, ack) => {
    try {
      const rows = await Progress.findAll({
        where: { status: "completed" },
        attributes: [
          "userId",
          [fn("COUNT", col("status")), "cnt"]
        ],
        group: ["userId", "User.id"],
        order: [[literal("cnt"), "DESC"]],
        include: [{ model: User, attributes: ["username"] }],
        raw: true,
      });
      const board = rows.map(r => ({
        username: r["User.username"],
        completedLevels: r.cnt,
      }));
      ack(board);
    } catch (err) {
      console.error("leaderboard:get error:", err);
      ack({ error: "internal" });
    }
  });

  /* ---------- Progress:get ---------- */
  socket.on("progress:get", async (_i, ack) => {
    try {
      const p = await Progress.findOne({
        where: { userId: socket.user.id, status: "in_progress" },
        order: [["updatedAt", "DESC"]],
      });
      if (!p) return ack({ error: "no_progress" });
      ack({
        levelId: p.levelId,
        state:   p.state,
        status:  p.status,
        moves:   p.moves,
      });
    } catch (err) {
      console.error("progress:get error:", err);
      ack({ error: "internal" });
    }
  });

  /* ---------- Progress:start ---------- */
  socket.on("progress:start", async ({ levelId }, ack) => {
    try {
      const lvl = await Level.findByPk(levelId);
      if (!lvl) return ack({ error: "level_not_found" });
      const original = JSON.parse(lvl.level_data).state;

      const [p] = await Progress.findOrCreate({
        where: { userId: socket.user.id, levelId },
        defaults: {
          state: original,
          status: "in_progress",
          moves:  0,
        },
      });

      p.state  = original;
      p.status = "in_progress";
      p.moves  = 0;
      await p.save();

      ack({
        levelId: p.levelId,
        state:   p.state,
        status:  p.status,
        moves:   p.moves,
      });
    } catch (err) {
      console.error("progress:start error:", err);
      ack({ error: "internal" });
    }
  });

  /* ---------- Progress:move ---------- */
  socket.on("progress:move", async ({ levelId, from, to }, ack) => {
    try {
      const p = await Progress.findOne({
        where: { userId: socket.user.id, levelId },
      });
      if (!p) return ack({ error: "no_progress" });
      if (p.status === "completed") return ack({ error: "completed" });

      // ensure p.state is an array
      let cur = p.state;
      if (typeof cur === "string") {
        try { cur = JSON.parse(cur); }
        catch {
          console.error("progress:move — invalid JSON in p.state:", p.state);
          return ack({ error: "internal" });
        }
      }
      if (!Array.isArray(cur)) {
        console.error("progress:move — p.state is not an array:", cur);
        return ack({ error: "internal" });
      }

      if (
        from < 0 || from >= cur.length ||
        to   < 0 || to   >= cur.length ||
        !canPour(cur[from], cur[to])
      ) {
        return ack({ error: "illegal" });
      }

      const { newSource, newTarget } = pour(cur[from], cur[to]);
      const next = [...cur];
      next[from] = newSource;
      next[to]   = newTarget;

      p.state   = next;
      p.moves  += 1;
      p.status  = isSolved(next) ? "completed" : "in_progress";
      await p.save();

      // enqueue next level if completed
      if (p.status === "completed") {
        const nl = await Level.findByPk(levelId + 1);
        if (nl) {
          const orig = JSON.parse(nl.level_data).state;
          await Progress.findOrCreate({
            where: { userId: socket.user.id, levelId: nl.id },
            defaults: { state: orig, status: "in_progress", moves: 0 },
          });
        }
      }

      ack({ state: p.state, status: p.status, moves: p.moves });
    } catch (err) {
      console.error("progress:move error:", err);
      ack({ error: "internal" });
    }
  });
}
