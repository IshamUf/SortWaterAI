import logging
import os
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

@dp.message_handler(commands=["start"])
async def cmd_start(message: types.Message):
    text = (
        "Добро пожаловать в SortWaterAi Bot!\n\n"
        "Чтобы запустить веб-приложение, нажмите кнопку PLAY, "
        "которая уже добавлена через @BotFather."
    )
    await message.reply(text)

@dp.message_handler(commands=["help"])
async def cmd_help(message: types.Message):
    await message.reply("Нажмите кнопку PLAY, которая уже добавлена через @BotFather, чтобы открыть веб-приложение.")

if __name__ == '__main__':
    executor.start_polling(dp, skip_updates=True)
