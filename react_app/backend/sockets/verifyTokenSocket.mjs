// backend/sockets/verifyTokenSocket.mjs
import jwt from "jsonwebtoken";
import User from "../models/User.mjs";

const SECRET = process.env.JWT_SECRET;

export default async function verifyToken(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(); // нет токена — продолжаем к проверке initData

  try {
    const payload = jwt.verify(token, SECRET);
    const user = await User.findByPk(payload.sub);
    if (!user) throw new Error("unknown user");
    socket.user = user;
    return next();
  } catch (err) {
    // токен невалиден / истёк
    socket.emit("auth:expired");
    return next(new Error("token_invalid"));
  }
}
