const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Fix product links
    content = content.replace(/href="\/product\/\$\{slug\}"/g, 'href="/product.html?id="');
    content = content.replace(/href="\/product\/\$\{p\.slug\}"/g, 'href="/product.html?id="');
    
    // Fix regular links
    content = content.replace(/href="\/shop"/g, 'href="/shop.html"');
    content = content.replace(/href="\/shop\?cat=/g, 'href="/shop.html?cat=');
    content = content.replace(/href="\/cart"/g, 'href="/cart.html"');
    content = content.replace(/href="\/wishlist"/g, 'href="/wishlist.html"');
    content = content.replace(/href="\/account"/g, 'href="/profile.html"');
    content = content.replace(/href="\/profile"/g, 'href="/profile.html"');
    content = content.replace(/href="\/login"/g, 'href="/login.html"');
    content = content.replace(/href="\/about"/g, 'href="/about.html"');
    content = content.replace(/href="\/contact"/g, 'href="/contact.html"');
    content = content.replace(/href="\/blog"/g, 'href="/blog.html"');
    content = content.replace(/href="\/faq"/g, 'href="/faq.html"');
    content = content.replace(/href="\/size-guide"/g, 'href="/size-guide.html"');
    
    // Update login redirect logic in frontend
    content = content.replace(/accBtn\.href = '\/login'/g, "accBtn.href = '/login.html'");
    content = content.replace(/mobLoginBtn\.href = '\/profile'/g, "mobLoginBtn.href = '/profile.html'");
    
    fs.writeFileSync(file, content);
}
console.log('HTML links fixed');
