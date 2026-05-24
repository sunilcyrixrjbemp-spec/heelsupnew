const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Fix /shop/category links
    content = content.replace(/href="\/shop\/([a-zA-Z0-9-]+)"/g, 'href="/shop.html?cat="');
    
    // Fix policies
    content = content.replace(/href="\/policy\/shipping"/g, 'href="/shipping-info.html"');
    content = content.replace(/href="\/policy\/exchange"/g, 'href="/returns.html"');
    content = content.replace(/href="\/policy\/privacy"/g, 'href="/privacy.html"');
    content = content.replace(/href="\/policy\/terms"/g, 'href="/terms.html"');
    
    // Track order
    content = content.replace(/href="\/track"/g, 'href="/order-tracking.html"');
    
    fs.writeFileSync(file, content);
}
console.log('HTML links fixed 2');
