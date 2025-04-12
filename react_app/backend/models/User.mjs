// models/User.mjs
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.mjs';

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, unique: true },
  password: DataTypes.STRING,
  coins: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_daily_reward: DataTypes.DATE,
});

export default User;
