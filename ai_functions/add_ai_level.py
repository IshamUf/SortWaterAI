#!/usr/bin/env python3
"""
AI‑INGEST — сервис добавления сгенерированных уровней (v3).

При старте проверяем, сколько уровней уже есть в БД:
  - если их меньше WINDOW_LEVELS, работаем в «простом» режиме:
    просто вставляем случайные уникальные уровни без учёта распределения;
  - иначе — используем алгоритм «минимального Δ» по L1‑дистанции
    к целевому TARGET_DISTRIB.

Повторяем запрос у модели (до MAX_GENERATE_ATTEMPTS), пока не вставим
add_count уровней. Если не смогли — выходим с кодом 2.
"""

import os
import sys
import json
import random
import hashlib
import psycopg2
from datetime import datetime
from dotenv import load_dotenv
from typing import List, Dict

# ------------------------- settings (.env) ---------------------------------
load_dotenv()

DB_CFG = {
    "dbname":   os.getenv("POSTGRES_DB"),
    "user":     os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
    "host":     os.getenv("POSTGRES_HOST", "localhost"),
    "port":     int(os.getenv("POSTGRES_PORT", 5432)),
}

TARGET_DISTRIB   = json.loads(os.getenv("TARGET_DISTRIB", '{"easy":0.3,"medium":0.5,"hard":0.2}'))
STEPS_THRESHOLDS = json.loads(os.getenv("STEPS_THRESHOLDS", '{"easy":[0,10],"medium":[11,25],"hard":[26,999]}'))
WINDOW_LEVELS    = int(os.getenv("WINDOW_LEVELS", 10))
MAX_ATTEMPTS     = int(os.getenv("MAX_GENERATE_ATTEMPTS", 5))

# ------------------------- helpers ----------------------------------------
def classify(ai_steps: int) -> str:
    for diff, (lo, hi) in STEPS_THRESHOLDS.items():
        if lo <= ai_steps <= hi:
            return diff
    return "unknown"

def fetch_stats(cur) -> Dict[str, int]:
    cur.execute(
        f"""SELECT difficulty, COUNT(*) FROM (
                 SELECT difficulty
                 FROM "Levels"
                 ORDER BY id DESC
                 LIMIT {WINDOW_LEVELS}
             ) sub
             GROUP BY difficulty"""
    )
    return {d: n for d, n in cur.fetchall()}

def l1_distance(stats: Dict[str, int]) -> float:
    total = sum(stats.values()) or 1
    return sum(abs(stats.get(k, 0)/total - TARGET_DISTRIB.get(k, 0))
               for k in TARGET_DISTRIB)

def fingerprint(state) -> str:
    """SHA1 по нормализованному JSON состояния."""
    norm = json.dumps(state, separators=(",", ":"), sort_keys=True)
    return hashlib.sha1(norm.encode()).hexdigest()

def existing_hashes(cur) -> set:
    cur.execute('SELECT encode(digest(level_data, \'sha1\'), \'hex\') FROM "Levels"')
    return {h[0] for h in cur.fetchall()}

# ------------------------- AI generator (заглушка) ------------------------
def get_generated_levels(model: str, count: int) -> List[Dict]:
    """DEMO‑заглушка – замените реальным вызовом модели."""
    random.seed()
    demo = []
    # генерим квадратные состояния 5×5
    for _ in range(count):
        col = 5
        state = [[random.randint(0, 7) for _ in range(col)] for __ in range(col)]
        demo.append({
            "state":    state,
            "ai_steps": random.randint(5, 40)
        })
    return demo

# ------------------------- main routine -----------------------------------
def run_ingest(model_name: str, add_count: int):
    conn = psycopg2.connect(**DB_CFG)
    cur  = conn.cursor()

    # проверяем режим: simple если записей < WINDOW_LEVELS
    cur.execute('SELECT COUNT(*) FROM "Levels"')
    total_levels = cur.fetchone()[0]
    simple_mode = total_levels < WINDOW_LEVELS
    if simple_mode:
        print(f"⚠️  Detected only {total_levels} levels (< WINDOW_LEVELS={WINDOW_LEVELS}), "
              "switching to random insert mode.")

    db_hashes     = existing_hashes(cur)
    in_run_hashes = set()

    pool     : List[Dict] = []
    attempts  = 0
    inserted  = 0

    while inserted < add_count and attempts < MAX_ATTEMPTS:
        if not pool:
            # запрос новой партии из модели
            batch = add_count * 3
            pool = get_generated_levels(model_name, batch)
            random.shuffle(pool)
            for lvl in pool:
                lvl["difficulty"] = classify(lvl["ai_steps"])
            attempts += 1

        if not pool:
            break

        # выбираем индекс лучшего кандидата
        best_idx = None
        best_delta = float("inf")

        if simple_mode:
            # просто первый уникальный
            for idx, lvl in enumerate(pool):
                fph = fingerprint(lvl["state"])
                if fph not in db_hashes and fph not in in_run_hashes:
                    best_idx = idx
                    break
        else:
            # минимизируем L1‑дистанцию к TARGET_DISTRIB
            stats_now = fetch_stats(cur)
            dist_now  = l1_distance(stats_now)
            for idx, lvl in enumerate(pool):
                fph = fingerprint(lvl["state"])
                if fph in db_hashes or fph in in_run_hashes:
                    continue
                tmp = stats_now.copy()
                tmp[lvl["difficulty"]] = tmp.get(lvl["difficulty"], 0) + 1
                delta = l1_distance(tmp) - dist_now
                if delta < best_delta:
                    best_delta, best_idx = delta, idx
                    if delta < 0:
                        break

        if best_idx is None:
            pool.clear()
            continue

        lvl = pool.pop(best_idx)
        fph = fingerprint(lvl["state"])

        # вставляем в БД
        cur.execute(
            """INSERT INTO "Levels"
               (level_data, difficulty, ai_steps, "createdAt", "updatedAt")
               VALUES (%s,%s,%s,%s,%s)""",
            (
                json.dumps({"state": lvl["state"]}),
                lvl["difficulty"],
                lvl["ai_steps"],
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )
        conn.commit()
        inserted += 1
        db_hashes.add(fph)
        in_run_hashes.add(fph)

        if simple_mode:
            print(f"#{inserted:>3}: [random] diff={lvl['difficulty']:6} steps={lvl['ai_steps']:>3}")
        else:
            print(f"#{inserted:>3}: diff={lvl['difficulty']:6} steps={lvl['ai_steps']:>3} Δ={best_delta:+.4f}")

    cur.close()
    conn.close()

    if inserted < add_count:
        print(f"⚠️  Added only {inserted}/{add_count} levels "
              f"(after {attempts} attempts).", file=sys.stderr)
        sys.exit(2)

    print(f"✅  Successfully added {inserted} level(s) from model {model_name}.")

# ------------------------- CLI wrapper ------------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: add_ai_level.py <model_name> <count>")
        sys.exit(1)
    run_ingest(sys.argv[1], int(sys.argv[2]))

