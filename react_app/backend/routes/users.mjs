// backend/routes/users.mjs
import { Router } from 'express';
import { createOrGetUser, getUser, claimDailyGift } from '../controllers/userController.mjs';

const router = Router();

// Используем эндпоинт для поиска или создания пользователя по telegram_id
router.post('/orCreate', createOrGetUser);
// Ежедневный подарок (работает по id)
router.post('/:id/daily', claimDailyGift);
// Получение пользователя по id
router.get('/:id', getUser);

export default router;
