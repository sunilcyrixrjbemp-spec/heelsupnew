const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    content = content.replace(/<button class="([^"]*)" id="search-btn"([^>]*)>([\s\S]*?)<\/button>/g, function(match, cls, rest, inner) {
        modified = true;
        return '<a href="/search.html" class="' + cls + '" id="search-btn"' + rest + '>' + inner + '</a>';
    });

    if (modified) {
        fs.writeFileSync(file, content);
        console.log('Fixed search-btn in: ' + file);
    }
}
console.log('Done');
