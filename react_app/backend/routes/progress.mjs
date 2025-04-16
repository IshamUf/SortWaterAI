// backend/routes/progress.mjs
import express from "express";
import {
  startProgress,
  makeMove,
  getProgressByUser,
} from "../controllers/progressController.mjs";

const router = express.Router();

router.post("/start" , startProgress);  // создать / получить запись
router.post("/move"  , makeMove);       // один ход
router.get ("/"      , getProgressByUser);

export default router;
