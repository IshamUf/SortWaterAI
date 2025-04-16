import psycopg2
import json
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

def get_db_config():
    return {
        "dbname": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "host": "localhost",
        "port": int(os.getenv("POSTGRES_PORT", 5432))
    }

def insert_levels(data, db_config):
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()

    for entry, difficulty in data:
        level_data = {
            "state": entry["state"]
        }
        created_at = datetime.utcnow()
        cursor.execute(
            """
            INSERT INTO "Levels" (level_data, difficulty, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s)
            """,
            (json.dumps(level_data), difficulty, created_at, created_at)
        )

    conn.commit()
    cursor.close()
    conn.close()


def reorder_level_ids_by_difficulty(db_config):
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()

    # Получаем уровни отсортированные по difficulty и времени
    cursor.execute("""
        SELECT id FROM "Levels"
        ORDER BY difficulty ASC, "createdAt" ASC
    """)
    rows = cursor.fetchall()

    # Временное смещение всех id, чтобы избежать конфликтов
    for i, (old_id,) in enumerate(rows):
        temp_id = i + 1000
        cursor.execute('UPDATE "Levels" SET id = %s WHERE id = %s', (temp_id, old_id))

    # Назначение новых id начиная с 1
    for i, (old_id,) in enumerate(rows):
        new_id = i + 1
        temp_id = i + 1000
        cursor.execute('UPDATE "Levels" SET id = %s WHERE id = %s', (new_id, temp_id))

    conn.commit()
    cursor.close()
    conn.close()


def clear_progress_table(db_config):
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()

    cursor.execute('DELETE FROM "Progress"')
    conn.commit()

    cursor.close()
    conn.close()


# === Пример использования ===
example_data = [
     [{"state": [[4, 5, 4, 5], [5, 4, 5, 4], [6, 6, 6, 6], [-1, -1, -1, -1], [-1, -1, -1, -1]]}, 3],
     [{"state": [[0, 1, 2, 3], [3, 0, 2, 1], [1, 2, 3, 0], [0, 1, 2, 3], [-1, -1, -1, -1], [-1, -1, -1, -1]]}, 4],
     [{"state": [[4, 5, 6, 7], [7, 6, 5, 4], [4, 5, 6, 7], [7, 6, 5, 4], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]}, 5],
     [{"state": [[0, 0, 1, 1], [2, 2, 3, 3], [4, 4, 5, 5], [3, 3, 2, 2], [-1, -1, 0, 0], [-1, -1, 1, 1], [4, 5, 4, 5]]}, 6],
     # [{"state": [[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [-1, -1, 2, 2, 2], [-1, -1, -1, 2, 2]]}, 1],
     # [{"state": [[3, 2, 3, 2, 3], [2, 3, 2, 3, 2], [4, 4, 4, 5, 5], [5, 5, 5, 4, 4], [-1, -1, -1, -1, -1]]}, 2],
 ]


db_config = get_db_config()

insert_levels(example_data, db_config)
reorder_level_ids_by_difficulty(db_config)
clear_progress_table(db_config)
print("✅ Уровни добавлены, пересортированы, прогресс обнулён.")
