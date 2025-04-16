import { Router } from 'express';
import { getSelf, claimDailyGift } from '../controllers/userController.mjs';

const router = Router();

// все действия — с текущим пользователем из req.user
router.get('/me',       getSelf);
router.post('/me/daily', claimDailyGift);

export default router;
