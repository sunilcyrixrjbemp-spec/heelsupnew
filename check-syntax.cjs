const fs = require('fs');
const html = fs.readFileSync('public/checkout.html', 'utf8');
const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let match;
let hasError = false;
while ((match = scriptRegex.exec(html)) !== null) {
    try {
        new Function(match[1]);
    } catch (e) {
        console.error("Syntax error:", e.message);
        hasError = true;
    }
}
if (!hasError) console.log("No syntax errors found");
