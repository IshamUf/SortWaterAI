// src/pages/GamePage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";

// Helpers
const findTop = (tube) => tube.findIndex((c) => c !== -1);
const cloneState = (s) => s.map((t) => [...t]);
const canPour = (A, B) => {
  const f = findTop(A); if (f === -1) return false;
  const t = findTop(B); if (t === 0) return false;
  return t === -1 || A[f] === B[t];
};
const pour = (A0, B0) => {
  const A = [...A0], B = [...B0];
  let f = findTop(A), col = A[f];
  let cnt = 1;
  for (let i = f+1; i < A.length && A[i] === col; i++) cnt++;
  let t = findTop(B); t = t === -1 ? B.length - 1 : t - 1;
  while (cnt > 0 && t >= 0 && B[t] === -1) {
    B[t] = col; A[f] = -1; f++; t--; cnt--;
  }
  return { newA: A, newB: B };
};
const isSolved = (state) =>
  state.every(
    (tube) =>
      tube.every((c) => c === -1) ||
      tube.every((c) => c !== -1 && c === tube[0])
  );

function Tube({ tube, idx, onClick, selected }) {
  return (
    <div
      onClick={() => onClick(idx)}
      className={`w-16 h-[160px] border-4 rounded-b-full rounded-t-xl flex flex-col justify-end overflow-hidden cursor-pointer ${
        selected ? "border-blue-400" : "border-[#3B3F45]"
      }`}
    >
      {tube.map((c, i) => (
        <div
          key={i}
          className={`flex-1 mx-[2px] transition-opacity ${
            c === -1 ? "opacity-0" : "opacity-90"
          }`}
          style={{
            backgroundColor:
              c === -1
                ? "transparent"
                : [
                    "#8CB4C9",
                    "#C9ADA7",
                    "#B5CDA3",
                    "#E0C097",
                    "#A9A9B3",
                    "#DAB6C4",
                    "#A1C6EA",
                    "#BFCBA8",
                  ][c],
            borderRadius:
              i === tube.length - 1 || tube[i + 1] === -1 ? "0 0 9999px 9999px" : 0,
          }}
        />
      ))}
    </div>
  );
}

export default function GamePage() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const [userId] = useState(navState?.userId || 1);

  const [levelId, setLevelId] = useState(null);
  const [tubes, setTubes] = useState(null);
  const [coins, setCoins] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    (async () => {
      // get self coins
      try {
        const { data: me } = await api.get(`/users/${userId}`);
        setCoins(me.coins);
      } catch {}

      // get progress
      let prog;
      try {
        prog = (await api.get(`/progress?userId=${userId}`)).data;
      } catch {
        prog = null;
      }

      // if none, start level 1
      if (!prog) {
        const lvl1 = (await api.get("/levels/1")).data;
        await api.post("/progress", {
          user_id: userId,
          level_id: 1,
          progress_data: { state: lvl1.level_data.state },
          completed: false,
        });
        prog = { levelId: 1, state: lvl1.level_data.state };
      }

      setLevelId(prog.levelId);
      setTubes(prog.state);
    })();
  }, [userId]);

  if (!tubes) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
        Loading…
      </div>
    );
  }

  const solved = isSolved(tubes);

  const handleClick = async (i) => {
    if (solved) return;
    if (selected === null) {
      if (tubes[i][tubes[i].length - 1] !== -1) setSelected(i);
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    if (!canPour(tubes[selected], tubes[i])) {
      setSelected(null);
      return;
    }

    // optimistic update
    const { newA, newB } = pour(tubes[selected], tubes[i]);
    const next = cloneState(tubes);
    next[selected] = newA;
    next[i] = newB;
    setTubes(next);
    setSelected(null);

    // send move
    try {
      const { data } = await api.post("/progress", {
        user_id: userId,
        level_id: levelId,
        progress_data: { state: next },
        completed: isSolved(next),
      });
      setTubes(data.state);
      if (data.status === "completed") setShowModal(true);
    } catch {}
  };

  const resetLevel = async () => {
    const lvl = (await api.get(`/levels/${levelId}`)).data;
    await api.post("/progress", {
      user_id: userId,
      level_id: levelId,
      progress_data: { state: lvl.level_data.state },
      completed: false,
    });
    setTubes(lvl.level_data.state);
    setSelected(null);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-gradient-to-b from-gray-900 to-gray-800 text-white px-4 py-6 overflow-hidden">
      <div className="max-w-lg w-full mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => navigate("/")}
            className="bg-gray-700 px-3 py-1.5 rounded-full text-sm"
          >
            &larr; Main
          </button>
          <div className="bg-gray-700 px-3 py-1.5 rounded-full flex items-center space-x-1 text-sm">
            <span className="font-semibold">{coins}</span>
            <span className="text-yellow-400">🪙</span>
          </div>
        </div>

        {/* Field */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="text-gray-400 text-sm mb-2">Level {levelId}</div>
          <h2 className="text-xl font-bold mb-4">
            {solved ? "Level Solved!" : "Keep playing..."}
          </h2>
          <div className="flex justify-center gap-4 flex-wrap">
            {tubes.map((tube, i) => (
              <Tube
                key={i}
                tube={tube}
                idx={i}
                onClick={handleClick}
                selected={selected === i}
              />
            ))}
          </div>
          <button
            onClick={resetLevel}
            className="mt-4 w-full bg-red-600 hover:bg-red-500 py-2 rounded-full font-semibold transition"
          >
            Reset Level
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-gray-800 p-6 rounded-xl w-4/5 max-w-sm text-center">
            <h3 className="text-lg font-bold mb-4">Уровень пройден!</h3>
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 px-4 py-2 rounded"
              >
                Continue
              </button>
              <button
                onClick={() => navigate("/")}
                className="bg-gray-700 px-4 py-2 rounded"
              >
                Main
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
