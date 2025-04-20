#!/usr/bin/env python3
import os
import argparse
import psycopg2
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

def delete_progress(user_id=None, level_id=None):
    where_clauses = []
    params = []

    if user_id is not None:
        where_clauses.append('userId = %s')
        params.append(user_id)
    if level_id is not None:
        where_clauses.append('levelId = %s')
        params.append(level_id)

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f'DELETE FROM "Progress"{where_sql};'

    cfg = get_db_config()
    with psycopg2.connect(**cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            deleted = cur.rowcount
        conn.commit()

    return deleted

def main():
    parser = argparse.ArgumentParser(description="Удалить записи из Progress")
    parser.add_argument("--user-id",  type=int, help="ID пользователя")
    parser.add_argument("--level-id", type=int, help="ID уровня")
    args = parser.parse_args()

    deleted = delete_progress(args.user_id, args.level_id)
    print(f"Удалено записей: {deleted}")

if __name__ == "__main__":
    main()


# # удалить ВСЕ записи
# python clear_progress.py
#
# # удалить прогресс конкретного пользователя
# python clear_progress.py --user-id 42
#
# # удалить прогресс конкретного уровня для всех пользователей
# python clear_progress.py --level-id 7
#
# # удалить прогресс уровня 3 пользователя 42
# python clear_progress.py --user-id 42 --level-id 3