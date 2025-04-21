import Progress from "../models/Progress.mjs";
import Level    from "../models/Level.mjs";
import User     from "../models/User.mjs";
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";
import { fn, col, literal } from "sequelize";

/**
 * Помощник: из массива args вытащить последний аргумент–колбэк, если это функция
 */
function extractAck(args) {
  if (!Array.isArray(args)) return null;
  const last = args[args.length - 1];
  return typeof last === "function" ? last : null;
}

/**
 * Помощник: вытащить полезную нагрузку (первый аргумент), если он не функция
 */
function extractPayload(args) {
  if (!Array.isArray(args) || args.length === 0) return undefined;
  const first = args[0];
  return typeof first === "function" ? undefined : first;
}

export default function registerHandlers(socket) {
  // ——— User endpoints —————————————————————————————
  socket.on("user:get", (...args) => {
    const ack = extractAck(args);
    try {
      const { id, username, coins } = socket.user;
      if (ack) ack({ id, username, coins });
    } catch (err) {
      console.error("user:get error", err);
      if (ack) ack({ error: "internal" });
    }
  });

  socket.on("user:daily", async (...args) => {
    const ack = extractAck(args);
    try {
      const cooldownMs = 5 * 60 * 1000;
      const now = Date.now();
      const last = socket.user.last_daily_reward
        ? +socket.user.last_daily_reward
        : 0;

      if (now - last < cooldownMs) {
        if (ack) ack({ error: "cooldown", next: last + cooldownMs });
        return;
      }

      socket.user.coins += 50;
      socket.user.last_daily_reward = new Date(now);
      await socket.user.save();

      if (ack) ack({ coins: socket.user.coins, next: now + cooldownMs });
    } catch (err) {
      console.error("user:daily error", err);
      if (ack) ack({ error: "internal" });
    }
  });

  // ——— Levels endpoints ——————————————————————————
  socket.on("levels:count", async (...args) => {
    const ack = extractAck(args);
    try {
      const count = await Level.count();
      if (ack) ack({ count });
    } catch (err) {
      console.error("levels:count error", err);
      if (ack) ack({ error: "internal" });
    }
  });

  socket.on("levels:get", async (...args) => {
    const ack     = extractAck(args);
    const payload = extractPayload(args);
    try {
      // payload может быть { levelId } или просто число/string
      let rawId = payload?.levelId ?? payload;
      const id = parseInt(rawId, 10);
      if (isNaN(id)) {
        if (ack) ack({ error: "invalid_id" });
        return;
      }

      const lvl = await Level.findByPk(id);
      if (!lvl) {
        if (ack) ack({ error: "not_found" });
        return;
      }

      const data = JSON.parse(lvl.level_data); // { state: [...] }
      if (ack) ack({
        id:         lvl.id,
        state:      data.state,
        difficulty: lvl.difficulty,
        ai_steps:   lvl.ai_steps,
        solution:   lvl.solution ?? []
      });
    } catch (err) {
      console.error("levels:get error", err);
      if (ack) ack({ error: "internal" });
    }
  });

  // ——— Leaderboard ————————————————————————————————
  socket.on("leaderboard:get", async (...args) => {
    const ack = extractAck(args);
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
      if (ack) ack(leaderboard);
    } catch (err) {
      console.error("leaderboard:get error", err);
      if (ack) ack({ error: "internal" });
    }
  });

  // ——— Progress endpoints ——————————————————————————
  socket.on("progress:get", async (...args) => {
    const ack = extractAck(args);
    try {
      const p = await Progress.findOne({
        where: { userId: socket.user.id, status: "in_progress" },
        order: [["updatedAt", "DESC"]],
      });
      if (!p) {
        if (ack) ack({ error: "no_progress" });
        return;
      }
      if (ack) ack({
        levelId: p.levelId,
        state:   p.state,
        status:  p.status,
        moves:   p.moves,
      });
    } catch (err) {
      console.error("progress:get error", err);
      if (ack) ack({ error: "internal" });
    }
  });

  socket.on("progress:start", async (...args) => {
    const ack     = extractAck(args);
    const payload = extractPayload(args);
    try {
      const rawId = payload?.levelId;
      const id    = parseInt(rawId, 10);
      if (isNaN(id)) {
        if (ack) ack({ error: "invalid_payload" });
        return;
      }

      const lvl = await Level.findByPk(id);
      if (!lvl) {
        if (ack) ack({ error: "level_not_found" });
        return;
      }

      const { state: originalState } = JSON.parse(lvl.level_data);

      const [p] = await Progress.findOrCreate({
        where: { userId: socket.user.id, levelId: id },
        defaults: { state: originalState, status: "in_progress", moves: 0 }
      });

      // сброс прогресса
      p.state  = originalState;
      p.status = "in_progress";
      p.moves  = 0;
      await p.save();

      if (ack) ack({
        levelId: p.levelId,
        state:   p.state,
        status:  p.status,
        moves:   p.moves,
      });
    } catch (err) {
      console.error("progress:start error", err);
      if (ack) ack({ error: "internal" });
    }
  });

  socket.on("progress:move", async (...args) => {
    const ack     = extractAck(args);
    const payload = extractPayload(args);
    try {
      const { levelId, from, to } = payload || {};
      if (
        levelId == null ||
        typeof from !== "number" ||
        typeof to   !== "number"
      ) {
        if (ack) ack({ error: "invalid_payload" });
        return;
      }

      const p = await Progress.findOne({
        where: { userId: socket.user.id, levelId }
      });
      if (!p) {
        if (ack) ack({ error: "no_progress" });
        return;
      }
      if (p.status === "completed") {
        if (ack) ack({ error: "completed" });
        return;
      }

      const cur = p.state;
      if (
        !Array.isArray(cur) ||
        from < 0 || from >= cur.length ||
        to   < 0 || to   >= cur.length ||
        !canPour(cur[from], cur[to])
      ) {
        if (ack) ack({ error: "illegal" });
        return;
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

      if (ack) ack({
        state:  p.state,
        status: p.status,
        moves:  p.moves
      });
    } catch (err) {
      console.error("progress:move error", err);
      if (ack) ack({ error: "internal" });
    }
  });
}
