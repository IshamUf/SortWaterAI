// backend/routes/progress.mjs
import express from 'express';
import {
  saveProgress,
  getProgressByUserAndLevel,
  getProgressByUserId,
} from '../controllers/progressController.mjs';

const router = express.Router();

router.post('/', saveProgress);
router.get('/user-level', getProgressByUserAndLevel);
router.get('/', getProgressByUserId);

export default router;
