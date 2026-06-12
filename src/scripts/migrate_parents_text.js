const { db } = require('../config/database');

console.log('Running migration: Add parents text fields to invitations table...');

try {
  const tableInfo = db.pragma('table_info(invitations)');
  const hasGroomParents = tableInfo.some(col => col.name === 'groom_parents_text');
  const hasBrideParents = tableInfo.some(col => col.name === 'bride_parents_text');

  if (!hasGroomParents) {
    db.prepare('ALTER TABLE invitations ADD COLUMN groom_parents_text TEXT').run();
    console.log('Added groom_parents_text column');
  }

  if (!hasBrideParents) {
    db.prepare('ALTER TABLE invitations ADD COLUMN bride_parents_text TEXT').run();
    console.log('Added bride_parents_text column');
  }

  console.log('Migration completed successfully.');
} catch (error) {
  console.error('Migration failed:', error);
}

