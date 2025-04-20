import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import path from "path";

import db from "./config/database.mjs";
import verifySocketAuth from "./sockets/verifyTelegramInitSocket.mjs";
import registerHandlers from "./sockets/handlers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5050;

/* статика + SPA */
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

/* WebSocket‑сервер */
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.use(verifySocketAuth);
io.on("connection", (socket) => {
  console.log("WS connect:", socket.id);
  registerHandlers(socket, io);
});

/* запуск */
(async () => {
  try {
    await db.authenticate();
    await db.sync();
    httpServer.listen(PORT, () =>
      console.log(`WS‑only server listening on :${PORT}`)
    );
  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
})();
