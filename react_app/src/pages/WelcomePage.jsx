import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  wsGetSelf,
  wsLevelsCount,
  wsGetProgress,
  wsClaimDaily,
  wsLeaderboard,
} from "../sockets/socket";

const DAILY_COOLDOWN_MS = 5 * 60 * 1000;
const LOCALSTORAGE_KEY = "dailyGiftUnlockTime";

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
    (async () => {
      const me   = await wsGetSelf();
      const cnt  = await wsLevelsCount();
      let prog   = await wsGetProgress();
      if (prog.error) prog = { levelId: 1 };

      setUsername(me.username);
      setCoins(me.coins);
      setTotalLevels(cnt.count);
      setCurrentLevel(prog.levelId);
      checkCooldown();
    })();
  }, []);

  function checkCooldown() {
    const until = +localStorage.getItem(LOCALSTORAGE_KEY) || 0;
    if (Date.now() < until) {
      setGiftDisabled(true);
      setTimeout(checkCooldown, until - Date.now());
    } else {
      setGiftDisabled(false);
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }
  }

  const claimGift = async () => {
    const res = await wsClaimDaily();
    if (res.error === "cooldown") {
      localStorage.setItem(LOCALSTORAGE_KEY, res.next);
      setGiftDisabled(true);
      setTimeout(checkCooldown, res.next - Date.now());
      return;
    }
    setCoins(res.coins);
    localStorage.setItem(LOCALSTORAGE_KEY, Date.now() + DAILY_COOLDOWN_MS);
    setGiftDisabled(true);
    setTimeout(checkCooldown, DAILY_COOLDOWN_MS);
  };

  const openLeaders = async () => {
    const data = await wsLeaderboard();
    setLeaders(data);
    setShowLeadersModal(true);
  };

  function triggerEgg() {
    if (!audioRef.current) {
      audioRef.current = new Audio("/background.mp3");
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch(() => {});
    idleTimer.current = setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }, 60_000);
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
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Фоновое фото + анимация */}
      <div className="absolute inset-0 bg-animated-photo" />
      {/* Градиент‑оверлей, чтобы текст был читаем */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800 opacity-0" />
      {/* Сам контент поверх фона */}
      <div className="relative z-10 flex flex-col text-white px-4 py-6 h-full overflow-hidden">
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

            {/* Level panel */}
            <div className="bg-gray-800 bg-opacity-60 rounded-2xl p-6 w-full max-w-xs flex flex-col items-center">
              <div className="text-gray-400 text-sm mb-2">
                {totalLevels
                  ? `Level ${currentLevel}/${totalLevels}`
                  : `Level ${currentLevel}`}
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
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
            <div className="bg-gray-800 rounded-xl p-4 w-4/5 max-w-sm relative">
              <button
                onClick={() => setShowLeadersModal(false)}
                className="absolute top-2 right-2 text-white text-2xl"
              >
                ×
              </button>
              <h3 className="text-lg font-bold mb-4 text-center">Leaderboard</h3>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-sm text-gray-200">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Username</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaders.length > 0 ? (
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
    </div>
  );
}
