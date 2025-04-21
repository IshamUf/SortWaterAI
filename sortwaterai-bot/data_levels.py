#!/usr/bin/env python3
import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

def get_db_config():
    return {
        "dbname":   os.getenv("POSTGRES_DB"),
        "user":     os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "host":     "localhost",
        "port":     int(os.getenv("POSTGRES_PORT", 5432)),
    }

def main():
    db_config = get_db_config()
    try:
        conn = psycopg2.connect(**db_config)
        # RealDictCursor отдаёт каждую строку как dict, включая JSONB в виде Python-объектов
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            'SELECT id, level_data, difficulty, ai_steps, solution, "createdAt", "updatedAt" '
            'FROM "Levels" ORDER BY id'
        )
        rows = cur.fetchall()

        if not rows:
            print("Таблица Levels пуста.")
            return

        for row in rows:
            lvl_id      = row["id"]
            # level_data — это TEXT, внутри JSON-строка {"state": [...]}
            try:
                data = json.loads(row["level_data"])
                state = data.get("state")
            except Exception:
                state = row["level_data"]
            diff        = row["difficulty"]
            steps       = row["ai_steps"]
            solution    = row["solution"]  # JSONB → уже в виде списка списков или None
            created_at  = row["createdAt"]
            updated_at  = row["updatedAt"]

            print(f"— Level ID: {lvl_id} —")
            print(f"  state:    {state}")
            print(f"  difficulty: {diff!r}")
            print(f"  ai_steps:   {steps}")
            print(f"  solution:   {solution}")
            print(f"  createdAt:  {created_at}")
            print(f"  updatedAt:  {updated_at}")
            print()

        cur.close()
        conn.close()

    except Exception as e:
        print("Ошибка при подключении/чтении таблицы Levels:", e)

if __name__ == "__main__":
    main()
