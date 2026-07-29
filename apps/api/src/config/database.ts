// IMPORTANT: reflect-metadata must be imported before any decorator usage
import 'reflect-metadata';

import { Sequelize } from 'sequelize-typescript';
import { env } from './env';

// Import models explicitly
import { User } from '../models/User';
import { Session } from '../models/Session';
import { AuthKey } from '../models/AuthKey';
import { ScheduledMessage } from '../models/ScheduledMessage';

// Create Sequelize instance with PostgreSQL
export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  username: env.db.user,
  password: env.db.password,
  dialectOptions: env.db.ssl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: env.db.sslRejectUnauthorized,
        },
      }
    : undefined,

  // Register models explicitly
  models: [User, Session, AuthKey, ScheduledMessage],

  // Logging configuration
  logging: env.isDev ? console.log : false,

  // Connection pool settings for production
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },

  // Additional options
  define: {
    timestamps: true,
    underscored: true, // Use snake_case for column names
    freezeTableName: true,
  },
});

/**
 * Initialize database connection and sync models
 */
export async function initDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }

  try {
    // Create missing tables and indexes without altering existing columns.
    // Use migrations for intentional schema changes.
    await sequelize.sync({ alter: false });
    console.log('✅ Database models synchronized.');
  } catch (error) {
    console.error('❌ Unable to synchronize database models:', error);
    throw error;
  }
}

/**
 * Close database connection gracefully
 */
export async function closeDatabase(): Promise<void> {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
}

export default sequelize;
