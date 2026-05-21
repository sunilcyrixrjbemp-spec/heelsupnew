const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'admin-analytics.html');
let content = fs.readFileSync(file, 'utf8');

// Replace amounts and values with span IDs
content = content.replace(
  '<div class="stat-value">24,832</div>',
  '<div class="stat-value" id="ana-sess">0</div>'
);
content = content.replace(
  '<div class="stat-value">18,541</div>',
  '<div class="stat-value" id="ana-usr">0</div>'
);
content = content.replace(
  '<div class="stat-value">3.84%</div>',
  '<div class="stat-value" id="ana-conv">0%</div>'
);
content = content.replace(
  '<div class="stat-value">41.2%</div>',
  '<div class="stat-value" id="ana-bounce">0%</div>'
);

const jsScript = `
<script>
async function loadAnalyticsData() {
  try {
    const res = await HeelsUpAuth.api('/api/analytics/dashboard');
    if(!res || !res.summary) return;
    
    // We don't have true sessions/visitors from the backend right now,
    // so we will show real Total Orders and Total Customers instead of fake data.
    
    // Let's modify the DOM labels dynamically since we don't have 'sessions'
    document.querySelectorAll('.stat-label')[0].innerHTML = 'Total Orders';
    document.getElementById('ana-sess').textContent = res.summary.total_orders || 0;
    
    document.querySelectorAll('.stat-label')[1].innerHTML = 'Total Customers';
    document.getElementById('ana-usr').textContent = res.summary.total_customers || 0;
    
    document.querySelectorAll('.stat-label')[2].innerHTML = 'Total Revenue';
    document.getElementById('ana-conv').textContent = '₹' + Math.round(res.summary.total_revenue || 0).toLocaleString('en-IN');
    
    document.querySelectorAll('.stat-label')[3].innerHTML = 'Pending Orders';
    document.getElementById('ana-bounce').textContent = res.summary.pending_orders || 0;
    
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}
document.addEventListener('DOMContentLoaded', loadAnalyticsData);
</script>
`;

if (content.includes('</body>')) {
  content = content.replace('</body>', jsScript + '\n</body>');
  fs.writeFileSync(file, content);
  console.log('Successfully injected logic into admin-analytics.html');
} else {
  console.error('Failed to find </body>');
}
