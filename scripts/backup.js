#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const backupsDir = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(dataDir)) {
  console.error('Répertoire data introuvable');
  process.exit(1);
}

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
const output = path.join(backupsDir, `backup-${timestamp}.zip`);

const result = spawnSync('zip', ['-r', '-q', output, 'data'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit'
});

if (result.status !== 0) {
  console.error('Échec de la création de l\'archive');
  process.exit(result.status ?? 1);
}

console.log(`Sauvegarde créée: ${output}`);
