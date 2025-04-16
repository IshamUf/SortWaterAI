// frontend/pages/WelcomePage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

const DAILY_COOLDOWN_MS = 5 * 60 * 1000;
const LOCALSTORAGE_KEY = "dailyGiftUnlockTime";

export default function WelcomePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [coins, setCoins] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [totalLevels, setTotalLevels] = useState(0);          // NEW
  const [isGiftDisabled, setIsGiftDisabled] = useState(true);
  const [showLeadersModal, setShowLeadersModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [showClowns, setShowClowns] = useState(false);
  const [clownExplosion, setClownExplosion] = useState(false);

  const audioRef = useRef(null);
  const idleTimer = useRef(null);
  const endTimer = useRef(null);
  const timeoutDuration = 30 * 60 * 1000;

  useEffect(() => {
    async function init() {
      await initUserAndProgress();
      await loadLevelsCount();        // NEW
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Получаем общее количество уровней */
  async function loadLevelsCount() {
    try {
      const resp = await api.get("/levels/count");
      setTotalLevels(resp.data.count || 0);
    } catch (err) {
      console.error("Ошибка при получении количества уровней:", err);
    }
  }

  /** Создаём / получаем пользователя + текущий прогресс */
  async function initUserAndProgress() {
    let tgUserId, tgUsername;
    if (
      window.Telegram?.WebApp?.initDataUnsafe?.user
    ) {
      const u = window.Telegram.WebApp.initDataUnsafe.user;
      tgUserId = u.id;
      tgUsername = u.username || `${u.first_name}${u.last_name ? " " + u.last_name : ""}`;
      window.Telegram.WebApp.expand();
    }
    if (!tgUserId) {
      tgUserId = "123456";
      tgUsername = "Test User";
    }
    try {
      const userResp = await api.post("/users/orCreate", {
        telegram_id: tgUserId.toString(),
        username: tgUsername,
      });
      const userData = userResp.data;
      setUserId(userData.id);
      setUsername(userData.username);
      setCoins(userData.coins);

      try {
        const progResp = await api.get(`/progress?userId=${userData.id}`);
        setCurrentLevel(progResp.data.levelId);
      } catch (e) {
        if (e.response?.status !== 404) console.error("Ошибка прогресса:", e);
        setCurrentLevel(1);
      }
    } catch (error) {
      console.error("Ошибка user init:", error);
      setCurrentLevel(1);
    }
    checkLocalCooldown();
  }

  function checkLocalCooldown() {
    const storedTime = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!storedTime) return setIsGiftDisabled(false);
    const unlockTime = parseInt(storedTime, 10);
    if (isNaN(unlockTime)) {
      localStorage.removeItem(LOCALSTORAGE_KEY);
      return setIsGiftDisabled(false);
    }
    const now = Date.now();
    if (now < unlockTime) {
      setIsGiftDisabled(true);
      setTimeout(() => {
        setIsGiftDisabled(false);
        localStorage.removeItem(LOCALSTORAGE_KEY);
      }, unlockTime - now);
    } else {
      setIsGiftDisabled(false);
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }
  }

  const handleDailyGift = async () => {
    try {
      const resp = await api.post(`/users/${userId}/daily`);
      setCoins(resp.data.coins);
      lockButtonFor5Minutes();
    } catch (err) {
      if (err.response?.status === 429) lockButtonFor5Minutes();
      else console.error(err);
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

  const openLeadersModal = async () => {
    try {
      const resp = await api.get("/leaderboard");
      setLeaderboardData(resp.data);
      setShowLeadersModal(true);
    } catch (err) {
      console.error("Ошибка таблицы лидеров:", err);
    }
  };

  const closeLeadersModal = () => setShowLeadersModal(false);

  const triggerEasterEgg = () => {
    setShowClowns(true);
    setClownExplosion(true);
    if (!audioRef.current) {
      audioRef.current = new Audio("/background.mp3");
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch(console.log);
    endTimer.current = setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setShowClowns(false);
      setClownExplosion(false);
    }, 60000);
  };

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    clearTimeout(endTimer.current);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setShowClowns(false);
    setClownExplosion(false);
    idleTimer.current = setTimeout(triggerEasterEgg, timeoutDuration);
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

  const navigateToGame = () => navigate("/game", { state: { userId } });

  return (
    <div className="h-[100dvh] w-full flex flex-col justify-start bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-6 overflow-hidden">
      <div className="w-full max-w-lg mx-auto text-white flex flex-col h-full">
        {/* --- HEADER (user + coins) --- */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold">
              {username ? username[0].toUpperCase() : "?"}
            </div>
            <div>
              <div className="font-semibold text-sm break-words w-32">
                {username || "Loading..."}
              </div>
              <div className="text-yellow-300 text-xs flex items-center">
                🏆 {currentLevel}
              </div>
            </div>
          </div>
          <div className="bg-gray-700 px-3 py-1.5 rounded-full flex items-center space-x-1 text-sm">
            <span className="font-semibold">{coins}</span>
            <span className="text-gray-300">🪙</span>
          </div>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="flex flex-col items-center justify-center flex-grow gap-6">
          <h1 className="text-3xl font-extrabold text-center">SortWaterAi</h1>

          {/* buttons row */}
          <div className="flex justify-center space-x-8">
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

          {/* level panel */}
          <div className="bg-gray-800 bg-opacity-60 rounded-2xl p-6 w-full max-w-xs flex flex-col items-center">
            <div className="text-center text-sm text-gray-400 mb-2">
              {totalLevels
                ? `Level ${currentLevel}/${totalLevels}`
                : `Level ${currentLevel}`}
            </div>
            <button
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 py-3 rounded-xl font-bold text-xl shadow-md hover:scale-105 transition"
              onClick={navigateToGame}
            >
              PLAY
            </button>
          </div>
        </div>
      </div>

      {/* leader modal */}
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
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-sm text-gray-200">
                <thead>
                  <tr>
                    <th className="pb-2">#</th>
                    <th className="pb-2">Username</th>
                    <th className="pb-2">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.length ? (
                    leaderboardData.map((e, i) => (
                      <tr key={i} className="border-t border-gray-700">
                        <td className="py-1">{i + 1}</td>
                        <td className="py-1">{e.username}</td>
                        <td className="py-1">{e.completedLevels}</td>
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
        </div>
      )}

      {showClowns && (
        <div className="absolute inset-0 pointer-events-none z-40">
          {Array.from({ length: 15 }, (_, i) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
