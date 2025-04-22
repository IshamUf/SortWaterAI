import { io } from "socket.io-client";

const saved = sessionStorage.getItem("sw_token");
const socket = io("/", {
  transports: ["websocket"],
  auth: saved ? { token: saved } : { initData: window.Telegram?.WebApp?.initData },
});

/* автоматическое сохранение токена */
socket.on("auth:token", (t) => {
  sessionStorage.setItem("sw_token", t);
  socket.auth.token = t;
});

/* если срок вышел */
socket.on("auth:expired", () => {
  sessionStorage.removeItem("sw_token");
  window.location.reload(); // перезапрос initData → новый токен
});

/* helper для запросов с ack */
const req = (event, data) => new Promise((res) => socket.emit(event, data, res));

export const wsGetSelf     = ()         => req("user:get", null);
export const wsClaimDaily  = ()         => req("user:daily", null);
export const wsLevelsCount = ()         => req("levels:count", null);
export const wsLevelGet    = (id)       => req("levels:get", id);
export const wsLeaderboard = ()         => req("leaderboard:get", null);

export const wsGetProgress = ()         => req("progress:get", null);
export const wsStart       = (p)        => req("progress:start", p);
export const wsMove        = (p)        => req("progress:move", p);

export default socket;
