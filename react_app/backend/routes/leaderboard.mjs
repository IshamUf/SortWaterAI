// backend/routes/leaderboard.mjs
import express from 'express';
import { getLeaderboard } from '../controllers/leaderboardController.mjs';

const router = express.Router();

// GET /api/leaderboard
router.get('/', getLeaderboard);

export default router;
