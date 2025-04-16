import { Router } from "express";
import { getSelf, claimDailyGift } from "../controllers/userController.mjs";

const router = Router();

// Все операции — с текущим пользователем из req.user
router.get ("/me",       getSelf);
router.post("/me/daily", claimDailyGift);

export default router;
