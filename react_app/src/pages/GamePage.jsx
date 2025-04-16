import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";

/* ---------- Локальная логика игры ---------- */
const findTop = (t) => t.findIndex((c) => c !== -1);
function canPour(src, dst) {
  const from = findTop(src);
  if (from === -1) return false;
  const to = findTop(dst);
  if (to === 0) return false;
  return to === -1 || src[from] === dst[to];
}
function pour(src, dst) {
  const A = [...src], B = [...dst];
  let from = findTop(A);
  const color = A[from];
  let cnt = 1;
  for (let i = from + 1; i < A.length && A[i] === color; i++) cnt++;

  let to = findTop(B);
  to = to === -1 ? B.length - 1 : to - 1;

  let moved = false;
  while (cnt > 0 && to >= 0) {
    if (B[to] === -1) {
      B[to] = color;
      A[from] = -1;
      from++;
      to--;
      cnt--;
      moved = true;
    } else break;
  }
  return { A, B, moved };
}
const clone = (s) => s.map((t) => [...t]);
/* ------------------------------------------ */

/* ---------- карта цвета (как было раньше) ---------- */
function getColorBlock(color, layerIndex, tube) {
  const base =
    "w-full h-full mx-auto rounded-none transition-all duration-500 ease-in-out";
  const isBottomFilled =
    layerIndex === tube.length - 1 || tube[layerIndex + 1] === -1;
  const rounded = isBottomFilled ? "rounded-b-full" : "";
  const colorMap = {
    0: "bg-[#8CB4C9]",
    1: "bg-[#C9ADA7]",
    2: "bg-[#B5CDA3]",
    3: "bg-[#E0C097]",
    4: "bg-[#A9A9B3]",
    5: "bg-[#DAB6C4]",
    6: "bg-[#A1C6EA]",
    7: "bg-[#BFCBA8]",
  };
  return `${base} ${colorMap[color] || "bg-transparent"} ${rounded} opacity-90`;
}
/* --------------------------------------------------- */

export default function GamePage() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const [userId] = useState(navState?.userId || 1);

  const [coins, setCoins] = useState(0);
  const [levelId, setLevelId] = useState(null);
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("in_progress");

  const [sel, setSel] = useState(null);
  const [showModal, setShowModal] = useState(false);

  /* ---------- инициализация ---------- */
  useEffect(() => {
    (async () => {
      try {
        const u = await api.get(`/users/${userId}`);
        setCoins(u.data.coins);
      } catch (e) {
        console.error(e);
      }

      let p;
      try {
        p = (await api.get(`/progress?userId=${userId}`)).data;
      } catch (e) {
        if (e.response?.status !== 404) console.error(e);
      }
      if (!p) {
        const lvl = 1;
        const { data } = await api.get(`/levels/${lvl}`);
        await api.post("/progress/start", {
          userId,
          levelId: lvl,
          state: data.level_data.state,
        });
        p = {
          levelId: lvl,
          state: data.level_data.state,
          status: "in_progress",
        };
      }
      setLevelId(p.levelId);
      setState(p.state);
      setStatus(p.status);
      if (p.status === "completed") setShowModal(true);
    })();
  }, [userId]);

  if (!state)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800 text-white">
        Loading…
      </div>
    );

  /* ---------- клик по колбе ---------- */
  const clickTube = async (idx) => {
    if (status === "completed") return;

    if (sel === null) {
      if (state[idx][state[idx].length - 1] !== -1) setSel(idx);
      return;
    }
    if (sel === idx) {
      setSel(null);
      return;
    }
    if (!canPour(state[sel], state[idx])) {
      setSel(null);
      return;
    }

    const fromIdx = sel;
    const toIdx = idx;
    setSel(null);

    const { A, B } = pour(state[fromIdx], state[toIdx]);
    const optimistic = clone(state);
    optimistic[fromIdx] = A;
    optimistic[toIdx] = B;
    setState(optimistic);

    try {
      const resp = await api.post("/progress/move", {
        userId,
        levelId,
        from: fromIdx,
        to: toIdx,
      });
      setState(resp.data.state);
      setStatus(resp.data.status);
      if (resp.data.status === "completed") setShowModal(true);
    } catch (err) {
      console.error("move error:", err?.response?.data || err);
      setState(state);
    }
  };

  /* ---------- сброс ---------- */
  const reset = async () => {
    const { data } = await api.get(`/levels/${levelId}`);
    await api.post("/progress/start", {
      userId,
      levelId,
      state: data.level_data.state,
    });
    setState(data.level_data.state);
    setStatus("in_progress");
    setSel(null);
  };

  /* ---------- UI ---------- */
  const Tube = ({ tube, i }) => (
    <div
      onClick={() => clickTube(i)}
      className={`w-16 h-[160px] border-[4px] rounded-b-full rounded-t-xl flex flex-col justify-start items-stretch cursor-pointer ${
        sel === i ? "border-blue-400" : "border-[#3B3F45]"
      } bg-transparent overflow-hidden`}
    >
      <div className="flex flex-col justify-end pt-2 h-full">
        {tube.map((c, j) => (
          <div
            key={j}
            className={c === -1 ? "flex-1 mx-[2px] opacity-0" : getColorBlock(c, j, tube)}
          />
        ))}
      </div>
    </div>
  );

  const top = state.slice(0, 4),
    bottom = state.slice(4);

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-b from-gray-900 to-gray-800 text-white px-4 py-6">
      <div className="max-w-lg w-full mx-auto flex flex-col h-full">
        <div className="flex justify-between mb-4">
          <button
            onClick={() => navigate("/")}
            className="bg-gray-700 px-3 py-1.5 rounded-full text-sm"
          >
            &larr; Main
          </button>
          <div className="bg-gray-700 px-3 py-1.5 rounded-full text-sm flex items-center space-x-1">
            <span className="font-semibold">{coins}</span>
            <span className="text-yellow-400">🪙</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 flex-grow">
          <div className="text-sm text-gray-400">Level {levelId}</div>
          <h2 className="text-xl font-bold">
            {status === "completed" ? "Level Solved!" : "Keep playing…"}
          </h2>

          <div className="flex flex-col gap-4">
            <div className="flex justify-center gap-4">
              {top.map((t, i) => (
                <Tube key={i} tube={t} i={i} />
              ))}
            </div>
            {bottom.length > 0 && (
              <div className="flex justify-center gap-4">
                {bottom.map((t, i) => (
                  <Tube key={i + 4} tube={t} i={i + 4} />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={reset}
            className="bg-red-600 px-3 py-2 rounded-full max-w-xs w-full"
          >
            Reset Level
          </button>
        </div>
      </div>

      {showModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-gray-800 p-6 rounded-xl w-3/4 max-w-sm text-center">
            <h3 className="text-lg font-bold mb-4">Уровень пройден!</h3>
            <div className="flex flex-col space-y-3">
              <button
                className="bg-blue-600 px-4 py-2 rounded"
                onClick={() => window.location.reload()}
              >
                Continue
              </button>
              <button
                className="bg-gray-700 px-4 py-2 rounded"
                onClick={() => navigate("/")}
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
