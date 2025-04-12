// backend/controllers/leaderboardController.mjs
import Progress from '../models/Progress.mjs';
import User from '../models/User.mjs';

// Для агрегатных функций (COUNT, etc.) нужны объекты из sequelize
import { fn, col, literal } from 'sequelize';

export async function getLeaderboard(req, res) {
  try {
    // Ищем все записи в Progress со статусом 'completed'
    // Группируем по userId, считаем количество completed
    // Присоединяем User, чтобы получить username
    const results = await Progress.findAll({
      where: { status: 'completed' },
      attributes: [
        'userId',
        [fn('COUNT', col('status')), 'completedCount'], // count(*)
      ],
      group: ['userId', 'User.id'], // обязательно указываем group по всем полям include
      order: [[literal('"completedCount"'), 'DESC']], // сортируем по count
      include: [
        {
          model: User,
          attributes: ['username'],
        },
      ],
      raw: true, // Чтобы вернулись "плоские" объекты
    });

    // results может выглядеть так:
    // [
    //   {
    //     userId: 1,
    //     completedCount: 5,
    //     "User.username": "Arslan",
    //     "User.id": 1,
    //     ...
    //   },
    //   ...
    // ]
    // Преобразуем под удобный фронту формат
    const leaderboard = results.map((row) => ({
      username: row["User.username"],
      completedLevels: row.completedCount,
    }));

    return res.status(200).json(leaderboard);
  } catch (err) {
    console.error("Error in getLeaderboard:", err);
    return res.status(500).json({ error: "Failed to get leaderboard" });
  }
}
