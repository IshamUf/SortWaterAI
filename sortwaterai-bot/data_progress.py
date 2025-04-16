import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_db_config():
    return {
        "dbname": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "host": "localhost",
        "port": int(os.getenv("POSTGRES_PORT", 5432))
    }

def main():
    db_config = get_db_config()

    try:
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM "Progress"')
        rows = cursor.fetchall()

        if not rows:
            print("Таблица Progress пуста.")
        else:
            for row in rows:
                print(row)

        cursor.close()
        conn.close()

    except Exception as e:
        print("Ошибка при подключении/чтении таблицы Progress:", e)

if __name__ == "__main__":
    main()
