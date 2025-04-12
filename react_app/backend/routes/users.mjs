import { Router } from 'express';
import { createUser, getUser, claimDailyGift } from '../controllers/userController.mjs';

const router = Router();

router.post('/:id/daily', claimDailyGift);
router.post('/', createUser);
router.get('/:id', getUser);

export default router;
