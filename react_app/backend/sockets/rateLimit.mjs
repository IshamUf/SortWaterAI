// backend/sockets/rateLimit.mjs
const WINDOW = 5_000; // 10 сек
const MAX = 40;

export default function rateLimit(socket, next) {
  let calls = 0;
  const timer = setInterval(() => (calls = 0), WINDOW);
  socket.on("disconnect", () => clearInterval(timer));

  socket.use((_, __, fn) => {
    if (++calls > MAX) return fn(new Error("rate_limit"));
    fn();
  });

  next();
}
