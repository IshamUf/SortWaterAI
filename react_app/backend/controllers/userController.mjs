// backend/controllers/userController.mjs
import User from '../models/User.mjs';

/**
 * POST /users/orCreate
 * Принимает:
 *   {
 *     telegram_id: string,
 *     username: string  // может начинаться с "@"
 *   }
 *
 * Если пользователь с данным telegram_id существует, возвращается его запись.
 * Если нет, создается новый пользователь. При этом, если username передан,
 * удаляется ведущий "@"; если username отсутствует или становится пустым, после создания
 * обновляется на "Player_<userId>".
 */
export async function createOrGetUser(req, res) {
  try {
    const { telegram_id, username } = req.body;
    // Ищем пользователя по telegram_id
    let user = await User.findOne({ where: { telegram_id } });
    
    if (!user) {
      let processedUsername = username ? username.replace(/^@/, '').trim() : "";
      
      // Создаем нового пользователя
      user = await User.create({
        telegram_id,
        username: processedUsername,
        coins: 0,
        last_daily_reward: null,
      });
      
      // Если имя пустое, задаем "Player_<userId>"
      if (!processedUsername) {
        user.username = `Player_${user.id}`;
        await user.save();
      }
    }
    
    return res.json(user);
  } catch (err) {
    console.error("Ошибка при создании или поиске пользователя:", err);
    return res.status(500).json({ error: "Ошибка при создании или поиске пользователя" });
  }
}

/**
 * GET /users/:id
 * Возвращает данные пользователя (id, username, coins)
 */
export async function getUser(req, res) {
  const { id } = req.params;
  try {
    const user = await User.findByPk(id, { attributes: ['id', 'username', 'coins'] });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    return res.json(user);
  } catch (err) {
    console.error("Ошибка при получении пользователя:", err);
    return res.status(500).json({ error: "Ошибка при получении пользователя" });
  }
}

/**
 * POST /users/:id/daily
 * Начисляет ежедневный подарок (увеличивает coins на 50)
 * с проверкой, прошло ли 5 минут с последнего получения.
 */
export async function claimDailyGift(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const now = new Date();
    const last = user.last_daily_reward ? new Date(user.last_daily_reward) : null;
    const fiveMinutes = 5 * 60 * 1000;
    
    if (last && (now - last) < fiveMinutes) {
      return res.status(429).json({
        message: 'Подождите 5 минут перед повторным получением подарка',
        nextClaimAvailableAt: new Date(last.getTime() + fiveMinutes)
      });
    }
    
    user.coins += 50;
    user.last_daily_reward = now;
    await user.save();
    
    return res.json({
      message: 'Ежедневный подарок получен!',
      coins: user.coins,
      nextClaimAvailableAt: new Date(now.getTime() + fiveMinutes)
    });
  } catch (error) {
    console.error("claimDailyGift error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
