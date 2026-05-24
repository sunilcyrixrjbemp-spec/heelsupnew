const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');

const upgradeIndex = content.indexOf('const upgrades = [');
if (upgradeIndex !== -1) {
    const insertSchema = '"ALTER TABLE product_images ADD COLUMN r2_key TEXT",\n        "ALTER TABLE product_images ADD COLUMN is_primary INTEGER DEFAULT 0",\n        "ALTER TABLE product_images ADD COLUMN alt TEXT",\n        ';
    content = content.slice(0, upgradeIndex + 18) + '\n        ' + insertSchema + content.slice(upgradeIndex + 18);
}

fs.writeFileSync('index.js', content);
console.log('Backend updated with product_images schema upgrades');
