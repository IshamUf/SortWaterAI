#!/usr/bin/env python3
# add_inposible_level.py

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
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
    # Новый state, который нужно записать
    new_state = [
        [1, 0, 0, 1],
        [2, 1, 2, 0],
        [1, 2, 0, 2],
        [-1, -1, -1, -1],
        [-1, -1, -1,  1],
    ]
    # Оборачиваем в объект { "state": ... }
    level_data_json = json.dumps({"state": new_state})

    try:
        conn = psycopg2.connect(**db_config)
        cur  = conn.cursor(cursor_factory=RealDictCursor)

        # Проверим, что уровень с id=2 существует
        cur.execute('SELECT id, level_data FROM "Levels" WHERE id = %s', (2,))
        row = cur.fetchone()
        if not row:
            print("Уровень с id=2 не найден.")
            return

        # Выполняем UPDATE
        cur.execute(
            'UPDATE "Levels" '
            'SET level_data = %s, "updatedAt" = %s '
            'WHERE id = %s',
            (level_data_json, datetime.utcnow(), 2)
        )
        conn.commit()
        print("✅ Уровень id=2 успешно обновлён. Новое состояние:")
        print(json.dumps(new_state, ensure_ascii=False))

    except Exception as e:
        print("🚫 Ошибка при обновлении уровня:", e)
    finally:
        try:
            cur.close()
            conn.close()
        except:
            pass

if __name__ == "__main__":
    main()
