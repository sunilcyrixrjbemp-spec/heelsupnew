const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('admin'));

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Fix cart methods
    content = content.replace(/HeelsUpCart\.getItems\(\)/g, 'HeelsUpCart.getCart()');
    content = content.replace(/HeelsUpCart\.getTotal\(\)/g, 'HeelsUpCart.getSubtotal()');

    // Fix toggleWish function to sync with backend
    const toggleRegex = /window\.toggleWish\s*=\s*function\s*\([^)]*\)\s*\{([\s\S]*?toast\([^)]*\);[\s\S]*?)\};/g;
    content = content.replace(toggleRegex, function(match, body) {
        return `window.toggleWish = function (id, btn) {
            btn.classList.toggle('wishlisted');
            const isWish = btn.classList.contains('wishlisted');
            if (isWish) {
                btn.innerHTML = '<i class="fa-solid fa-heart" aria-hidden="true"></i>';
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.innerHTML = '<i class="fa-regular fa-heart" aria-hidden="true"></i>';
                btn.setAttribute('aria-pressed', 'false');
            }
            if (typeof HeelsUpWishlistSystem !== 'undefined') {
                if (isWish) HeelsUpWishlistSystem.add(id);
                else HeelsUpWishlistSystem.remove(id);
                // System shows toast on its own? Actually no, add() doesn't show toast, toggle does.
                // We'll show toast manually here.
                toast(isWish ? 'Added to Wishlist' : 'Removed from Wishlist', isWish ? 'success' : 'info');
            } else {
                toast(isWish ? 'Added to Wishlist' : 'Removed from Wishlist', isWish ? 'success' : 'info');
            }
        };`;
    });

    fs.writeFileSync(file, content);
    console.log('Fixed cart/wishlist in: ' + file);
}
