// src/pages/WelcomePage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

const DAILY_COOLDOWN_MS   = 5 * 60 * 1000;
const LOCALSTORAGE_KEY    = "dailyGiftUnlockTime";
const WEBAPP_QUERY_PREFIX = (() => {
  // rawInitData — это та самая строка "tgWebAppData=...&hash=...&user=..."
  const raw = window.Telegram?.WebApp?.initData
           || new URLSearchParams(window.location.search).get("tgWebAppData") && window.location.search.slice(1)
           || "";
  return raw ? `?${raw}` : "";
})();

export default function WelcomePage() {
  const navigate            = useNavigate();
  const [userId, setUserId] = useState(null);
  const [username, setUsername]   = useState("");
  const [coins, setCoins]         = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [totalLevels, setTotalLevels]   = useState(0);
  const [giftDisabled, setGiftDisabled] = useState(true);
  const [leaders, setLeaders]           = useState([]);
  const [showLeadersModal, setShowLeadersModal] = useState(false);

  const audioRef  = useRef(null);
  const idleTimer = useRef(null);
  const timeoutMs = 30 * 60 * 1000;

  useEffect(() => {
    (async () => {
      // --- 1) Получаем или создаём пользователя ---
      try {
        const { data: me } = await api.post(
          `/users/orCreate${WEBAPP_QUERY_PREFIX}`,
          {
            telegram_id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id.toString() || "123456",
            username:    window.Telegram?.WebApp?.initDataUnsafe?.user?.username
                           || "Guest",
          }
        );
        setUserId(me.id);
        setUsername(me.username);
        setCoins(me.coins);
      } catch (e) {
        console.error("Ошибка при orCreate:", e);
        return;
      }

      // --- 2) Получаем прогресс ---
      try {
        const { data: p } = await api.get(
          `/progress${WEBAPP_QUERY_PREFIX}`,
          { params: { userId } }
        );
        setCurrentLevel(p.levelId);
      } catch {
        setCurrentLevel(1);
      }

      // --- 3) Общее число уровней ---
      try {
        const { data } = await api.get(`/levels/count${WEBAPP_QUERY_PREFIX}`);
        setTotalLevels(data.count);
      } catch {
        setTotalLevels(0);
      }

      // --- 4) Запускаем таймер на подарки ---
      checkCooldown();
    })();
  //eslint-disable-next-line
  }, [userId]);

  function checkCooldown() {
    const ts = +localStorage.getItem(LOCALSTORAGE_KEY) || 0;
    if (Date.now() < ts) {
      setGiftDisabled(true);
      setTimeout(checkCooldown, ts - Date.now());
    } else {
      setGiftDisabled(false);
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }
  }

  const claimGift = async () => {
    try {
      const { data } = await api.post(
        `/users/me/daily${WEBAPP_QUERY_PREFIX}`
      );
      setCoins(data.coins);
      localStorage.setItem(LOCALSTORAGE_KEY, Date.now() + DAILY_COOLDOWN_MS);
      setGiftDisabled(true);
      setTimeout(checkCooldown, DAILY_COOLDOWN_MS);
    } catch (e) {
      if (e.response?.status === 429) {
        setTimeout(checkCooldown, DAILY_COOLDOWN_MS);
      } else {
        console.error("Ошибка при получении подарка:", e);
      }
    }
  };

  const openLeaders = async () => {
    try {
      const { data } = await api.get(`/leaderboard${WEBAPP_QUERY_PREFIX}`);
      setLeaders(data);
      setShowLeadersModal(true);
    } catch (e) {
      console.error("Ошибка при загрузке лидеров:", e);
    }
  };

  // **Easter‑egg** при простое
  const triggerEgg = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/background.mp3");
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch(() => {});
    idleTimer.current = setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }, 60_000);
  };
  const resetIdle = () => {
    clearTimeout(idleTimer.current);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    idleTimer.current = setTimeout(triggerEgg, timeoutMs);
  };
  useEffect(() => {
    window.addEventListener("click", resetIdle);
    resetIdle();
    return () => {
      window.removeEventListener("click", resetIdle);
      clearTimeout(idleTimer.current);
    };
  }, []);

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-gradient-to-b from-gray-900 to-gray-800 text-white px-4 py-6 overflow-hidden">
      <div className="max-w-lg w-full mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center font-bold">
              {username[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <div className="font-semibold text-sm break-words w-32">
                {username || "Loading..."}
              </div>
              <div className="text-yellow-300 text-xs">🏆 {currentLevel}</div>
            </div>
          </div>
          <div className="bg-gray-700 px-3 py-1.5 rounded-full flex items-center space-x-1 text-sm">
            <span className="font-semibold">{coins}</span>
            <span className="text-gray-300">🪙</span>
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-col items-center justify-center flex-grow gap-6">
          <h1 className="text-3xl font-extrabold">SortWaterAI</h1>
          <div className="flex space-x-8">
            <button
              onClick={claimGift}
              disabled={giftDisabled}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                giftDisabled
                  ? "bg-gray-600 opacity-60 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-500 active:scale-95"
              }`}
            >
              🎁
            </button>
            <button
              onClick={openLeaders}
              className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center text-2xl"
            >
              📊
            </button>
          </div>
          <div className="bg-gray-800 bg-opacity-60 rounded-2xl p-6 w-full max-w-xs flex flex-col items-center">
            <div className="text-gray-400 text-sm mb-2">
              {totalLevels
                ? `Level ${currentLevel}/${totalLevels}`
                : `Level ${currentLevel}`}
            </div>
            <button
              onClick={() => navigate("/game", { state: { userId } })}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 py-3 rounded-xl font-bold text-xl shadow-md hover:scale-105 transition"
            >
              PLAY
            </button>
          </div>
        </div>
      </div>

      {/* Leaders Modal */}
      {showLeadersModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-gray-800 rounded-xl p-4 w-4/5 max-w-sm relative">
            <button
              onClick={() => setShowLeadersModal(false)}
              className="absolute top-2 right-2 text-white text-2xl font-bold"
            >
              ×
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">Leaderboard</h3>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-sm text-gray-200">
                <thead>
                  <tr>
                    <th className="pb-2">#</th>
                    <th className="pb-2">User</th>
                    <th className="pb-2">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.length ? (
                    leaders.map((e, i) => (
                      <tr key={i} className="border-t border-gray-700">
                        <td className="py-1">{i + 1}</td>
                        <td className="py-1">{e.username}</td>
                        <td className="py-1">{e.completedLevels}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-2 text-center">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
);
}
