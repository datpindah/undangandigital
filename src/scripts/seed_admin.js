const bcrypt = require('bcrypt');
const { db } = require('../config/database');

const seedAdmin = async () => {
  try {
    // Check if any user exists
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    
    if (userCount.count === 0) {
      console.log('No users found. Creating default admin user...');
      
      const defaultName = 'Admin';
      const defaultEmail = 'admin@example.com';
      const defaultPassword = 'Admin123!'; // Default password matches user preference
      
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
      const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
      stmt.run(defaultName, defaultEmail, hashedPassword);
      
      console.log('Default admin user created successfully.');
      console.log('Email: ' + defaultEmail);
      console.log('Password: ' + defaultPassword);
      console.log('PLEASE CHANGE THIS PASSWORD IMMEDIATELY AFTER LOGGING IN.');
    } else {
      console.log('Admin user already exists. Skipping seed.');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
};

module.exports = seedAdmin;
