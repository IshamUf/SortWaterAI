// backend/index.mjs
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sequelize from './config/database.mjs';
import './models/User.mjs';
import './models/Level.mjs';
import './models/Progress.mjs';
import redisClient from './utils/redisClient.mjs';

import leaderboardRoutes from './routes/leaderboard.mjs';

import levelRoutes from './routes/levels.mjs';
import progressRoutes from './routes/progress.mjs';
import userRoutes from './routes/users.mjs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/levels', levelRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.send('SortWater backend is running.');
});

async function startServer() {
  try {
    await redisClient.connect();
    console.log('Redis connected');

    await sequelize.sync();
    console.log('Database synced');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

startServer();
