import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((cfg) => {
  // Добавляем initData в заголовок
  const initData = window?.Telegram?.WebApp?.initData;
  if (initData) cfg.headers["X-TG-Init-Data"] = initData;
  return cfg;
});

export default api;
