const fs = require('node:fs');
const path = require('node:path');

const resultsDirectory = path.resolve(__dirname, '../test-results');
function artifactPath(name) {
  fs.mkdirSync(resultsDirectory, { recursive: true });
  return path.join(resultsDirectory, name);
}

module.exports = { artifactPath, resultsDirectory };
