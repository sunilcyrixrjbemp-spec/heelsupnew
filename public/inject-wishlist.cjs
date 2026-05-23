const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('wishlist.js')) {
        content = content.replace('</body>', '  <script src=\"/js/wishlist.js\"></script>\n</body>');
        fs.writeFileSync(file, content);
    }
}
