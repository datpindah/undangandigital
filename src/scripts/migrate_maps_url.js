const { db } = require('../config/database');

console.log('Running migration: Add maps_url to invitations table...');

try {
  const tableInfo = db.pragma('table_info(invitations)');
  const hasMapsUrl = tableInfo.some(col => col.name === 'maps_url');

  if (!hasMapsUrl) {
    db.prepare('ALTER TABLE invitations ADD COLUMN maps_url TEXT').run();
    console.log('Added maps_url column');
  } else {
    console.log('maps_url column already exists');
  }

  console.log('Migration completed successfully.');
} catch (error) {
  console.error('Migration failed:', error);
}

