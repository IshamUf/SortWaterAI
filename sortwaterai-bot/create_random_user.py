import os
import random
import string
import json
from datetime import datetime
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_db_config():
    """Загружаем параметры подключения к БД из .env."""
    return {
        "dbname": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", 5432))
    }

def generate_random_username(length=8):
    """Создает имя пользователя вида User_xxxx, где xxxx - случайные буквы/цифры."""
    chars = string.ascii_lowercase + string.digits
    return "User_" + "".join(random.choice(chars) for _ in range(length))

def generate_random_telegram_id():
    """Формирует случайное число в заданном диапазоне для имитации telegram_id."""
    return str(random.randint(10_000_000, 99_999_999))

def create_test_users_and_progress(num_users=20):
    db_config = get_db_config()
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()

    created_user_ids = []
    now = datetime.utcnow()

    # 1) Создаем N пользователей
    for _ in range(num_users):
        username = generate_random_username()
        telegram_id = generate_random_telegram_id()
        coins = 0
        last_daily_reward = None

        cursor.execute(
            """
            INSERT INTO "Users" 
            ("username", "telegram_id", "coins", "last_daily_reward", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING "id"
            """,
            (username, telegram_id, coins, last_daily_reward, now, now)
        )
        new_user_id = cursor.fetchone()[0]
        created_user_ids.append(new_user_id)

    # 2) Для каждого пользователя создаём запись в таблице Progress со статусом "completed" для levelId=1
    example_state = {"state": [[0, 0, 0, 0], [-1, -1, -1, -1]]}  # Просто пример состояния
    for user_id in created_user_ids:
        cursor.execute(
            """
            INSERT INTO "Progress"
            ("userId", "levelId", "status", "state", "createdAt", "updatedAt")
            VALUES (%s, 1, 'completed', %s, %s, %s)
            """,
            (
                user_id,
                json.dumps(example_state),
                now,
                now
            )
        )

    conn.commit()
    cursor.close()
    conn.close()

    print(f"✅ Создано {num_users} пользователей, у каждого progress по levelId=1 со статусом 'completed'.")

if __name__ == "__main__":
    create_test_users_and_progress(num_users=20)

