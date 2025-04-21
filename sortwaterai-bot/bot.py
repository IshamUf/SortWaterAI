# sortwaterai-bot/bot.py
from pathlib import Path
import logging, os, subprocess, asyncio, psycopg2, json
from aiogram import Bot, Dispatcher, executor, types
from dotenv import load_dotenv

# ------------------------------------------------------------------ config --
AI_MODELS_DIR = Path(__file__).resolve().parents[1] / "ai_functions" / "ai_models"
load_dotenv()
TOKEN        = os.getenv("TELEGRAM_BOT_TOKEN")
ADMIN_ID     = os.getenv("ADMIN_ID")                    # единственный админ
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))  # ../

if not TOKEN:
    raise RuntimeError("TELEGRAM_BOT_TOKEN не задан в .env")

if not ADMIN_ID:
    raise RuntimeError("ADMIN_ID не задан в .env")

logging.basicConfig(level=logging.INFO)

bot = Bot(token=TOKEN)
dp  = Dispatcher(bot)

# ------------------------------------------------------- helpers / database --
def get_db_config():
    return {
        "dbname":   os.getenv("POSTGRES_DB"),
        "user":     os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "host":     os.getenv("POSTGRES_HOST", "localhost"),
        "port":     int(os.getenv("POSTGRES_PORT", 5432)),
    }

# -------------------------------------------------------------- /start help --
@dp.message_handler(commands=["start"])
async def cmd_start(msg: types.Message):
    await msg.reply(
        "Добро пожаловать! Нажмите PLAY внутри Web‑App.\n"
        "Команда /delete – удалить свой аккаунт.\n"
        "Админ‑команда /add_levels <model> <n> – добавить уровни."
    )

@dp.message_handler(commands=["help"])
async def cmd_help(msg: types.Message):
    await msg.reply("Служба поддержки: напишите @YourSupport.")

# ---------------------------------------------------------- /add_levels ----
@dp.message_handler(commands=["add_levels"])
async def cmd_add_levels(msg: types.Message):
    if msg.from_user.id != ADMIN_ID:
        return await msg.reply(f"⛔ Команда доступна только администратору. {msg.from_user.id} {ADMIN_ID}")

    parts = msg.get_args().split()
    if len(parts) != 2:
        models = [p.stem for p in AI_MODELS_DIR.glob("*.pt")]
        pretty = ", ".join(models) or "—папка пуста—"
        return await msg.reply(
            "Формат: /add_levels <model_name> <count>\n"
            f"Доступные модели: {pretty}"
        )

    model_name, count_str = parts
    if not count_str.isdigit():
        return await msg.reply("Вторым аргументом должно быть число уровней.")

    await msg.reply(f"⏳ Запускаю генерацию {count_str} уровней с моделью {model_name}…")

    # путь до скрипта
    script_path = os.path.join(PROJECT_ROOT, "ai_functions", "add_ai_level.py")

    # запускаем как подпроцесс, наследуем env (.env уже в процессе)
    proc = await asyncio.create_subprocess_exec(
        "python", script_path, model_name, count_str,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        cwd=PROJECT_ROOT,
    )
    out, err = await proc.communicate()

    if proc.returncode == 0:
        await msg.reply(f"✅ Уровни добавлены.\n```\n{out.decode() or 'OK'}\n```",
                        parse_mode="Markdown")
    else:
        await msg.reply(f"🚫 Скрипт завершился с ошибкой {proc.returncode}:\n"
                        f"```\n{err.decode() or out.decode()}\n```",
                        parse_mode="Markdown")

# ------------------------------------------------------------- /delete -----
@dp.message_handler(commands=["delete"])
async def cmd_delete(msg: types.Message):
    tel_id = str(msg.from_user.id)
    db_cfg = get_db_config()

    try:
        with psycopg2.connect(**db_cfg) as conn, conn.cursor() as cur:
            cur.execute('SELECT id FROM "Users" WHERE telegram_id=%s', (tel_id,))
            row = cur.fetchone()
            if not row:
                return await msg.reply("Аккаунт не найден.")

            user_id = row[0]
            cur.execute('DELETE FROM "Progress" WHERE "userId"=%s', (user_id,))
            cur.execute('DELETE FROM "Users"    WHERE id=%s',      (user_id,))
            await msg.reply("Ваши данные удалены.")
    except Exception as e:
        logging.exception("delete error")
        await msg.reply("Произошла ошибка, попробуйте позже.")

# ------------------------------------------------------------------- main --
if __name__ == "__main__":
    executor.start_polling(dp, skip_updates=True)
