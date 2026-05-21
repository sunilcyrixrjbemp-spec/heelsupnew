const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'admin-reports.html');
let content = fs.readFileSync(file, 'utf8');

// Replace amounts and values with span IDs
content = content.replace(
  '<div class="report-hero-amount">₹4,83,<span>240</span></div>',
  '<div class="report-hero-amount" id="rep-rev">₹0</div>'
);
content = content.replace(
  '<div class="kpi-val">1,284</div>',
  '<div class="kpi-val" id="rep-ord">0</div>'
);
content = content.replace(
  '<div class="kpi-val">347</div>',
  '<div class="kpi-val" id="rep-cust">0</div>'
);
content = content.replace(
  '<div class="kpi-val">₹847</div>',
  '<div class="kpi-val" id="rep-aov">₹0</div>'
);

// We need to inject JS logic right before </body>
const jsScript = `
<script>
// ── REPORTS DATA FETCHING ──────────────────────────────────────────
async function loadReportsData() {
  try {
    const res = await HeelsUpAuth.api('/api/reports/sales');
    if(!res || !res.summary) return;
    
    // Update KPI Hero
    document.getElementById('rep-rev').innerHTML = '₹' + Math.round(res.summary.total_revenue || 0).toLocaleString('en-IN');
    document.getElementById('rep-ord').textContent = res.summary.total_orders || 0;
    document.getElementById('rep-cust').textContent = res.summary.unique_customers || 0;
    document.getElementById('rep-aov').textContent = '₹' + Math.round(res.summary.avg_order_value || 0).toLocaleString('en-IN');
    
    // Here we can also dynamically populate Top Products by finding the <tbody> in the "Top Products" section
    // and replacing its innerHTML with a loop over res.top_products. 
  } catch (err) {
    console.error('Failed to load reports:', err);
  }
}
document.addEventListener('DOMContentLoaded', loadReportsData);
</script>
`;

if (content.includes('</body>')) {
  content = content.replace('</body>', jsScript + '\n</body>');
  fs.writeFileSync(file, content);
  console.log('Successfully injected logic into admin-reports.html');
} else {
  console.error('Failed to find </body>');
}
