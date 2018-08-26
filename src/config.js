const fs = require('fs');

const configPath = './config.json';
const parsed = JSON.parse(fs.readFileSync(configPath, 'UTF-8'));

// We have to export each object in order to access them separately
exports.togglApiToken = parsed.togglApiToken;
