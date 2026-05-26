const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname);
const files = fs.readdirSync(publicDir);

files.forEach(file => {
    if (file.endsWith('.html')) {
        const filePath = path.join(publicDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Replace returns admin link
        if (content.includes('admin-returns.html')) {
            content = content.replaceAll('admin-returns.html', 'admin-orders.html?tab=exchange');
            modified = true;
        }

        // Replace "Returns" sidebar text to "Exchanges" where it points to exchanges
        if (content.includes('> Returns</a>')) {
            content = content.replaceAll('> Returns</a>', '> Exchanges</a>');
            modified = true;
        }
        
        if (content.includes('>Returns</a>')) {
            content = content.replaceAll('>Returns</a>', '>Exchanges</a>');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${file}`);
        }
    }
});
