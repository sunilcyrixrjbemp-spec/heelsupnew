const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

// Extract the header (up to <div class="content">) from admin.html
const adminHtmlPath = path.join(publicDir, 'admin.html');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

const headMatch = adminHtml.match(/([\s\S]*?)<div class="content">/);
if (!headMatch) {
    console.error("Could not find <div class=\"content\"> in admin.html");
    process.exit(1);
}
let headerHtml = headMatch[1];

// Extract the scripts
const scriptMatch = adminHtml.match(/(<script src="app-config\.js">[\s\S]*?<\/script>\s*<\/body>)/);
let footerHtml = `    </div><!-- /content -->
  </div><!-- /main -->
</div>

<script src="app-config.js"></script>
<script src="app-auth.js"></script>
<script>
function toggleSidebar(){
  const s=document.getElementById('sidebar');
  const o=document.getElementById('mobOverlay');
  s.classList.toggle('open');
  o.style.display = s.classList.contains('open')?'block':'none';
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobOverlay').style.display='none';
}
function doLogout(){ HeelsUpAuth.clearSession(); window.location='login.html'; }
</script>
</body>
</html>`;

if (scriptMatch) {
    // footerHtml = "    </div>\n  </div>\n</div>\n\n" + scriptMatch[1] + "\n</html>";
}

// Modify headerHtml to not hardcode "active" on dashboard, and change links
// to actual html files instead of onclick="showSection(...)"
headerHtml = headerHtml.replace(/onclick="showSection\('dashboard',this\)"/g, 'href="admin.html"');
headerHtml = headerHtml.replace(/onclick="showSection\('products',this\)"/g, 'href="admin-products.html"');
headerHtml = headerHtml.replace(/onclick="showSection\('orders',this\)"/g, 'href="admin-orders.html"');
headerHtml = headerHtml.replace(/onclick="showSection\('customers',this\)"/g, 'href="admin-customers.html"');
headerHtml = headerHtml.replace(/onclick="showSection\('coupons',this\)"/g, 'href="admin-coupons.html"');
headerHtml = headerHtml.replace(/onclick="showSection\('reviews',this\)"/g, 'href="admin-reviews.html"');
headerHtml = headerHtml.replace(/onclick="showSection\('returns',this\)"/g, 'href="admin-returns.html"');
headerHtml = headerHtml.replace(/<div class="nav-item/g, '<a class="nav-item');
headerHtml = headerHtml.replace(/<\/div>\s*(<!--.*)?\n\s*<div class="nav-label"/g, '</a>\n      <div class="nav-label"'); // fix closing tags
headerHtml = headerHtml.replace(/<\/div>$/gm, '</a>'); // this is tricky, let's use regex carefully

// Clean up the replacing of div to a for nav-items
headerHtml = headerHtml.replace(/<div class="nav-item(.*?)>(.*?)<\/div>/gs, '<a class="nav-item"$1>$2</a>');

// Now loop over all admin-*.html files and replace
const files = fs.readdirSync(publicDir);
for (const file of files) {
    if (file.startsWith('admin-') && file.endsWith('.html')) {
        let content = fs.readFileSync(path.join(publicDir, file), 'utf8');
        
        // Find where the actual content starts
        let contentStartIdx = -1;
        let contentEndIdx = -1;

        if (content.includes('<div class="content">') || content.includes('<div class="admin-content">')) {
            const startStr = content.includes('<div class="admin-content">') ? '<div class="admin-content">' : '<div class="content">';
            contentStartIdx = content.indexOf(startStr) + startStr.length;
            
            // Find end (usually before </main> or script tags)
            if (content.includes('</main>')) {
                contentEndIdx = content.lastIndexOf('</main>');
                if (content.includes('</div><!-- /content -->', contentStartIdx) && content.indexOf('</div><!-- /content -->', contentStartIdx) < contentEndIdx) {
                    contentEndIdx = content.lastIndexOf('</div><!-- /content -->');
                }
            } else if (content.includes('<script>')) {
                contentEndIdx = content.lastIndexOf('<script>');
                // backtrack to previous closing div
                contentEndIdx = content.lastIndexOf('</div>', contentEndIdx);
                contentEndIdx = content.lastIndexOf('</div>', contentEndIdx - 1);
            }
        } else {
             console.log(`Skipping ${file} - no content div found`);
             continue;
        }

        if (contentStartIdx > -1 && contentEndIdx > -1) {
            const innerContent = content.substring(contentStartIdx, contentEndIdx);
            
            // Customize header title
            let title = file.replace('admin-', '').replace('.html', '');
            title = title.charAt(0).toUpperCase() + title.slice(1);
            
            let thisHeader = headerHtml.replace('Dashboard — HeelsUp Admin', `${title} — HeelsUp Admin`);
            thisHeader = thisHeader.replace('id="topbarTitle">Dashboard</div>', `id="topbarTitle">${title}</div>`);
            
            // Remove active class from all
            thisHeader = thisHeader.replace(/class="nav-item active"/g, 'class="nav-item"');
            // Add active class to current
            thisHeader = thisHeader.replace(new RegExp(`href="${file}" class="nav-item"`), `href="${file}" class="nav-item active"`);

            const newFileContent = thisHeader + '<div class="content">\n' + innerContent + '\n' + footerHtml;
            fs.writeFileSync(path.join(publicDir, file), newFileContent);
            console.log(`Updated ${file}`);
        }
    }
}
