import logging
import os
import psycopg2
from aiogram import Bot, Dispatcher, executor, types
from dotenv import load_dotenv

# Загружаем переменные окружения из .env
load_dotenv()

logging.basicConfig(level=logging.INFO)

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise Exception("TELEGRAM_BOT_TOKEN не задан в .env файле.")

bot = Bot(token=TOKEN)
dp = Dispatcher(bot)

def get_db_config():
    return {
        "dbname": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", 5432))
    }

@dp.message_handler(commands=["start"])
async def cmd_start(message: types.Message):
    text = (
        "Добро пожаловать в SortWaterAi Bot!\n\n"
        "Чтобы запустить веб-приложение, нажмите кнопку PLAY, "
        "Вы можете удалить свой аккаунт и прогреасс командой /delete."
    )
    await message.reply(text)

@dp.message_handler(commands=["help"])
async def cmd_help(message: types.Message):
    await message.reply("Тут планируется функционал для общения с поддержкой, то есть со мной.")

@dp.message_handler(commands=["delete"])
async def cmd_delete(message: types.Message):
    """
    Удаляет пользователя и его прогресс, используя message.from_user.id.
    """
    telegram_id = str(message.from_user.id)

    db_config = get_db_config()
    conn = None

    try:
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()

        # 1. Находим пользователя по telegram_id
        cursor.execute(
            'SELECT id FROM "Users" WHERE telegram_id = %s',
            (telegram_id,)
        )
        user_row = cursor.fetchone()

        if not user_row:
            await message.reply(f"Пользователь с telegram_id={telegram_id} не найден.")
            return

        user_id = user_row[0]

        # 2. Удаляем записи из Progress
        cursor.execute(
            'DELETE FROM "Progress" WHERE "userId" = %s',
            (user_id,)
        )

        # 3. Удаляем пользователя из Users
        cursor.execute(
            'DELETE FROM "Users" WHERE id = %s',
            (user_id,)
        )

        conn.commit()
        await message.reply(f"Пользователь с telegram_id={telegram_id} и его прогресс успешно удалены.")

    except Exception as e:
        if conn:
            conn.rollback()
        logging.error(f"Ошибка при удалении пользователя: {e}")
        await message.reply("Произошла ошибка при удалении пользователя.")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    executor.start_polling(dp, skip_updates=True)
