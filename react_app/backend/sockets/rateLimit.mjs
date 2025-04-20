// backend/sockets/rateLimit.mjs
const WINDOW = 5_000; // 10 секунд
const MAX = 40;        // не более 40 событий за окно

export default function rateLimit(socket, next) {
  let calls = 0;

  /* обнуляем счётчик каждые WINDOW мс */
  const timer = setInterval(() => (calls = 0), WINDOW);
  socket.on("disconnect", () => clearInterval(timer));

  /* middleware для каждого входящего события */
  socket.use((packet, nextPacket) => {
    if (++calls > MAX) return nextPacket(new Error("rate_limit"));
    nextPacket();
  });

  next(); // пропускаем handshake дальше
}
