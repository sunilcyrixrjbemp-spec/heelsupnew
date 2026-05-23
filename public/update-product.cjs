const fs = require('fs');
let content = fs.readFileSync('product.html', 'utf8');

// Replace SAMPLE_REVIEWS with an API call
const fetchReviewsCode = 
      let realReviews = [];
      async function loadReviews(productId) {
        try {
          const res = await fetch('/api/products/' + productId + '/reviews');
          if(res.ok) {
            const data = await res.json();
            realReviews = data.reviews || [];
            
            // Re-render reviews with real data
            const rating = parseFloat(document.getElementById('info-rating-val').innerText) || 4.5;
            renderReviews(rating, realReviews.length);
          }
        } catch(e) { console.error('Failed to load reviews', e); }
      }
;

content = content.replace('const SAMPLE_REVIEWS = [', fetchReviewsCode + '\n      const SAMPLE_REVIEWS = [');

// Modify renderReviews to use realReviews if available, else fallback
content = content.replace('const cardsHTML = SAMPLE_REVIEWS.map(r =>', 'const reviewsToRender = realReviews.length ? realReviews : [];\n      if(!reviewsToRender.length) { document.getElementById("review-cards").innerHTML = "<p style=\\"color:var(--text-3)\\"><br>Be the first to review this product!</p>"; return; }\n      const cardsHTML = reviewsToRender.map(r =>');

// Map database fields to the template
content = content.replace(/\$\{r\.name\}/g, '');
content = content.replace(/\$\{r\.city\}/g, '');
content = content.replace(/\$\{r\.body\}/g, '');
content = content.replace(/\$\{r\.tags\.map.*?\}/g, ''); // Remove tags since DB doesn't have it

// Modify the submit button listener
const submitRegex = /document\.getElementById\('submit-review-btn'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?showToast\('?? Review submitted![^]+?\}\);/g;
const newSubmitCode = 
      document.getElementById('submit-review-btn').addEventListener('click', async () => {
        if (!reviewRating) { showToast('Please select a star rating', 'error'); return; }
        const title = document.getElementById('review-title').value.trim();
        const body = document.getElementById('review-body').value.trim();
        if (!body) { showToast('Please write your review', 'error'); return; }
        
        try {
          const params = new URLSearchParams(location.search);
          const productId = params.get('id');
          await HeelsUpAuth.api('/api/products/' + productId + '/reviews', 'POST', { rating: reviewRating, title, body });
          closeModal();
          showToast('?? Review submitted for moderation!', 'success');
        } catch(e) {
          showToast(e.message || 'Failed to submit review', 'error');
        }
      });
;
content = content.replace(submitRegex, newSubmitCode.trim());

// Call loadReviews inside init
content = content.replace('renderReviews(rating, reviewCount);', 'renderReviews(rating, reviewCount);\n        loadReviews(p.id);');

fs.writeFileSync('product.html', content);
console.log('Modified product.html');
