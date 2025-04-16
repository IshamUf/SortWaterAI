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
  const [totalLevels, setTotalLevels] = useState(0);
  const [isGiftDisabled, setIsGiftDisabled] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeadersModal, setShowLeadersModal] = useState(false);

  const audioRef = useRef(null);
  const idleTimer = useRef(null);
  const timeoutMs = 30 * 60 * 1000;

  useEffect(() => {
    async function init() {
      // 1) Получаем или создаём пользователя через middleware
      try {
        const { data: user } = await api.get('/users/me');
        setUserId(user.id);
        setUsername(user.username);
        setCoins(user.coins);
      } catch (e) {
        console.error('Ошибка получения профиля:', e);
        return;
      }

      // 2) Получаем прогресс
      try {
        const { data: prog } = await api.get(`/progress?userId=${userId}`);
        setCurrentLevel(prog.levelId);
      } catch (e) {
        if (e.response?.status !== 404) console.error('Ошибка прогресса:', e);
        setCurrentLevel(1);
      }

      // 3) Получаем общее число уровней
      try {
        const { data } = await api.get('/levels/count');
        setTotalLevels(data.count || 0);
      } catch (e) {
        console.error('Ошибка получения количества уровней:', e);
        setTotalLevels(0);
      }

      // 4) Инициализируем таймер подарка
      checkCooldown();
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function checkCooldown() {
    const unlockTs = +localStorage.getItem(LOCALSTORAGE_KEY) || 0;
    if (Date.now() < unlockTs) {
      setIsGiftDisabled(true);
      setTimeout(checkCooldown, unlockTs - Date.now());
    } else {
      setIsGiftDisabled(false);
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }
  }

  const claimGift = async () => {
    try {
      const { data } = await api.post('/users/me/daily');
      setCoins(data.coins);
      localStorage.setItem(LOCALSTORAGE_KEY, Date.now() + DAILY_COOLDOWN_MS);
      setIsGiftDisabled(true);
      setTimeout(checkCooldown, DAILY_COOLDOWN_MS);
    } catch (e) {
      if (e.response?.status === 429) {
        setTimeout(checkCooldown, DAILY_COOLDOWN_MS);
      } else {
        console.error('Ошибка получения подарка:', e);
      }
    }
  };

  const openLeaders = async () => {
    try {
      const { data } = await api.get('/leaderboard');
      setLeaderboard(data);
      setShowLeadersModal(true);
    } catch (e) {
      console.error('Ошибка загрузки лидеров:', e);
    }
  };

  // Easter Egg
  const triggerEgg = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/background.mp3');
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch(() => {});
    idleTimer.current = setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }, 60000);
  };

  const resetIdle = () => {
    clearTimeout(idleTimer.current);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    idleTimer.current = setTimeout(triggerEgg, timeoutMs);
  };

  useEffect(() => {
    window.addEventListener('click', resetIdle);
    resetIdle();
    return () => {
      window.removeEventListener('click', resetIdle);
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
              {username[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="font-semibold text-sm break-words w-32">
                {username || 'Loading...'}
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
              disabled={isGiftDisabled}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-transform ${
                isGiftDisabled
                  ? 'bg-gray-600 cursor-not-allowed opacity-60'
                  : 'bg-green-600 hover:bg-green-500 active:scale-95'
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
              onClick={() => navigate('/game', { state: { userId } })}
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
                  <tr><th className="pb-2">#</th><th className="pb-2">User</th><th className="pb-2">Done</th></tr>
                </thead>
                <tbody>
                  {leaderboard.length ? (
                    leaderboard.map((e, i) => (
                      <tr key={i} className="border-t border-gray-700">
                        <td className="py-1">{i+1}</td>
                        <td className="py-1">{e.username}</td>
                        <td className="py-1">{e.completedLevels}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="3" className="py-2 text-center">No data</td></tr>
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
