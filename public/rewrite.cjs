const fs = require('fs');
const path = require('path');

const cssVarMap = {
    'var(--bg-page)': 'var(--cream)',
    'var(--color-light)': 'var(--cream2)',
    'var(--color-primary)': 'var(--gold)',
    'var(--color-primary-dark)': 'var(--gold-dk)',
    'var(--color-accent)': 'var(--rose)',
    'var(--color-success)': 'var(--teal)',
    'var(--color-success-light)': 'rgba(34, 197, 94, 0.1)',
    'var(--border-color)': 'var(--border)',
    'var(--text-primary)': 'var(--text-1)',
    'var(--text-secondary)': 'var(--text-2)',
    'var(--text-muted)': 'var(--text-3)',
    'var(--font-heading)': 'var(--fh)',
    'var(--font-display)': 'var(--fd)',
    'var(--font-body)': 'var(--fb)',
    'btn-primary': 'btn', // since index uses just .btn
    'class=\"container\"': 'class=\"ctn\"',
    'class=\"container ': 'class=\"ctn '
};

const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && !f.startsWith('admin') && f !== 'index.html' && f !== 'shop.html');

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace style.css with main.css
    content = content.replace(/<link rel="stylesheet" href="style\.css"\s*\/?>/g, '<link rel="stylesheet" href="main.css" />');
    
    // Apply variable mappings
    for (const [oldVar, newVar] of Object.entries(cssVarMap)) {
        content = content.split(oldVar).join(newVar);
    }
    
    fs.writeFileSync(file, content);
    console.log('Processed ' + file);
}
