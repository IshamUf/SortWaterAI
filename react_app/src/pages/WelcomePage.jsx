// src/pages/WelcomePage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

const DAILY_COOLDOWN_MS = 5 * 60 * 1000;
const LS_KEY = "dailyGiftUnlockTime";

export default function WelcomePage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [coins, setCoins] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [totalLevels, setTotalLevels] = useState(0);
  const [giftDisabled, setGiftDisabled] = useState(true);
  const [leaders, setLeaders] = useState([]);
  const [showLeadersModal, setShowLeadersModal] = useState(false);

  const audioRef = useRef(null);
  const idleTimer = useRef(null);
  const TIMEOUT_MS = 30 * 60 * 1000;

  useEffect(() => {
    // инициализация данных пользователя и прогресса
    (async () => {
      try {
        // 1) Получаем текущего пользователя
        const { data: me } = await api.get("/users/me");
        setUsername(me.username);
        setCoins(me.coins);
      } catch (e) {
        console.error("Ошибка при получении пользователя:", e);
      }

      try {
        // 2) Текущий прогресс
        const { data: prog } = await api.get("/progress");
        setCurrentLevel(prog.levelId);
      } catch {
        setCurrentLevel(1);
      }

      try {
        // 3) Общее число уровней
        const { data } = await api.get("/levels/count");
        setTotalLevels(data.count || 0);
      } catch (e) {
        console.error("Ошибка при получении количества уровней:", e);
        setTotalLevels(0);
      }

      startCooldownChecker();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // проверка локального таймера на получение подарка
  function startCooldownChecker() {
    const unlockAt = +localStorage.getItem(LS_KEY) || 0;
    if (Date.now() < unlockAt) {
      setGiftDisabled(true);
      setTimeout(startCooldownChecker, unlockAt - Date.now());
    } else {
      setGiftDisabled(false);
      localStorage.removeItem(LS_KEY);
    }
  }

  // клик «получить подарок»
  async function claimGift() {
    try {
      const { data } = await api.post("/users/me/daily");
      setCoins(data.coins);
      localStorage.setItem(LS_KEY, Date.now() + DAILY_COOLDOWN_MS);
      setGiftDisabled(true);
      setTimeout(startCooldownChecker, DAILY_COOLDOWN_MS);
    } catch (e) {
      if (e.response?.status === 429) {
        // ещё не истёк таймаут
        setTimeout(startCooldownChecker, DAILY_COOLDOWN_MS);
      } else {
        console.error("Ошибка при получении подарка:", e);
      }
    }
  }

  // открываем модалку лидеров
  async function openLeaders() {
    try {
      const { data } = await api.get("/leaderboard");
      setLeaders(data);
      setShowLeadersModal(true);
    } catch (e) {
      console.error("Ошибка при загрузке лидеров:", e);
    }
  }

  // пасхалка по бездействию
  function triggerEgg() {
    if (!audioRef.current) {
      audioRef.current = new Audio("/background.mp3");
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch(() => {});
    idleTimer.current = setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }, 60000);
  }
  function resetIdle() {
    clearTimeout(idleTimer.current);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    idleTimer.current = setTimeout(triggerEgg, TIMEOUT_MS);
  }
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
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold">
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

        {/* Content */}
        <div className="flex flex-col items-center justify-center flex-grow gap-6">
          <h1 className="text-3xl font-extrabold">SortWaterAI</h1>
          <div className="flex space-x-8">
            <button
              onClick={claimGift}
              disabled={giftDisabled}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                giftDisabled ? "bg-gray-600 opacity-60" : "bg-green-600 hover:bg-green-500"
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

          {/* Level Panel */}
          <div className="bg-gray-800 bg-opacity-60 rounded-2xl p-6 w-full max-w-xs flex flex-col items-center">
            <div className="text-gray-400 text-sm mb-2">
              {totalLevels ? `Level ${currentLevel}/${totalLevels}` : `Level ${currentLevel}`}
            </div>
            <button
              onClick={() => navigate("/game")}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 py-3 rounded-xl text-xl font-bold shadow-md hover:scale-105 transition"
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
              className="absolute top-2 right-2 text-white text-2xl"
            >
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">Leaderboard</h3>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-sm text-gray-200">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Done</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((e, i) => (
                    <tr key={i} className="border-t border-gray-700">
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1">{e.username}</td>
                      <td className="py-1">{e.completedLevels}</td>
                    </tr>
                  ))}
                  {leaders.length === 0 && (
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
