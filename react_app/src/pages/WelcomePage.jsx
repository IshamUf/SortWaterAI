import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

const DAILY_COOLDOWN_MS = 5 * 60 * 1000; // 5 минут
const LOCALSTORAGE_KEY = "dailyGiftUnlockTime";

export default function WelcomePage() {
  const navigate = useNavigate();

  // Состояния пользователя
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [coins, setCoins] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);

  // Состояние кнопки ежедневного подарка
  const [isGiftDisabled, setIsGiftDisabled] = useState(true);

  // Модальное окно лидеров + клоун-пасхалка
  const [showLeadersModal, setShowLeadersModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [showClowns, setShowClowns] = useState(false);
  const [clownExplosion, setClownExplosion] = useState(false);

  const audioRef = useRef(null);
  const idleTimer = useRef(null);
  const endTimer = useRef(null);
  const timeoutDuration = 10 * 60 * 1000;

  // 1) При загрузке: Инициализация пользователя (через Telegram либо fallback)
  //    Загрузка прогресса, настройка daily gift
  useEffect(() => {
    async function initUserAndProgress() {
      let tgUserId, tgUsername;
      if (
        window.Telegram &&
        window.Telegram.WebApp &&
        window.Telegram.WebApp.initDataUnsafe &&
        window.Telegram.WebApp.initDataUnsafe.user
      ) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        tgUserId = tgUser.id;
        tgUsername = tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : "");
      }
      if (!tgUserId) {
        tgUserId = "123456";
        tgUsername = "Test User";
      }

      try {
        // Создаём / Ищем пользователя по telegram_id
        const userResp = await api.post("/users/orCreate", {
          telegram_id: tgUserId.toString(),
          username: tgUsername,
        });
        const userData = userResp.data;
        setUserId(userData.id);
        setUsername(userData.username);
        setCoins(userData.coins);

        // Пробуем получить прогресс (in_progress)
        try {
          const progressResp = await api.get(`/progress?userId=${userData.id}`);
          const progData = progressResp.data;
          setCurrentLevel(progData.levelId);
        } catch (err) {
          if (err.response && err.response.status === 404) {
            setCurrentLevel(1);
          } else {
            console.error("Ошибка при запросе прогресса:", err);
          }
        }
      } catch (error) {
        console.error("Ошибка при создании/получении пользователя:", error);
        // Fallback: пользователь id=1
        try {
          const fallbackResp = await api.get("/users/1");
          const fallbackData = fallbackResp.data;
          setUserId(fallbackData.id);
          setUsername(fallbackData.username);
          setCoins(fallbackData.coins);
          setCurrentLevel(1);
        } catch (err) {
          console.error("Ошибка при получении fallback пользователя:", err);
        }
      }

      checkLocalCooldown();
    }
    initUserAndProgress();
  }, []);

  // 2) Проверка daily gift (localStorage)
  function checkLocalCooldown() {
    const storedTime = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!storedTime) {
      setIsGiftDisabled(false);
      return;
    }
    const unlockTime = parseInt(storedTime, 10);
    if (isNaN(unlockTime)) {
      localStorage.removeItem(LOCALSTORAGE_KEY);
      setIsGiftDisabled(false);
      return;
    }
    const now = Date.now();
    if (now < unlockTime) {
      setIsGiftDisabled(true);
      const remain = unlockTime - now;
      setTimeout(() => {
        setIsGiftDisabled(false);
        localStorage.removeItem(LOCALSTORAGE_KEY);
      }, remain);
    } else {
      setIsGiftDisabled(false);
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }
  }

  // 3) Обработчик ежедневного подарка
  const handleDailyGift = async () => {
    try {
      const resp = await api.post(`/users/${userId}/daily`);
      const data = resp.data;
      setCoins(data.coins);
      lockButtonFor5Minutes();
      console.log("Gift claimed successfully:", data);
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn("Подарок уже взят:", err.response.data.message);
        lockButtonFor5Minutes();
      } else {
        console.error(err);
      }
    }
  };

  function lockButtonFor5Minutes() {
    const unlockTime = Date.now() + DAILY_COOLDOWN_MS;
    localStorage.setItem(LOCALSTORAGE_KEY, unlockTime.toString());
    setIsGiftDisabled(true);
    setTimeout(() => {
      setIsGiftDisabled(false);
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }, DAILY_COOLDOWN_MS);
  }

  // 4) Логика лидеров (если нужна)
  const openLeadersModal = async () => {
    try {
      const resp = await api.get("/leaderboard");
      setLeaderboardData(resp.data);
      setShowLeadersModal(true);
    } catch (err) {
      console.error("Ошибка при загрузке таблицы лидеров:", err);
    }
  };

  const closeLeadersModal = () => {
    setShowLeadersModal(false);
  };

  // 5) Клоун-пасхалка
  const triggerEasterEgg = () => {
    console.log("🔥 Пасхалка активирована!");
    setShowClowns(true);
    setClownExplosion(true);

    // Попытка воспроизведения музыки
    if (!audioRef.current) {
      audioRef.current = new Audio("/background.mp3");
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch((e) => console.log("🎧 Ошибка:", e));

    // Через 60 секунд останавливаем музыку и убираем клоунов
    endTimer.current = setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setShowClowns(false);
      setClownExplosion(false);
    }, 60000);
  };

  // Сброс таймера неактивности
  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    clearTimeout(endTimer.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setShowClowns(false);
    setClownExplosion(false);

    idleTimer.current = setTimeout(() => {
      triggerEasterEgg();
    }, timeoutDuration);
  };

  // 6) Подключаем обработчик кликов для пасхалки
  useEffect(() => {
    window.addEventListener("click", resetIdleTimer);
    resetIdleTimer();
    return () => {
      window.removeEventListener("click", resetIdleTimer);
      clearTimeout(idleTimer.current);
      clearTimeout(endTimer.current);
    };
  }, []);

  // 7) Функция генерации клоунов
  function renderClowns() {
    return Array.from({ length: 15 }, (_, i) => (
      <div
        key={i}
        className="absolute text-3xl animate-bounce"
        style={{
          top: `${Math.random() * 80 + 10}%`,
          left: `${Math.random() * 80 + 10}%`,
          transform: `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`,
        }}
      >
        🤡
      </div>
    ));
  }

  // 8) Копирование текста в буфер обмена
  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText("@SortWaterAI");
      alert("Текст '@SortWaterAI' скопирован в буфер обмена!");
    } catch (err) {
      console.error("Ошибка копирования текста:", err);
    }
  }

  // Отрисовка компонента
  const navigateToGame = () => {
    // Переход на страницу GamePage, передавая userId через location.state
    navigate("/game", { state: { userId } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-6">
      <div className="w-[390px] h-[844px] bg-gray-900 rounded-3xl shadow-xl flex flex-col text-white relative overflow-hidden">

        {/* Верхняя панель */}
        <div className="flex justify-between items-center px-6 pt-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold">
              {username ? username[0].toUpperCase() : "?"}
            </div>
            <div>
              <div className="font-semibold text-sm">{username || "Loading..."}</div>
              <div className="text-yellow-300 text-xs flex items-center">
                🏆 {currentLevel}
              </div>
            </div>
          </div>
          <div className="bg-gray-700 px-3 py-1.5 rounded-full flex items-center space-x-1 text-sm">
            <span className="font-semibold">{coins}</span>
            <span className="text-yellow-400">🪙</span>
          </div>
        </div>

        {/* Основной контент */}
        <div className="flex-grow flex flex-col items-center justify-center">
          <h1 className="text-3xl font-extrabold mb-6 text-center">SortWaterAi</h1>
          <div className="flex space-x-8 mb-6">
            {/* Кнопка FREE DAILY GIFT */}
            <div className="flex flex-col items-center text-sm">
              <button
                onClick={handleDailyGift}
                disabled={isGiftDisabled}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-transform ${
                  isGiftDisabled
                    ? "bg-gray-600 cursor-not-allowed opacity-60"
                    : "bg-green-600 hover:bg-green-500 active:scale-95"
                }`}
              >
                🎁
              </button>
              <div className="mt-1 font-semibold text-xs">FREE DAILY GIFT</div>
            </div>

            {/* Кнопка LEADERS */}
            <div
              className="flex flex-col items-center text-sm cursor-pointer"
              onClick={openLeadersModal}
            >
              <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center text-2xl">
                📊
              </div>
              <div className="mt-1 font-semibold text-xs">LEADERS</div>
            </div>
          </div>

          {/* Информация об уровне и кнопка PLAY */}
          <div className="bg-gray-800 bg-opacity-60 rounded-2xl p-6 w-[80%] flex flex-col items-center">
            <div className="text-center text-sm text-gray-400 mb-2">
              Level {currentLevel}
            </div>
            <button
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 py-3 rounded-xl font-bold text-xl shadow-md hover:scale-105 transition"
              onClick={navigateToGame}
            >
              PLAY
            </button>
          </div>
        </div>

        {/* Кнопка копирования текста "@SortWaterAI" */}
        <div className="absolute bottom-3 w-full text-center">
          <button
            onClick={handleCopyText}
            className="text-xs text-gray-500 underline focus:outline-none"
          >
            @SortWaterAI
          </button>
        </div>

        {/* Модальное окно лидеров (если открыто) */}
        {showLeadersModal && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
            <div className="bg-gray-800 rounded-xl p-4 w-4/5 max-w-sm relative">
              <button
                onClick={closeLeadersModal}
                className="absolute top-2 right-2 text-white text-2xl font-bold"
              >
                &times;
              </button>
              <h3 className="text-lg font-bold mb-4 text-center">Leaderboard</h3>
              <table className="w-full text-left text-sm text-gray-200">
                <thead>
                  <tr>
                    <th className="pb-2">#</th>
                    <th className="pb-2">Username</th>
                    <th className="pb-2">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.length > 0 ? (
                    leaderboardData.map((entry, index) => (
                      <tr key={index} className="border-t border-gray-700">
                        <td className="py-1">{index + 1}</td>
                        <td className="py-1">{entry.username}</td>
                        <td className="py-1">{entry.completedLevels}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-2 text-center">
                        No data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Клоуны */}
        {showClowns && (
          <div className="absolute inset-0 pointer-events-none z-40">
            {renderClowns()}
          </div>
        )}
      </div>
    </div>
  );
}
