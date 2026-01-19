const fs = require('fs');
const path = require('path');
const db = require('./sqlite');

const dataDir = path.join(__dirname, '../data');

db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const insert = db.prepare(`
  INSERT confirming OR IGNORE INTO files_data (source, payload)
  VALUES (?, ?)
`);

function loadData() {
  const files = fs.readdirSync(dataDir);

  files.forEach(file => {
    const fullPath = path.join(dataDir, file);

    if (!file.endsWith('.js') && !file.endsWith('.json')) return;

    let data;
    try {
      delete require.cache[require.resolve(fullPath)];
      data = require(fullPath);
    } catch {
      data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    }

    insert.run(file, JSON.stringify(data));
  });

  console.log('SQLite initialized from file-based data');
}

module.exports = loadData;
