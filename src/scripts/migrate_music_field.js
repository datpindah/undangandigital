const { db } = require('../config/database');

try {
  console.log('Migrating database to add music_url column...');
  
  // Check if column exists
  const tableInfo = db.prepare("PRAGMA table_info(invitations)").all();
  const musicColumnExists = tableInfo.some(col => col.name === 'music_url');

  if (!musicColumnExists) {
    db.prepare("ALTER TABLE invitations ADD COLUMN music_url TEXT").run();
    console.log('Successfully added music_url column to invitations table.');
  } else {
    console.log('Column music_url already exists.');
  }

} catch (error) {
  console.error('Migration failed:', error);
}
