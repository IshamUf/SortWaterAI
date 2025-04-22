import Progress from "../models/Progress.mjs";
import Level    from "../models/Level.mjs";
import User     from "../models/User.mjs";
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";
import { fn, col, literal } from "sequelize";

/**
 * Из args достаёт последний аргумент, если это функция (ack).
 */
function extractAck(args) {
  if (!Array.isArray(args)) return null;
  const last = args[args.length - 1];
  return typeof last === "function" ? last : null;
}

/**
 * Из args вытаскивает полезный payload (первый аргумент), если он не функция.
 */
function extractPayload(args) {
  if (!Array.isArray(args) || args.length === 0) return undefined;
  const first = args[0];
  return typeof first === "function" ? undefined : first;
}

export default function registerHandlers(socket) {
  // ——— User:get —————————————————————————————
  socket.on("user:get", (...args) => {
    const ack = extractAck(args);
    try {
      if (!ack) return;
      const { id, username, coins } = socket.user;
      ack({ id, username, coins });
    } catch (err) {
      console.error("user:get error", err);
      ack({ error: "internal" });
    }
  });

  // ——— User:daily —————————————————————————————
  socket.on("user:daily", async (...args) => {
    const ack = extractAck(args);
    try {
      if (!ack) return;
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

  // ——— Levels:count ——————————————————————————
  socket.on("levels:count", async (...args) => {
    const ack = extractAck(args);
    try {
      if (!ack) return;
      const count = await Level.count();
      ack({ count });
    } catch (err) {
      console.error("levels:count error", err);
      ack({ error: "internal" });
    }
  });

  // ——— Levels:get ——————————————————————————
  socket.on("levels:get", async (...args) => {
    const ack     = extractAck(args);
    const payload = extractPayload(args);
    try {
      if (!ack) return;
      let raw = typeof payload === "object" && payload !== null
                ? payload.levelId
                : payload;
      const id = parseInt(raw, 10);
      if (isNaN(id)) {
        return ack({ error: "invalid_id" });
      }
      const lvl = await Level.findByPk(id);
      if (!lvl) {
        return ack({ error: "not_found" });
      }
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

  // ——— Leaderboard:get ——————————————————————————
  socket.on("leaderboard:get", async (...args) => {
    const ack = extractAck(args);
    try {
      if (!ack) return;
      const rows = await Progress.findAll({
        where:      { status: "completed" },
        attributes:[ "userId", [ fn("COUNT", col("status")), "completedCount" ] ],
        group:      ["userId","User.id"],
        order:      [[ literal('"completedCount"'), "DESC" ]],
        include:    [{ model: User, attributes: ["username"] }],
        raw:        true,
      });
      const board = rows.map(r => ({
        username:        r["User.username"],
        completedLevels: +r.completedCount
      }));
      ack(board);
    } catch (err) {
      console.error("leaderboard:get error", err);
      ack({ error: "internal" });
    }
  });

  // ——— Progress:get ——————————————————————————
  socket.on("progress:get", async (...args) => {
    const ack = extractAck(args);
    try {
      if (!ack) return;
      const p = await Progress.findOne({
        where: { userId: socket.user.id, status: "in_progress" },
        order: [["updatedAt", "DESC"]],
      });
      if (!p) {
        return ack({ error: "no_progress" });
      }
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

  // ——— Progress:start ——————————————————————————
  socket.on("progress:start", async (...args) => {
    const ack     = extractAck(args);
    const payload = extractPayload(args);
    try {
      if (!ack) return;
      const raw = payload?.levelId;
      const id  = parseInt(raw, 10);
      if (isNaN(id)) {
        return ack({ error: "invalid_payload" });
      }
      const lvl = await Level.findByPk(id);
      if (!lvl) {
        return ack({ error: "level_not_found" });
      }
      const { state: orig } = JSON.parse(lvl.level_data);
      const [p] = await Progress.findOrCreate({
        where:    { userId: socket.user.id, levelId: id },
        defaults: { state: orig, status: "in_progress", moves: 0 },
      });
      p.state  = orig;
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

  // ——— Progress:move ——————————————————————————
  socket.on("progress:move", async (...args) => {
    const ack     = extractAck(args);
    const payload = extractPayload(args);
    try {
      if (!ack) return;
      const { levelId, from, to } = payload ?? {};
      if (
        typeof levelId !== "number" ||
        typeof from    !== "number" ||
        typeof to      !== "number"
      ) {
        return ack({ error: "invalid_payload" });
      }

      const p = await Progress.findOne({
        where: { userId: socket.user.id, levelId }
      });
      if (!p) return ack({ error: "no_progress" });
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
      const next = [...cur];
      next[from] = newSource;
      next[to]   = newTarget;

      p.state  = next;
      p.moves += 1;
      p.status = isSolved(next) ? "completed" : "in_progress";
      await p.save();

      // подготовка следующего уровня
      if (p.status === "completed") {
        const nxt = await Level.findByPk(p.levelId + 1);
        if (nxt) {
          const { state: nxtState } = JSON.parse(nxt.level_data);
          await Progress.findOrCreate({
            where:    { userId: socket.user.id, levelId: nxt.id },
            defaults: { state: nxtState, status: "in_progress", moves: 0 },
          });
        }
      }

      // Собираем результат и награду
      const result = {
        state:  p.state,
        status: p.status,
        moves:  p.moves,
      };
      if (p.status === "completed") {
        const lvl = await Level.findByPk(levelId);
        const aiSteps   = lvl.ai_steps ?? 0;
        const userSteps = p.moves;
        let reward, message;

        if (userSteps < aiSteps) {
          reward  = 3;
          message = "Wow, you beat the AI!";
        } else if (userSteps === aiSteps) {
          reward  = 2;
          message = "Level completed!";
        } else {
          reward  = 1;
          message = "Level completed!";
        }

        socket.user.coins += reward;
        await socket.user.save();

        result.reward  = reward;
        result.message = message;
        result.coins   = socket.user.coins;
      }

      ack(result);
    } catch (err) {
      console.error("progress:move error", err);
      ack({ error: "internal" });
    }
  });

}
