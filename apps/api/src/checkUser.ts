// Quick script to check/create admin user
import 'reflect-metadata';
import { sequelize } from './config/database';
import { User } from './models/User';
import { env } from './config/env';

async function checkUser() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    const users = await User.findAll();
    console.log(`📊 Users in database: ${users.length}`);
    
    if (users.length === 0) {
      console.log('➕ No users found, creating admin...');
      if (!env.admin.username || !env.admin.password) {
        throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD before creating the initial admin.');
      }
      if (env.admin.password.length < 12) {
        throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
      }
      const admin = await User.create({
        username: env.admin.username,
        password: env.admin.password,
        role: 'admin',
      });
      console.log('');
      console.log('============================================================');
      console.log('🔐 ADMIN USER CREATED');
      console.log('============================================================');
      console.log(`Username: ${admin.username}`);
      console.log('Password and API key are not written to logs.');
      console.log('============================================================');
    } else {
      console.log('');
      console.log('============================================================');
      console.log('📋 EXISTING USERS:');
      console.log('============================================================');
      for (const user of users) {
        console.log(`Username: ${user.username}`);
        console.log('------------------------------------------------------------');
      }
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUser();
