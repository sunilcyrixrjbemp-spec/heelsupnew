const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    let modified = false;
    // Replace <button class="nav-btn" id="search-btn" ...> ... </button> with <a href="/search.html" class="nav-btn"> ... </a>
    content = content.replace(/<button class="nav-btn" id="search-btn"[^>]*>([\s\S]*?)<\/button>/g, function(match, p1) {
        modified = true;
        return '<a href="/search.html" class="nav-btn" aria-label="Search products">' + p1 + '</a>';
    });

    if (modified) {
        fs.writeFileSync(file, content);
        console.log('Fixed search-btn in: ' + file);
    }
}
console.log('Search buttons SVG replaced with links');
