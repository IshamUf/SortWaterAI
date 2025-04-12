import Level from '../models/Level.mjs';

export async function getLevelById(req, res) {
  try {
    const id = req.params.id;
    const level = await Level.findByPk(id);

    if (!level) {
      return res.status(404).json({ error: "Level not found" });
    }

    // Если level_data хранится как TEXT с экранированными кавычками,
    // нужно распарсить вручную:
    let parsedData;
    try {
      parsedData = JSON.parse(level.level_data);
    } catch (parseError) {
      console.error("Invalid JSON in level_data:", parseError);
      return res.status(500).json({ error: "Invalid level_data format" });
    }

    // Возвращаем объект, где level_data уже распарсена
    res.json({
      id: level.id,
      level_data: parsedData,
      difficulty: level.difficulty,
    });
  } catch (error) {
    console.error("getLevelById error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
