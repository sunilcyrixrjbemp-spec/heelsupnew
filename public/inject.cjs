const fs = require('fs');
const cheerio = require('cheerio');

// Load index.html
const indexHtml = fs.readFileSync('index.html', 'utf8');
const indexDoc = cheerio.load(indexHtml);

const components = {
    topbar: indexDoc.html(indexDoc('#topbar')),
    navbar: indexDoc.html(indexDoc('#navbar')),
    mobMenu: indexDoc.html(indexDoc('#mob-menu')),
    searchOverlay: indexDoc.html(indexDoc('#search-overlay')),
    footer: indexDoc.html(indexDoc('footer.footer'))
};

const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && !f.startsWith('admin') && f !== 'index.html');

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const doc = cheerio.load(content, { decodeEntities: false });

    if (doc('#topbar').length) doc('#topbar').replaceWith(components.topbar);
    if (doc('#navbar').length) doc('#navbar').replaceWith(components.navbar);
    
    if (doc('#mobile-menu').length) doc('#mobile-menu').replaceWith(components.mobMenu);
    else if (doc('#mob-menu').length) doc('#mob-menu').replaceWith(components.mobMenu);

    if (doc('#search-overlay').length) doc('#search-overlay').replaceWith(components.searchOverlay);
    
    if (doc('footer.footer').length) doc('footer.footer').replaceWith(components.footer);

    fs.writeFileSync(file, doc.html());
    console.log('Injected components into ' + file);
}
