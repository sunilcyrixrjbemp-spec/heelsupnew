const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Replace <button class="nav-btn" id="search-btn" ...> with <a href="/search.html" class="nav-btn" ...>
    content = content.replace(/<button class="nav-btn" id="search-btn"([^>]*)>\s*<i class="fa-solid fa-magnifying-glass" aria-hidden="true"><\/i>\s*<\/button>/g, 
        '<a href="/search.html" class="nav-btn">\n            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>\n          </a>');

    fs.writeFileSync(file, content);
}
console.log('Search buttons replaced with links');
