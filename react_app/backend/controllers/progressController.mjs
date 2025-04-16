// backend/controllers/progressController.mjs
import Progress from "../models/Progress.mjs";
import Level from "../models/Level.mjs";          // ← добавили
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";

/* ---------- старт ---------- */
export async function startProgress(req, res) {
  try {
    const { userId, levelId, state } = req.body;
    const [progress] = await Progress.findOrCreate({
      where: { userId, levelId },
      defaults: { userId, levelId, state, status: "in_progress" },
    });
    return res.json(progress);
  } catch (err) {
    console.error("startProgress:", err);
    return res.status(500).json({ error: "Failed to start progress" });
  }
}

/* ---------- один ход ---------- */
export async function makeMove(req, res) {
  try {
    const { userId, levelId, from, to } = req.body;

    const progress = await Progress.findOne({ where: { userId, levelId } });
    if (!progress) return res.status(404).json({ error: "Progress not found" });
    if (progress.status === "completed")
      return res.status(400).json({ error: "Level already completed" });

    const currState = progress.state;

    if (
      from < 0 ||
      from >= currState.length ||
      to < 0 ||
      to >= currState.length
    ) {
      return res.status(400).json({ error: "Bad tube indices" });
    }

    if (!canPour(currState[from], currState[to])) {
      return res.status(400).json({ error: "Illegal move" });
    }

    /* применяем ход */
    const { moved, newSource, newTarget } = pour(
      currState[from],
      currState[to]
    );
    if (!moved) return res.status(400).json({ error: "Illegal move" });

    const newState = [...currState];
    newState[from] = newSource;
    newState[to] = newTarget;

    progress.state = newState;
    progress.status = isSolved(newState) ? "completed" : "in_progress";
    await progress.save();

    /* ---------- если решено, создаём следующий уровень ---------- */
    if (progress.status === "completed") {
      const nextLevelId = levelId + 1;
      const nextLevel = await Level.findByPk(nextLevelId);
      if (nextLevel) {
        await Progress.findOrCreate({
          where: { userId, levelId: nextLevelId },
          defaults: {
            userId,
            levelId: nextLevelId,
            status: "in_progress",
            state: JSON.parse(nextLevel.level_data).state,
          },
        });
      }
    }

    return res.json({ state: progress.state, status: progress.status });
  } catch (err) {
    console.error("makeMove:", err);
    return res.status(500).json({ error: "Failed to make move" });
  }
}

/* ---------- получить текущий прогресс ---------- */
export async function getProgressByUser(req, res) {
  try {
    const { userId } = req.query;
    const p = await Progress.findOne({
      where: { userId, status: "in_progress" },
      order: [["updatedAt", "DESC"]],
    });
    if (!p) return res.status(404).json({ error: "No progress" });
    return res.json({ levelId: p.levelId, state: p.state, status: p.status });
  } catch (err) {
    console.error("getProgressByUser:", err);
    return res.status(500).json({ error: "Failed" });
  }
}
