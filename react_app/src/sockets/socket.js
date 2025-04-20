import { io } from "socket.io-client";

const socket = io("/", {
  transports: ["websocket"],
  auth: { initData: window?.Telegram?.WebApp?.initData },
});

/* ---------- generic helper ---------- */
const request = (event, payload) =>
  new Promise((res) => socket.emit(event, payload, res));

/* ---------- exports ---------- */
export const wsGetSelf      = ()            => request("user:get");
export const wsClaimDaily   = ()            => request("user:daily");
export const wsLevelsCount  = ()            => request("levels:count");
export const wsLeaderboard  = ()            => request("leaderboard:get");

export const wsGetProgress  = ()            => request("progress:get");
export const wsStart        = (p)           => request("progress:start", p);
export const wsMove         = (p)           => request("progress:move", p);

export default socket;
