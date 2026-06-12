const { db } = require('../config/database');

console.log('Running migration: Add couple photos to invitations table...');

try {
  // Check if columns exist
  const tableInfo = db.pragma('table_info(invitations)');
  const hasGroomImage = tableInfo.some(col => col.name === 'groom_image');
  const hasBrideImage = tableInfo.some(col => col.name === 'bride_image');

  if (!hasGroomImage) {
    db.prepare('ALTER TABLE invitations ADD COLUMN groom_image TEXT').run();
    console.log('Added groom_image column');
  } else {
    console.log('groom_image column already exists');
  }

  if (!hasBrideImage) {
    db.prepare('ALTER TABLE invitations ADD COLUMN bride_image TEXT').run();
    console.log('Added bride_image column');
  } else {
    console.log('bride_image column already exists');
  }

  console.log('Migration completed successfully.');
} catch (error) {
  console.error('Migration failed:', error);
}
