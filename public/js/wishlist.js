class HeelsUpWishlist {
    constructor() {
        this.items = [];
        this.initialized = false;
        this.loadLocal();
    }

    loadLocal() {
        try {
            this.items = JSON.parse(localStorage.getItem('heelsup_wishlist') || '[]');
        } catch (e) {
            this.items = [];
        }
    }

    saveLocal() {
        localStorage.setItem('heelsup_wishlist', JSON.stringify(this.items));
    }

    async init() {
        if (this.initialized) return;
        
        // If user is logged in, sync from server
        if (typeof HeelsUpAuth !== 'undefined' && HeelsUpAuth.user) {
            try {
                const data = await HeelsUpAuth.api('/api/me/wishlist');
                const serverItems = (data.wishlist || []).map(item => item.product_id || item.id);
                
                // Merge local and server items
                const merged = [...new Set([...this.items, ...serverItems])];
                this.items = merged;
                this.saveLocal();
                
                // Sync any local-only items to server
                for (const id of this.items) {
                    if (!serverItems.includes(id)) {
                        await HeelsUpAuth.api('/api/me/wishlist', 'POST', { productId: id });
                    }
                }
            } catch (e) {
                console.error("Wishlist sync failed", e);
            }
        }
        
        this.updateUI();
        this.initialized = true;
    }

    async toggle(productId, btnElement) {
        if (this.items.includes(productId)) {
            await this.remove(productId);
            if (btnElement) btnElement.classList.remove('active');
            if (typeof toast !== 'undefined') toast('Removed from wishlist');
        } else {
            await this.add(productId);
            if (btnElement) btnElement.classList.add('active');
            if (typeof toast !== 'undefined') toast('Added to wishlist ❤️', 's');
        }
    }

    async add(productId) {
        if (!this.items.includes(productId)) {
            this.items.push(productId);
            this.saveLocal();
            this.updateUI();
            
            if (typeof HeelsUpAuth !== 'undefined' && HeelsUpAuth.user) {
                try {
                    await HeelsUpAuth.api('/api/me/wishlist', 'POST', { productId });
                } catch (e) {
                    console.error("Failed to add to server wishlist", e);
                }
            }
        }
    }

    async remove(productId) {
        this.items = this.items.filter(id => id !== productId);
        this.saveLocal();
        this.updateUI();
        
        if (typeof HeelsUpAuth !== 'undefined' && HeelsUpAuth.user) {
            try {
                await HeelsUpAuth.api('/api/me/wishlist/' + productId, 'DELETE');
            } catch (e) {
                console.error("Failed to remove from server wishlist", e);
            }
        }
    }

    updateUI() {
        // Update wishlist icons across the site
        document.querySelectorAll('.prod-wish').forEach(btn => {
            // Find onclick attribute that looks like toggleWish(123)
            const match = btn.getAttribute('onclick')?.match(/toggleWish\(\s*(\d+)/);
            if (match) {
                const id = parseInt(match[1]);
                if (this.items.includes(id)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }
}

// Instantiate globally
window.HeelsUpWishlistSystem = new HeelsUpWishlist();

// Backwards compatibility for shop.html and product.html inline scripts
window.toggleWish = function(id, btn) {
    window.HeelsUpWishlistSystem.toggle(id, btn);
};

// Initialize after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    // We delay init slightly to ensure HeelsUpAuth is loaded
    setTimeout(() => {
        window.HeelsUpWishlistSystem.init();
    }, 500);
});
