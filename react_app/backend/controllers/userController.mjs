// userController.mjs

import User from '../models/User.mjs';

export async function createUser(req, res) {
  const { username, password } = req.body;
  try {
    const user = await User.create({ username, password });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function getUser(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id, { attributes: ['id', 'username', 'coins'] });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}


export async function claimDailyGift(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Проверяем, прошло ли 5 минут с последнего подарка
    const now = new Date();
    const last = user.last_daily_reward ? new Date(user.last_daily_reward) : null;
    // 5 минут = 300000 миллисекунд
    if (last && (now - last) < 300000) {
      // Не прошло 5 минут, возвращаем ошибку
      return res.status(429).json({
        message: 'Wait 5 minutes before claiming again',
        // Можете вернуть точное время, когда можно будет снова нажать
        nextClaimAvailableAt: new Date(last.getTime() + 300000)
      });
    }

    // Начисляем 50 монет
    user.coins += 50;
    user.last_daily_reward = now;
    await user.save();

    return res.json({
      message: 'Daily gift claimed!',
      coins: user.coins,
      nextClaimAvailableAt: new Date(now.getTime() + 300000) // через 5 мин
    });
  } catch (error) {
    console.error('claimDailyGift error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}