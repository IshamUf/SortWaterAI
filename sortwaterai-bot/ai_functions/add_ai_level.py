#!/usr/bin/env python3
"""
AI‑INGEST — сервис добавления сгенерированных уровней (v3).
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

# чтобы скрипт мог импортировать соседний модуль get_generated_levels.py
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from get_generated_levels import get_generated_levels

# ------------------------- settings (.env) ---------------------------------
load_dotenv()

DB_CFG = {
    "dbname":   os.getenv("POSTGRES_DB"),
    "user":     os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
    "host":     os.getenv("POSTGRES_HOST", "localhost"),
    "port":     int(os.getenv("POSTGRES_PORT", 5432)),
}

TARGET_DISTRIB   = json.loads(os.getenv("TARGET_DISTRIB"))
STEPS_THRESHOLDS = json.loads(os.getenv("STEPS_THRESHOLDS"))
WINDOW_LEVELS    = int(os.getenv("WINDOW_LEVELS", 10))
MAX_ATTEMPTS     = int(os.getenv("MAX_GENERATE_ATTEMPTS", 5))

# ------------------------- helpers ----------------------------------------
def classify(ai_steps: int) -> str:
    for diff, (lo, hi) in STEPS_THRESHOLDS.items():
        if lo <= ai_steps <= hi:
            return diff
    return "unknown"

def fetch_stats(cur) -> Dict[str, int]:
    cur.execute(f"""
        SELECT difficulty, COUNT(*) FROM (
          SELECT difficulty
          FROM "Levels"
          ORDER BY id DESC
          LIMIT {WINDOW_LEVELS}
        ) sub
        GROUP BY difficulty
    """)
    return {d: n for d, n in cur.fetchall()}

def l1_distance(stats: Dict[str, int]) -> float:
    total = sum(stats.values()) or 1
    return sum(
        abs(stats.get(k, 0)/total - TARGET_DISTRIB.get(k, 0))
        for k in TARGET_DISTRIB
    )

def fingerprint(state) -> str:
    norm = json.dumps(state, separators=(",", ":"), sort_keys=True)
    return hashlib.sha1(norm.encode()).hexdigest()

def existing_hashes(cur) -> set:
    cur.execute('SELECT level_data FROM "Levels"')
    hashes = set()
    for (raw,) in cur.fetchall():
        try:
            st = json.loads(raw).get("state")
            if st is None: continue
            hashes.add(fingerprint(st))
        except Exception:
            continue
    return hashes

# ------------------------- main routine -----------------------------------
def run_ingest(model_name: str, add_count: int):
    conn = psycopg2.connect(**DB_CFG)
    cur  = conn.cursor()

    # выбираем режим
    cur.execute('SELECT COUNT(*) FROM "Levels"')
    total = cur.fetchone()[0]
    simple_mode = total < WINDOW_LEVELS
    if simple_mode:
        print(f"⚠️  Only {total} levels (<{WINDOW_LEVELS}), random mode.")

    db_hashes     = existing_hashes(cur)
    in_run_hashes = set()
    pool: List[Dict] = []
    attempts = 0
    inserted = 0

    while inserted < add_count and attempts < MAX_ATTEMPTS:
        if not pool:
            batch = add_count * 3
            pool = get_generated_levels(model_name, batch)
            random.shuffle(pool)
            for lvl in pool:
                lvl["difficulty"] = classify(lvl["ai_steps"])
            attempts += 1

        if not pool:
            break

        # выбираем лучший по Δ или просто первый уникальный
        best_idx = None
        best_delta = float("inf")

        if simple_mode:
            for i, lvl in enumerate(pool):
                fph = fingerprint(lvl["state"])
                if fph not in db_hashes and fph not in in_run_hashes:
                    best_idx = i
                    break
        else:
            stats_now = fetch_stats(cur)
            dist_now = l1_distance(stats_now)
            for i, lvl in enumerate(pool):
                fph = fingerprint(lvl["state"])
                if fph in db_hashes or fph in in_run_hashes:
                    continue
                tmp = stats_now.copy()
                tmp[lvl["difficulty"]] = tmp.get(lvl["difficulty"],0) + 1
                delta = l1_distance(tmp) - dist_now
                if delta < best_delta:
                    best_delta, best_idx = delta, i
                    if delta < 0:
                        break

        if best_idx is None:
            pool.clear()
            continue

        lvl = pool.pop(best_idx)
        fph = fingerprint(lvl["state"])

        # вытаскиваем и нормализуем данные
        state = lvl["state"]
        solution = lvl.get("solution")
        if solution is not None:
            solution = [[int(src), int(dst)] for src, dst in solution]

        # Теперь INSERT с новым полем level_format
        cur.execute(
            """INSERT INTO "Levels"
               (level_data, level_format, difficulty, ai_steps, solution, "createdAt", "updatedAt")
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (
                json.dumps({"state": state}),
                model_name,                  # <-- сюда записываем формат
                lvl["difficulty"],
                lvl["ai_steps"],
                json.dumps(solution) if solution is not None else None,
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )
        conn.commit()
        inserted += 1
        db_hashes.add(fph)
        in_run_hashes.add(fph)
        tag = "[random]" if simple_mode else f"Δ={best_delta:+.4f}"
        print(f"#{inserted:>3}: {lvl['difficulty']:6} steps={lvl['ai_steps']:>3} {tag}")

    cur.close()
    conn.close()

    if inserted < add_count:
        print(f"⚠️  Only added {inserted}/{add_count} levels after {attempts} attempts.", file=sys.stderr)
        sys.exit(2)

    print(f"✅  Added {inserted} level(s) from model {model_name}.")

# ------------------------- CLI wrapper ------------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: add_ai_level.py <model_name> <count>")
        sys.exit(1)
    run_ingest(sys.argv[1], int(sys.argv[2]))
