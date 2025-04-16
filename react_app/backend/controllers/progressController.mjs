import Progress from "../models/Progress.mjs";
import Level from "../models/Level.mjs";
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";

/* ---------- start / reset ---------- */
export async function startProgress(req, res) {
  try {
    const { userId, levelId, state } = req.body;

    const [progress, created] = await Progress.findOrCreate({
      where: { userId, levelId },
      defaults: { userId, levelId, state, status: "in_progress" },
    });

    if (!created) {
      progress.state = state;
      progress.status = "in_progress";
      await progress.save();
    }
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

    const cur = progress.state;
    if (
      from < 0 ||
      from >= cur.length ||
      to < 0 ||
      to >= cur.length ||
      !canPour(cur[from], cur[to])
    )
      return res.status(400).json({ error: "Illegal move" });

    const { moved, newSource, newTarget } = pour(cur[from], cur[to]);
    if (!moved) return res.status(400).json({ error: "Illegal move" });

    const newState = [...cur];
    newState[from] = newSource;
    newState[to] = newTarget;

    progress.state = newState;
    progress.status = isSolved(newState) ? "completed" : "in_progress";
    await progress.save();

    /* создаём следующий уровень */
    if (progress.status === "completed") {
      const nextLevelId = levelId + 1;
      const next = await Level.findByPk(nextLevelId);
      if (next) {
        await Progress.findOrCreate({
          where: { userId, levelId: nextLevelId },
          defaults: {
            userId,
            levelId: nextLevelId,
            status: "in_progress",
            state: JSON.parse(next.level_data).state,
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

/* ---------- текущий прогресс ---------- */
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
