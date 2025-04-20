// backend/sockets/handlers.mjs
import Progress   from "../models/Progress.mjs";
import Level      from "../models/Level.mjs";
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";

/**
 * Регистрирует все события для конкретного клиента
 * @param {import("socket.io").Socket} socket
 * @param {import("socket.io").Server} io
 */
export default function registerHandlers(socket, io) {
  /* --- echo‑пинг для отладки --- */
  socket.on("ping", (msg, ack) => ack?.(`pong: ${msg}`));

  /* ---------- progress:start ---------- */
  socket.on("progress:start", async ({ levelId, state }, ack = () => {}) => {
    try {
      const userId = socket.user.id;

      const [p] = await Progress.findOrCreate({
        where: { userId, levelId },
        defaults: { userId, levelId, state, status: "in_progress" },
      });

      if (p.status === "completed") {
        return ack({ error: "Level already completed" });
      }

      p.state  = state;
      p.status = "in_progress";
      await p.save();
      ack({ state: p.state, status: p.status });
    } catch (err) {
      console.error("WS progress:start:", err);
      ack({ error: "Internal error" });
    }
  });

  /* ---------- progress:move ---------- */
  socket.on(
    "progress:move",
    async ({ levelId, from, to }, ack = () => {}) => {
      try {
        const userId = socket.user.id;
        const p = await Progress.findOne({ where: { userId, levelId } });
        if (!p) return ack({ error: "Progress not found" });

        if (p.status === "completed")
          return ack({ error: "Level already completed" });

        const cur = p.state;
        if (
          from < 0 ||
          from >= cur.length ||
          to < 0 ||
          to >= cur.length ||
          !canPour(cur[from], cur[to])
        ) {
          return ack({ error: "Illegal move" });
        }

        const { newSource, newTarget } = pour(cur[from], cur[to]);
        const newState       = [...cur];
        newState[from] = newSource;
        newState[to]   = newTarget;

        p.state  = newState;
        p.status = isSolved(newState) ? "completed" : "in_progress";
        await p.save();

        /* автосоздание следующего уровня */
        if (p.status === "completed") {
          const next = await Level.findByPk(levelId + 1);
          if (next) {
            await Progress.findOrCreate({
              where: { userId, levelId: next.id },
              defaults: {
                userId,
                levelId: next.id,
                status: "in_progress",
                state: JSON.parse(next.level_data).state,
              },
            });
          }
        }

        ack({ state: p.state, status: p.status });
      } catch (err) {
        console.error("WS progress:move:", err);
        ack({ error: "Internal error" });
      }
    }
  );

  /* ---------- progress:get ---------- */
  socket.on("progress:get", async (ack = () => {}) => {
    try {
      const userId = socket.user.id;
      const p = await Progress.findOne({
        where: { userId, status: "in_progress" },
        order: [["updatedAt", "DESC"]],
      });
      if (!p) return ack({ error: "No progress" });
      ack({ levelId: p.levelId, state: p.state, status: p.status });
    } catch (err) {
      console.error("WS progress:get:", err);
      ack({ error: "Internal error" });
    }
  });
}
