const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // Fix search redirects
    content = content.replace(/window\.location\.href = '\/shop\?q='/g, function() {
        modified = true;
        return "window.location.href = '/search.html?q='";
    });
    content = content.replace(/window\.location\.href = '\/search\?q='/g, function() {
        modified = true;
        return "window.location.href = '/search.html?q='";
    });

    if (modified) {
        fs.writeFileSync(file, content);
        console.log('Fixed search redirect in: ' + file);
    }
}
console.log('Done fixing search redirects');
