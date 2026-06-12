const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATA_DIR 
  ? path.join(process.env.DATA_DIR, 'database.db')
  : path.resolve(__dirname, '../../database.db');

const db = new Database(dbPath, { verbose: console.log });

const initDb = () => {
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(path.resolve(__dirname, '../models/schema.sql'), 'utf8');
  db.exec(schema);
  console.log('Database initialized successfully');
};

module.exports = { db, initDb };
