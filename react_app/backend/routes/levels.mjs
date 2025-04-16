// backend/routes/levels.mjs
import express from "express";
import {
  getLevelById,
  getLevelsCount,
} from "../controllers/levelController.mjs";

const router = express.Router();

// Сначала «специальные» роуты, потом параметрические
router.get("/count", getLevelsCount); // /levels/count
router.get("/:id", getLevelById);     // /levels/:id

export default router;
