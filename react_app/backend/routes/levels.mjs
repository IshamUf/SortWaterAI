import express from "express";
import { getLevelById } from "../controllers/levelController.mjs";

const router = express.Router();

// Получить уровень по ID
router.get("/:id", getLevelById);

export default router;