const { db } = require('../config/database');

console.log('Running migration: Add gift fields to invitations table...');

try {
  const tableInfo = db.pragma('table_info(invitations)');
  const hasBank = tableInfo.some(col => col.name === 'gift_bank');
  const hasAccName = tableInfo.some(col => col.name === 'gift_account_name');
  const hasAccNumber = tableInfo.some(col => col.name === 'gift_account_number');

  if (!hasBank) {
    db.prepare('ALTER TABLE invitations ADD COLUMN gift_bank TEXT').run();
    console.log('Added gift_bank column');
  }

  if (!hasAccName) {
    db.prepare('ALTER TABLE invitations ADD COLUMN gift_account_name TEXT').run();
    console.log('Added gift_account_name column');
  }

  if (!hasAccNumber) {
    db.prepare('ALTER TABLE invitations ADD COLUMN gift_account_number TEXT').run();
    console.log('Added gift_account_number column');
  }

  console.log('Migration completed successfully.');
} catch (error) {
  console.error('Migration failed:', error);
}

