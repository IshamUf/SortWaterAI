// backend/controllers/progressController.mjs
import Progress from "../models/Progress.mjs";
import { canPour, pour, isSolved } from "../utils/levelLogic.mjs";

/** 1. Старт уровня (если записи нет) ****************************************/
export async function startProgress(req, res) {
  try {
    const { userId, levelId, state } = req.body;

    const [progress] = await Progress.findOrCreate({
      where   : { userId, levelId },
      defaults: { userId, levelId, state, status: "in_progress" },
    });

    return res.json(progress);
  } catch (err) {
    console.error("startProgress:", err);
    return res.status(500).json({ error: "Failed to start progress" });
  }
}

/** 2. Один ход **************************************************************/
export async function makeMove(req, res) {
  try {
    const { userId, levelId, from, to } = req.body;

    const progress = await Progress.findOne({ where: { userId, levelId } });
    if (!progress) return res.status(404).json({ error: "Progress not found" });
    if (progress.status === "completed")
      return res.status(400).json({ error: "Level already completed" });

    const curState = progress.state;
    if (
      from < 0 || from >= curState.length ||
      to   < 0 || to   >= curState.length
    ) {
      return res.status(400).json({ error: "Bad tube indices" });
    }

    const { moved, newSource, newTarget } = pour(
      curState[from],
      curState[to]
    );

    if (!moved) return res.status(400).json({ error: "Illegal move" });

    const newState = [...curState];
    newState[from] = newSource;
    newState[to]   = newTarget;

    progress.state  = newState;
    progress.status = isSolved(newState) ? "completed" : "in_progress";
    await progress.save();

    return res.json({
      state : newState,
      status: progress.status,
    });
  } catch (err) {
    console.error("makeMove:", err);
    return res.status(500).json({ error: "Failed to make move" });
  }
}

/** 3. Получить текущий in‑progress уровень **********************************/
export async function getProgressByUser(req, res) {
  try {
    const { userId } = req.query;
    const p = await Progress.findOne({
      where: { userId, status: "in_progress" },
      order: [["updatedAt", "DESC"]],
    });
    if (!p) return res.status(404).json({ error: "No progress" });
    return res.json({
      levelId: p.levelId,
      state  : p.state,
      status : p.status,
    });
  } catch (err) {
    console.error("getProgressByUser:", err);
    return res.status(500).json({ error: "Failed" });
  }
}
