const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<style>([\s\S]*?)<\/style>/);
if (match) {
    fs.writeFileSync('main.css', match[1]);
    const newHtml = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel=\"stylesheet\" href=\"main.css\" />');
    fs.writeFileSync('index.html', newHtml);
    console.log('Extracted main.css from index.html');
}

const shopHtml = fs.readFileSync('shop.html', 'utf8');
const shopNewHtml = shopHtml.replace(/<style>[\s\S]*?<\/style>/, '<link rel=\"stylesheet\" href=\"main.css\" />');
fs.writeFileSync('shop.html', shopNewHtml);
console.log('Updated shop.html to use main.css');
