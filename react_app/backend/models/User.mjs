// models/User.mjs
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.mjs';

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, unique: true },
  // Ранее использовалось поле password, теперь переименовано в telegram_id
  telegram_id: DataTypes.STRING,
  coins: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_daily_reward: DataTypes.DATE,
}, {
  tableName: 'Users'
});

export default User;