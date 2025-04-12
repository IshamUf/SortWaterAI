import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

const DAILY_COOLDOWN_MS = 5 * 60 * 1000; // 5 минут в мс
const LOCALSTORAGE_KEY = "dailyGiftUnlockTime";

export default function WelcomePage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [coins, setCoins] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);

  // Состояние кнопки ежедневного подарка
  const [isGiftDisabled, setIsGiftDisabled] = useState(true);

  // Состояние модального окна лидеров (если понадобится)
  const [showLeadersModal, setShowLeadersModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);

  // Клоун-пасхалка
  const [showClowns, setShowClowns] = useState(false);
  const [clownExplosion, setClownExplosion] = useState(false);
  const audioRef = useRef(null);
  const idleTimer = useRef(null);
  const endTimer = useRef(null);
  const timeoutDuration = 12000;

  // --------------------
  // При загрузке: получаем /users/1 и /progress?userId=1, а затем проверяем localStorage для разблокировки кнопки
  // --------------------
  useEffect(() => {
    async function fetchUserAndProgress() {
      try {
        const userResp = await api.get("/users/1");
        const userData = userResp.data;
        setUsername(userData.username);
        setCoins(userData.coins);

        try {
          const progressResp = await api.get("/progress?userId=1");
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
        console.error("Ошибка при запросе пользователя:", error);
      }

      checkLocalCooldown();
    }

    fetchUserAndProgress();
  }, []);

  /**
   * Проверяем, сохранено ли в localStorage время разблокировки кнопки ежедневного подарка.
   * Если оно ещё не наступило – блокируем кнопку, иначе разрешаем.
   */
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

  /**
   * Обработчик клика по кнопке ежедневного подарка.
   * Отправляет запрос POST /users/1/daily, обновляет монеты и блокирует кнопку на 5 минут.
   */
  const handleDailyGift = async () => {
    try {
      const resp = await api.post("/users/1/daily");
      const data = resp.data;
      setCoins(data.coins);
      lockButtonFor5Minutes();
      console.log("Gift claimed successfully:", data);
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn("Подарок уже взят: ", err.response.data.message);
        lockButtonFor5Minutes();
      } else {
        console.error(err);
      }
    }
  };

  /**
   * Блокирует кнопку ежедневного подарка на 5 минут, записывая время разблокировки в localStorage.
   */
  function lockButtonFor5Minutes() {
    const unlockTime = Date.now() + DAILY_COOLDOWN_MS;
    localStorage.setItem(LOCALSTORAGE_KEY, unlockTime.toString());
    setIsGiftDisabled(true);
    setTimeout(() => {
      setIsGiftDisabled(false);
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }, DAILY_COOLDOWN_MS);
  }

  // --------------------
  // Логика показа модального окна лидеров (если реализуете позже)
  // --------------------
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

  // --------------------
  // Пасхалка с клоунами
  // --------------------
  const triggerEasterEgg = () => {
    console.log("🔥 Пасхалка активирована!");
    setShowClowns(true);
    setClownExplosion(true);
    playAudio();
    endTimer.current = setTimeout(() => {
      stopAudio();
      setShowClowns(false);
      setClownExplosion(false);
    }, 60000);
  };

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    clearTimeout(endTimer.current);
    stopAudio();
    setShowClowns(false);
    setClownExplosion(false);
    idleTimer.current = setTimeout(() => {
      triggerEasterEgg();
    }, timeoutDuration);
  };

  useEffect(() => {
    window.addEventListener("click", resetIdleTimer);
    resetIdleTimer();
    return () => {
      window.removeEventListener("click", resetIdleTimer);
      clearTimeout(idleTimer.current);
      clearTimeout(endTimer.current);
    };
  }, []);

  const playAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/background.mp3");
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch((e) => console.log("🎧 Ошибка:", e));
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const renderClowns = () => {
    return Array.from({ length: 15 }, (_, i) => (
      <div
        key={i}
        className="absolute text-3xl animate-bounce"
        style={{
          top: `${Math.random() * 80 + 10}%`,
          left: `${Math.random() * 80 + 10}%`,
          transform: `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`
        }}
      >
        🤡
      </div>
    ));
  };

  /**
   * Обработчик кнопки копирования текста "@SortWaterAI" в буфер обмена.
   */
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText("@SortWaterAI");
      alert("Текст '@SortWaterAI' скопирован в буфер обмена!");
    } catch (err) {
      console.error("Ошибка копирования текста:", err);
    }
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
              <div className="text-yellow-300 text-xs flex items-center">🏆 {currentLevel}</div>
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
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-transform
                  ${
                    isGiftDisabled
                      ? "bg-gray-600 cursor-not-allowed opacity-60"
                      : "bg-green-600 hover:bg-green-500 active:scale-95"
                  }
                `}
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

          <div className="bg-gray-800 bg-opacity-60 rounded-2xl p-6 w-[80%] flex flex-col items-center">
            <div className="flex items-center space-x-2 text-white opacity-80 mb-1">
              <span className="text-xl">🔁</span>
              <span className="text-sm">Unlimited</span>
            </div>
            <div className="text-gray-400 text-sm mb-4">Level {currentLevel}</div>
            <button
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 py-3 rounded-xl font-bold text-xl shadow-md hover:scale-105 transition"
              onClick={() => navigate("/game")}
            >
              PLAY
            </button>
          </div>
        </div>

        {/* Модальное окно лидеров (если нужно, можете оставить или добавить позже) */}
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

        {/* Новая кнопка в самом низу страницы для копирования текста "@SortWaterAI" в буфер */}
        <div className="absolute bottom-3 w-full text-center">
          <button
            onClick={handleCopyText}
            className="text-xs text-gray-500 underline focus:outline-none"
          >
            @SortWaterAI
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Обработчик копирования текста "@SortWaterAI" в буфер обмена
 */
async function handleCopyText() {
  try {
    await navigator.clipboard.writeText("@SortWaterAI");
    alert("Текст '@SortWaterAI' скопирован в буфер обмена!");
  } catch (err) {
    console.error("Ошибка копирования текста:", err);
  }
}
