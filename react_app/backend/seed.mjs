import sequelize from './config/database.mjs';
import User from './models/User.mjs';
import Level from './models/Level.mjs';
import Progress from './models/Progress.mjs';

// Функция заполнения
async function seedDatabase() {
  await sequelize.sync({ force: true }); // пересоздание базы с нуля

  const users = await User.bulkCreate([
    { username: 'arslan', password: '123456', coins: 300 },
    { username: 'chatgpt', password: 'gpt123', coins: 500 },
  ]);

  const levels = await Level.bulkCreate([
    {
      difficulty: 1,
      level_data: JSON.stringify({
        tubes: 4,
        state: [[1, 1, 1, 1], [2, 2, 2, 2], [-1, 3, 3, 3], [-1, -1, -1, 3]]
      }),
    },
    {
      difficulty: 2,
      level_data: JSON.stringify({
        tubes: 5,
        state: [[-1, 1, 2, 1], [-1, 2, 1, 2], [-1, -1, 3, 3], [-1, -1, -1, -1], [-1, -1, -1, -1]]
      }),
    },
    {
      difficulty: 2,
      level_data: JSON.stringify({
        tubes: 6,
        state: [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], [-1, -1, 3, 3], [-1, -1, -1, -1], [-1, -1, -1, -1]]
      }),
    },
    {
      difficulty: 3,
      level_data: JSON.stringify({
        tubes: 5,
        state: [[1, 2, 1, 3], [-1, 2, 3, 1], [-1, -1, 3, 2], [-1, -1, -1, -1], [-1, -1, -1, -1]]
      }),
    },
    {
      difficulty: 4,
      level_data: JSON.stringify({
        tubes: 6,
        state: [[3, 2, 1, 0], [3, 2, 1, 0], [3, 2, 1, 0], [3, 2, 1, 0], [-1, -1, -1, -1], [-1, -1, -1, -1]]
      }),
    },
    {
      difficulty: 5,
      level_data: JSON.stringify({
        tubes: 4,
        state: [[1, 3, 2, 1], [2, 3, 1, 2], [3, 2, 1, 3], [-1, -1, -1, -1]]
      }),
    }
  ]);

  await Progress.create({
    userId: users[0].id,
    levelId: levels[0].id,
    state: JSON.stringify([[-1, -1, -1, 1], [-1, 2, 2, 2], [-1, 3, 3, 3], [-1, 1, 1, -1]]),
    status: 'in_progress',
  });

  console.log('Database seeded successfully!');
}

seedDatabase().catch((err) => console.error(err));