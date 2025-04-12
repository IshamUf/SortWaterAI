// backend/controllers/progressController.mjs
import Progress from '../models/Progress.mjs';

export async function saveProgress(req, res) {
  try {
    const { user_id, level_id, progress_data, completed } = req.body;
    const newStatus = completed ? "completed" : "in_progress";

    // Ищем запись по userId и levelId. Если не найдена, создаем новую.
    const [progress, created] = await Progress.findOrCreate({
      where: { userId: user_id, levelId: level_id },
      defaults: {
        userId: user_id,
        levelId: level_id,
        status: newStatus,
        state: progress_data.state,
      },
    });

    // Если запись уже существует, обновляем её.
    if (!created) {
      progress.status = newStatus;
      progress.state = progress_data.state;
      await progress.save();
    }

    return res.json(progress);
  } catch (error) {
    console.error("Error saving progress:", error);
    return res.status(500).json({ error: "Failed to save progress" });
  }
}

export async function getProgressByUserAndLevel(req, res) {
  const { userId, levelId } = req.query;
  try {
    const progress = await Progress.findOne({
      where: { userId, levelId },
    });
    if (!progress) {
      return res.status(404).json({ message: 'Progress not found' });
    }
    res.json(progress);
  } catch (error) {
    console.error("Error getting progress:", error);
    res.status(500).json({ error: "Failed to get progress" });
  }
}

export async function getProgressByUserId(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const progress = await Progress.findOne({
      where: { userId, status: 'in_progress' },
      include: ['User', 'Level'], // Если вы настроили ассоциации
      order: [['updatedAt', 'DESC']]
    });

    if (!progress) {
      return res.status(404).json({ message: 'No in-progress level found for this user' });
    }

    return res.status(200).json({
      levelId: progress.levelId,
      state: progress.state,
      status: progress.status,
      // Если нужно, можно добавить level_data, например:
      level_data: progress.Level ? progress.Level.level_data : null,
    });
  } catch (error) {
    console.error("Error in getProgressByUserId:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
