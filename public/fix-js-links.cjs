const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Fix JS redirects
    content = content.replace(/'\/login\?redirect/g, "'/login.html?redirect");
    content = content.replace(/'\/login'/g, "'/login.html'");
    content = content.replace(/window\.location\.href = '\/login'/g, "window.location.href = '/login.html'");
    content = content.replace(/window\.location\.href = '\/'/g, "window.location.href = '/index.html'");
    
    fs.writeFileSync(file, content);
}
console.log('JS links fixed');
