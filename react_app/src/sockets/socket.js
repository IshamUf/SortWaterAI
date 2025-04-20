// src/sockets/socket.js
import { io } from "socket.io-client";

const socket = io("/", {
  transports: ["websocket"], // Telegram WebApp допускает WS
  auth: {
    initData: window?.Telegram?.WebApp?.initData,
  },
});

/* ---------- helpers c acks ---------- */
export const wsMove = ({ levelId, from, to }) =>
  new Promise((res) =>
    socket.emit("progress:move", { levelId, from, to }, (answer) => res(answer))
  );

export const wsGetProgress = () =>
  new Promise((res) =>
    socket.emit("progress:get", (answer) => res(answer))
  );

export const wsStart = ({ levelId, state }) =>
  new Promise((res) =>
    socket.emit("progress:start", { levelId, state }, (answer) => res(answer))
  );

export default socket;
