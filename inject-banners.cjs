const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'admin-banners.html');
let content = fs.readFileSync(file, 'utf8');

const jsScript = `
<script>
let allBanners = [];

async function loadBanners() {
  try {
    const res = await HeelsUpAuth.api('/api/banners/admin/all');
    allBanners = res || [];
    renderBanners();
  } catch (err) {
    showToast('Failed to load banners', 'error');
  }
}

function renderBanners() {
  const tbody = document.getElementById('bannersTableBody');
  if(!tbody) return;
  
  if(allBanners.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px">No banners found.</td></tr>';
    return;
  }
  
  let html = '';
  allBanners.forEach(b => {
    html += \`
      <tr>
        <td>
          <img src="\${b.image_url}" class="tbl-img" onerror="this.src='https://placehold.co/100x40/f1f5f9/94a3b8?text=Image'">
        </td>
        <td>
          <div class="tbl-name">\${b.title || '—'}</div>
          <div class="tbl-sub">\${b.subtitle || '—'}</div>
        </td>
        <td><span class="badge" style="background:#f1f5f9;color:#475569">\${b.position || 'hero'}</span></td>
        <td>\${b.sort_order || 0}</td>
        <td>\${b.is_active ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-inactive">Inactive</span>'}</td>
        <td>
          <div class="act-cell">
            <button class="btn-icon btn-edit" onclick="editBanner(\${b.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-icon btn-del" onclick="deleteBanner(\${b.id})"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    \`;
  });
  tbody.innerHTML = html;
}

function showAddModal() {
  document.getElementById('bannerForm').reset();
  document.getElementById('bannerId').value = '';
  document.getElementById('bannerModal').classList.add('show');
}
function closeBannerModal() {
  document.getElementById('bannerModal').classList.remove('show');
}

function editBanner(id) {
  const b = allBanners.find(x => x.id == id);
  if(!b) return;
  document.getElementById('bannerId').value = b.id;
  document.getElementById('bannerTitle').value = b.title || '';
  document.getElementById('bannerSub').value = b.subtitle || '';
  document.getElementById('bannerImg').value = b.image_url || '';
  document.getElementById('bannerLink').value = b.link_url || '';
  document.getElementById('bannerPos').value = b.position || 'hero';
  document.getElementById('bannerSort').value = b.sort_order || 0;
  document.getElementById('bannerActive').checked = b.is_active ? true : false;
  document.getElementById('bannerModal').classList.add('show');
}

async function saveBanner(e) {
  e.preventDefault();
  const id = document.getElementById('bannerId').value;
  const payload = {
    title: document.getElementById('bannerTitle').value,
    subtitle: document.getElementById('bannerSub').value,
    image_url: document.getElementById('bannerImg').value,
    link_url: document.getElementById('bannerLink').value,
    position: document.getElementById('bannerPos').value,
    sort_order: document.getElementById('bannerSort').value,
    is_active: document.getElementById('bannerActive').checked
  };
  
  try {
    if(id) {
      await HeelsUpAuth.api('/api/banners/' + id, 'PUT', payload);
      showToast('Banner updated');
    } else {
      await HeelsUpAuth.api('/api/banners', 'POST', payload);
      showToast('Banner created');
    }
    closeBannerModal();
    loadBanners();
  } catch (err) {
    showToast(err.message || 'Failed to save', 'error');
  }
}

async function deleteBanner(id) {
  if(!confirm('Are you sure you want to delete this banner?')) return;
  try {
    await HeelsUpAuth.api('/api/banners/' + id, 'DELETE');
    showToast('Banner deleted');
    loadBanners();
  } catch(err) {
    showToast('Failed to delete', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Add ID to tbody
  const tables = document.querySelectorAll('tbody');
  if(tables.length > 0) {
    tables[0].id = 'bannersTableBody';
  }
  
  // Add ID to "Add Banner" button
  const btns = document.querySelectorAll('.btn-primary');
  btns.forEach(b => {
    if(b.textContent.includes('Add Banner')) {
      b.setAttribute('onclick', 'showAddModal()');
    }
  });

  // Setup form submission
  const forms = document.querySelectorAll('form');
  if(forms.length > 0) {
    forms[0].id = 'bannerForm';
    forms[0].setAttribute('onsubmit', 'saveBanner(event)');
    // Assign IDs to form fields based on existing labels in the static HTML
    const inputs = forms[0].querySelectorAll('input, select');
    if(inputs.length >= 6) {
      inputs[0].id = 'bannerTitle';
      inputs[1].id = 'bannerSub';
      inputs[2].id = 'bannerImg';
      inputs[3].id = 'bannerLink';
      inputs[4].id = 'bannerPos';
      inputs[5].id = 'bannerSort';
      
      // Inject hidden ID field
      forms[0].insertAdjacentHTML('afterbegin', '<input type="hidden" id="bannerId">');
      
      // Inject is_active checkbox if missing
      forms[0].insertAdjacentHTML('beforeend', '<div class="form-check"><input type="checkbox" id="bannerActive" checked><label>Active Status</label></div>');
    }
    // Fix modal close buttons
    const closeBtns = document.querySelectorAll('.modal-close, .btn-outline');
    closeBtns.forEach(b => b.setAttribute('onclick', 'closeBannerModal()'));
    
    // Add ID to modal
    const modals = document.querySelectorAll('.modal-backdrop');
    if(modals.length > 0) {
      modals[0].id = 'bannerModal';
    }
  }

  loadBanners();
});
</script>
`;

if (content.includes('</body>')) {
  // Strip out old dummy JS if any exists. The user's static HTML usually has just closeSidebar
  content = content.replace('</body>', jsScript + '\n</body>');
  fs.writeFileSync(file, content);
  console.log('Successfully injected logic into admin-banners.html');
} else {
  console.error('Failed to find </body>');
}
