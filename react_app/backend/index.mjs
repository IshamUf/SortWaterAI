import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";

import db from "./config/database.mjs";
import redisClient from "./utils/redisClient.mjs";

// backend/index.mjs
import "dotenv/config";
import express      from "express";
import cors         from "cors";
import { createServer } from "http";
import { Server }   from "socket.io";
import { fileURLToPath } from "url";
import path         from "path";

import db                  from "./config/database.mjs";
import verifyTelegramInit  from "./middleware/verifyTelegramInit.mjs";
import leaderboardRoutes   from "./routes/leaderboard.mjs";
import levelRoutes         from "./routes/levels.mjs";
import progressRoutes      from "./routes/progress.mjs";
import userRoutes          from "./routes/users.mjs";

import verifySocketAuth    from "./sockets/verifyTelegramInitSocket.mjs";
import registerWsHandlers  from "./sockets/handlers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5050;

/* -------------------------  Express  ------------------------- */
app.use(cors());
app.use(express.json());

// cтатика + SPA
app.use(express.static(path.join(__dirname, "public")));
app.get(/^\/(?!api\/).*/, (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// REST‑API (старый способ)
app.use("/api", verifyTelegramInit);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/levels",      levelRoutes);
app.use("/api/progress",    progressRoutes);
app.use("/api/users",       userRoutes);

/* ---------------------  WebSocket (socket.io)  --------------------- */
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// валидация Telegram initData при подключении
io.use(verifySocketAuth);

// регистрация событий для каждого клиента
io.on("connection", (socket) => {
  console.log("WS connect:", socket.id);
  registerWsHandlers(socket, io);
});

/* -----------------------  Startup sequence  ----------------------- */
async function waitForDatabase(retries = 10) {
  while (retries--) {
    try {
      await db.authenticate();
      console.log("Database ready");
      return;
    } catch {
      console.log("Waiting for database…");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Database not ready");
}

async function start() {
  try {
    await waitForDatabase();
    await db.sync();
    console.log("Database synced");

    httpServer.listen(PORT, () =>
      console.log(`HTTP + WebSocket server listening on :${PORT}`)
    );
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
