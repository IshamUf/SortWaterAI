// backend/controllers/levelController.mjs
import Level from "../models/Level.mjs";

/**
 * GET /levels/:id
 * Возвращает уровень по его ID.
 */
export async function getLevelById(req, res) {
  try {
    const { id } = req.params;
    const level = await Level.findByPk(id);

    if (!level) return res.status(404).json({ error: "Level not found" });

    let parsedData;
    try {
      parsedData = JSON.parse(level.level_data);
    } catch (err) {
      console.error("Invalid JSON in level_data:", err);
      return res.status(500).json({ error: "Invalid level_data format" });
    }

    return res.json({
      id: level.id,
      level_data: parsedData,
      difficulty: level.difficulty,
    });
  } catch (error) {
    console.error("getLevelById error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /levels/count
 * Возвращает количество уровней в базе.
 */
export async function getLevelsCount(req, res) {
  try {
    const count = await Level.count();
    return res.json({ count });
  } catch (error) {
    console.error("getLevelsCount error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

