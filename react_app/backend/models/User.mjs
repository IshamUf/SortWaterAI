// backend/models/User.mjs
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.mjs';

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    unique: true
  },
  telegram_id: DataTypes.STRING,
  coins: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_daily_reward: DataTypes.DATE,
  score: {
    type: DataTypes.JSONB,              // JSONB для Postgres
    allowNull: false,
    defaultValue: {                     // начальное значение
      "🏆": 0,
      "🎖️": 0,
      "🥉": 0
    }
  },
}, {
  tableName: 'Users',
});

export default User;
