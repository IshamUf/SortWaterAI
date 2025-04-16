import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";

import db from "./config/database.mjs";
import redisClient from "./utils/redisClient.mjs";

import verifyTelegramInit from "./middleware/verifyTelegramInit.mjs";
import leaderboardRoutes from "./routes/leaderboard.mjs";
import levelRoutes       from "./routes/levels.mjs";
import progressRoutes    from "./routes/progress.mjs";
import userRoutes        from "./routes/users.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// 1) отдаём статику+SPA
app.use(express.static(path.join(__dirname, "public")));
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 2) на все /api/* — проверка Telegram initData
app.use("/api", verifyTelegramInit);

// 3) API‑маршруты
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/levels",      levelRoutes);
app.use("/api/progress",    progressRoutes);
app.use("/api/users",       userRoutes);

// 4) Запуск после Redis → БД
async function waitForDatabase(retries = 10) {
  while (retries--) {
    try {
      await db.authenticate();
      console.log("Database ready");
      return;
    } catch {
      console.log("Waiting for database...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Database not ready");
}

async function startServer() {
  try {
    await redisClient.connect();
    console.log("Redis connected");

    await waitForDatabase();
    await db.sync();
    console.log("Database synced");

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (e) {
    console.error("Failed to start server:", e);
    process.exit(1);
  }
}

startServer();
