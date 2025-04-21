import Progress from "../models/Progress.mjs";
import Level    from "../models/Level.mjs";
import User     from "../models/User.mjs";
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";
import { fn, col, literal } from "sequelize";

export default function registerHandlers(socket) {
  // ——— User endpoints —————————————————————————————
  socket.on("user:get", (_args, ack) => {
    try {
      const { id, username, coins } = socket.user;
      ack({ id, username, coins });
    } catch (err) {
      console.error("user:get error", err);
      ack({ error: "internal" });
    }
  });

  socket.on("user:daily", async (_args, ack) => {
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
      console.error("user:daily error", err);
      ack({ error: "internal" });
    }
  });

  // ——— Levels endpoints ——————————————————————————
  socket.on("levels:count", async (_args, ack) => {
    try {
      const count = await Level.count();
      ack({ count });
    } catch (err) {
      console.error("levels:count error", err);
      ack({ error: "internal" });
    }
  });

  socket.on("levels:get", async (args, ack) => {
    try {
      const id = parseInt(args?.levelId ?? args, 10);
      if (isNaN(id)) {
        return ack({ error: "invalid_id" });
      }

      const lvl = await Level.findByPk(id);
      if (!lvl) return ack({ error: "not_found" });

      // level_data хранит { state: [...] }
      const data = JSON.parse(lvl.level_data);

      ack({
        id:         lvl.id,
        state:      data.state,
        difficulty: lvl.difficulty,
        ai_steps:   lvl.ai_steps,
        solution:   lvl.solution ?? []
      });
    } catch (err) {
      console.error("levels:get error", err);
      ack({ error: "internal" });
    }
  });

  // ——— Leaderboard ————————————————————————————————
  socket.on("leaderboard:get", async (_args, ack) => {
    try {
      const rows = await Progress.findAll({
        where: { status: "completed" },
        attributes: [
          "userId",
          [fn("COUNT", col("status")), "completedCount"]
        ],
        group:   ["userId", "User.id"],
        order:   [[literal('"completedCount"'), "DESC"]],
        include: [{ model: User, attributes: ["username"] }],
        raw:     true,
      });

      const leaderboard = rows.map(r => ({
        username:        r["User.username"],
        completedLevels: r.completedCount
      }));

      ack(leaderboard);
    } catch (err) {
      console.error("leaderboard:get error", err);
      ack({ error: "internal" });
    }
  });

  // ——— Progress endpoints ——————————————————————————
  socket.on("progress:get", async (_args, ack) => {
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
      console.error("progress:get error", err);
      ack({ error: "internal" });
    }
  });

  socket.on("progress:start", async (args, ack) => {
    try {
      // защитимся от null/undefined
      const rawId = args?.levelId;
      const id = parseInt(rawId, 10);
      if (isNaN(id)) {
        return ack({ error: "invalid_payload" });
      }

      const lvl = await Level.findByPk(id);
      if (!lvl) return ack({ error: "level_not_found" });

      const { state: originalState } = JSON.parse(lvl.level_data);

      const [p] = await Progress.findOrCreate({
        where: { userId: socket.user.id, levelId: id },
        defaults: { state: originalState, status: "in_progress", moves: 0 }
      });

      // сбросить прогресс, даже если запись была
      p.state  = originalState;
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
      console.error("progress:start error", err);
      ack({ error: "internal" });
    }
  });

  socket.on("progress:move", async (args, ack) => {
    try {
      const { levelId, from, to } = args || {};
      if (
        levelId == null ||
        typeof from !== "number" ||
        typeof to   !== "number"
      ) {
        return ack({ error: "invalid_payload" });
      }

      const p = await Progress.findOne({
        where: { userId: socket.user.id, levelId }
      });
      if (!p)               return ack({ error: "no_progress" });
      if (p.status === "completed") return ack({ error: "completed" });

      const cur = p.state;
      if (
        !Array.isArray(cur) ||
        from < 0 || from >= cur.length ||
        to   < 0 || to   >= cur.length ||
        !canPour(cur[from], cur[to])
      ) {
        return ack({ error: "illegal" });
      }

      const { newSource, newTarget } = pour(cur[from], cur[to]);
      const nextState = [...cur];
      nextState[from] = newSource;
      nextState[to]   = newTarget;

      p.state  = nextState;
      p.moves += 1;
      p.status = isSolved(nextState) ? "completed" : "in_progress";
      await p.save();

      // подготовка следующего уровня
      if (p.status === "completed") {
        const nextLvl = await Level.findByPk(p.levelId + 1);
        if (nextLvl) {
          const { state: nextStateData } = JSON.parse(nextLvl.level_data);
          await Progress.findOrCreate({
            where: { userId: socket.user.id, levelId: nextLvl.id },
            defaults: { state: nextStateData, status: "in_progress", moves: 0 }
          });
        }
      }

      ack({
        state:  p.state,
        status: p.status,
        moves:  p.moves
      });
    } catch (err) {
      console.error("progress:move error", err);
      ack({ error: "internal" });
    }
  });
}
