const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Fix template product links
    // <a href="/product.html?id=" class="search-res-item" ... -> id=
    content = content.replace(/href="\/product\.html\?id="/g, 'href="/product.html?id=\"');
    
    // 2. Fix the fact that in some scopes, we use id instead of p.id. 
    // Wait, let's just make it \ because p is almost always the loop variable.
    // Wait, in shop.html: onclick="toggleWish(\,this)". The variable is id, but p.id also works because p is in scope!

    // Let's replace href="/shop.html?cat=" back to template literals or hardcoded string where needed
    content = content.replace(/<a href="\/shop\.html\?cat="([^>]*)>([\s\S]*?)<\/a>/g, function(match, attrs, text) {
        if (text.includes('') || text.includes('') || text.trim() === '') {
            return '<a href="/shop.html?cat=\"' + attrs + '>' + text + '</a>';
        } else {
            let catValue = '';
            let lower = text.toLowerCase();
            if (lower.includes('heel')) catValue = 'heels';
            else if (lower.includes('flat')) catValue = 'flats';
            else if (lower.includes('sandal')) catValue = 'sandals';
            else if (lower.includes('bag')) catValue = 'bags';
            else if (lower.includes('summer')) catValue = 'summer';
            else if (lower.includes('wedding')) catValue = 'wedding';
            else if (lower.includes('trending')) catValue = 'trending';
            else catValue = 'all';
            return '<a href="/shop.html?cat=' + catValue + '"' + attrs + '>' + text + '</a>';
        }
    });

    fs.writeFileSync(file, content);
    console.log('Fixed links in: ' + file);
}
