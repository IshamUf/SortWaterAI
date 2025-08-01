```markdown
# SortWater AI  
*Water-Sort puzzle with a real AI assistant*

> **Play → ask 🤖 to auto-solve (100 coin) or ❓ to get one smart hint (10 coin).  
> Everything – UI, realtime back-end and RL-agent – lives in this monorepo.*

---

## 0  Quick start (all-in-Docker)

```bash
git clone https://github.com/your-org/SortWaterAI.git
cd SortWaterAI

# one-time env samples
cp react_app/.env.example                 react_app/.env
cp sortwaterai-bot/ai_functions/.env.example sortwaterai-bot/ai_functions/.env

# four containers: Web + DB + AI + reverse-proxy
docker compose up --build
```

Open <http://localhost:5050> – Telegram-style WebApp is ready to play.

---

## 1  Repository layout

| Path | Purpose | Main tech |
|------|---------|-----------|
| **`react_app/`** | Front-end **and** realtime back-end gateway | React 19, Vite, Tailwind<br>Express + Socket.IO |
|  `src/` | SPA pages, sockets, styles | |
| `backend/` | REST helpers, WS-handlers, models | Node 18 |
| **`sortwaterai-bot/`** | Stand-alone AI micro-service | FastAPI, PyTorch |
| `ai_functions/` | RL solver & level generator | Masked-DQN |
| **`experiments/`** | Jupyter notebooks, training scripts, graphs | |
| **`docker-compose.yml`** | Boots **PostgreSQL**, **SortWater-web**, **AI-service** | |
| misc | `LICENSE`, this `README.md` | |

---

## 2  Tech stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **UI** | React 19 + Vite | fast HMR, modern JSX |
| **Transport** | Socket.IO (pure WS) | instant state sync |
| **Back-end** | Express | lightweight WS-gateway |
| **DB** | PostgreSQL 15 (JSONB) | store level state as one row |
| **AI** | FastAPI + Masked-DQN | stateless, GPU-ready |
| **Auth** | Telegram `initData` → JWT | no passwords |
| **Ops** | Docker Compose, GH-Actions | 100 % reproducible |

---

## 3  Dev mode

```bash
# 1  database
docker compose up -d postgres

# 2  (optional) AI service
docker compose up -d ai_func

# 3  SPA + WS gateway with hot-reload
cd react_app
npm i
npm run dev          # → http://localhost:5173
```


---

## 4  High-level flow

```text
┌────────────┐        websocket        ┌────────────┐
│ React SPA  │  ───────────────────►  │ Express WS │
│  (client)  │  ◄───────────────────  │  backend   │
└────────────┘                        │ +Sequelize │
        ▲  hint / solve http          └──────┬─────┘
        │                                     │
        │                          JSONB      ▼
        │                            ┌────────────────┐
        └──────────────────────────► │ PostgreSQL 15  │
                                     └────────────────┘
        solve_level(state) http
┌────────────────┐
│  FastAPI  AI   │   Masked-DQN agent
└────────────────┘
```

---

## 5  Database schema (Sequelize)

```text
Users(id, telegram_id, username, coins, score JSONB, last_daily_reward)
Levels(id, level_data JSON, ai_steps, difficulty)
Progress(userId, levelId, state JSON, moves, status, solvedByAI BOOL)
```

*JSONB lets us analyse real game states directly for RL retraining.*

---

## 6  CLI helpers (inside **`sortwaterai-bot/`**)

| Script | Purpose |
|--------|---------|
| `insert_new_levels.py` | bulk-load JSON levels to DB |
| `add_impossible_level2.py` | stress-test AI on edge cases |
| `create_random_user.py` | seed demo users |
| `bot.py` | Telegram bot wrapper (future work) |

