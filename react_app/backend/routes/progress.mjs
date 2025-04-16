import express from 'express';
import {
  startProgress,
  makeMove,
  getProgressByUser,
} from '../controllers/progressController.mjs';

const router = express.Router();

// старт/сброс прогресса (клиент шлёт { levelId, state })
router.post('/start', startProgress);

// один ход (клиент шлёт { levelId, from, to })
router.post('/move', makeMove);

// получить текущий in_progress
router.get('/', getProgressByUser);

export default router;
