// Admin Application Logic

// Mock Database of Registrations & Documents
let usersDatabase = [
  {
    id: "B032110194",
    name: "Muhammad Hazim",
    role: "driver",
    plate: "WKL 2847",
    model: "Perodua Myvi",
    color: "White",
    status: "pending",
    expiryDate: "15-05-2027",
    reason: ""
  },
  {
    id: "B032110283",
    name: "Ahmad Danish",
    role: "passenger",
    plate: "",
    model: "",
    color: "",
    status: "pending",
    expiryDate: "",
    reason: ""
  },
  {
    id: "S4829104",
    name: "Prof. Dr. Ridzuan",
    role: "driver",
    plate: "MCE 9942",
    model: "Proton X70",
    color: "Grey",
    status: "approved",
    expiryDate: "20-11-2026",
    reason: ""
  },
  {
    id: "B032110992",
    name: "Sarah binti Ahmad",
    role: "passenger",
    plate: "",
    model: "",
    color: "",
    status: "approved",
    expiryDate: "",
    reason: ""
  },
  {
    id: "B032110842",
    name: "Lim Wei Xiong",
    role: "driver",
    plate: "JAA 1234",
    model: "Honda City",
    color: "Black",
    status: "rejected",
    expiryDate: "05-02-2025",
    reason: "Road tax has expired since 05-02-2025. Please upload a valid document."
  },
  {
    id: "B032110321",
    name: "Nursyahira binti Mohamad",
    role: "driver",
    plate: "VCH 8329",
    model: "Toyota Yaris",
    color: "Red",
    status: "pending",
    expiryDate: "12-09-2027",
    reason: ""
  }
];

// Active State
let currentSelectedUserId = null;

// SVG Document Drawing Functions
function drawMatricCard(id, name) {
  return `
    <svg width="340" height="210" viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f1f5f9;stop-opacity:1" />
        </linearGradient>
      </defs>
      <!-- Card background -->
      <rect width="340" height="210" rx="12" fill="url(#cardGrad)" stroke="#cbd5e1" stroke-width="2"/>
      
      <!-- Top banner -->
      <path d="M 0 12 A 12 12 0 0 1 12 0 L 328 0 A 12 12 0 0 1 340 12 L 340 45 L 0 45 Z" fill="#0057B8"/>
      <text x="15" y="28" fill="#ffffff" font-family="'Inter', sans-serif" font-weight="bold" font-size="16">UNIVERSITI TEKNIKAL MELAKA</text>
      
      <!-- Student photo placeholder -->
      <rect x="20" y="60" width="90" height="110" rx="6" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
      <circle cx="65" cy="100" r="22" fill="#94a3b8"/>
      <path d="M 35 148 C 35 125, 95 125, 95 148 Z" fill="#94a3b8"/>
      
      <!-- Details -->
      <text x="125" y="80" fill="#0057B8" font-family="'Inter', sans-serif" font-weight="800" font-size="10" letter-spacing="0.5">STUDENT MATRIC CARD</text>
      
      <text x="125" y="105" fill="#64748b" font-family="'Inter', sans-serif" font-weight="bold" font-size="9">NAME</text>
      <text x="125" y="122" fill="#0f172a" font-family="'Inter', sans-serif" font-weight="700" font-size="12" width="180">${name.toUpperCase()}</text>
      
      <text x="125" y="148" fill="#64748b" font-family="'Inter', sans-serif" font-weight="bold" font-size="9">MATRIC ID</text>
      <text x="125" y="165" fill="#0f172a" font-family="'Inter', sans-serif" font-weight="bold" font-size="14">${id}</text>
      
      <!-- Barcode bottom -->
      <rect x="125" y="180" width="190" height="15" fill="#0f172a" rx="2"/>
      <rect x="145" y="180" width="5" height="15" fill="#ffffff"/>
      <rect x="155" y="180" width="10" height="15" fill="#ffffff"/>
      <rect x="175" y="180" width="4" height="15" fill="#ffffff"/>
      <rect x="190" y="180" width="8" height="15" fill="#ffffff"/>
      <rect x="210" y="180" width="12" height="15" fill="#ffffff"/>
      <rect x="235" y="180" width="6" height="15" fill="#ffffff"/>
      <rect x="250" y="180" width="4" height="15" fill="#ffffff"/>
      <rect x="270" y="180" width="10" height="15" fill="#ffffff"/>
      <rect x="290" y="180" width="8" height="15" fill="#ffffff"/>
    </svg>
  `;
}

function drawRoadTax(plate, model, expiryDate) {
  return `
    <svg width="340" height="210" viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="roadTaxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#eff6ff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#dbeafe;stop-opacity:1" />
        </linearGradient>
      </defs>
      <!-- Border and background -->
      <rect width="340" height="210" rx="8" fill="url(#roadTaxGrad)" stroke="#1e3a8a" stroke-width="4" stroke-dasharray="10 5"/>
      <rect x="8" y="8" width="324" height="194" rx="4" fill="none" stroke="#1e3a8a" stroke-width="1.5"/>
      
      <!-- Watermark Badge shape -->
      <circle cx="170" cy="105" r="50" fill="#3b82f6" fill-opacity="0.08" stroke="#3b82f6" stroke-width="2" stroke-opacity="0.12"/>
      
      <!-- JPJ Header -->
      <text x="170" y="32" fill="#1e3a8a" font-family="'Inter', sans-serif" font-weight="800" font-size="12" text-anchor="middle">JABATAN PENGANGKUTAN JALAN MALAYSIA</text>
      <text x="170" y="46" fill="#1e3a8a" font-family="'Inter', sans-serif" font-weight="bold" font-size="8" text-anchor="middle">LESEN KENDERAAN MOTOR (ROAD TAX)</text>
      
      <!-- Plate Badge -->
      <rect x="25" y="65" width="290" height="35" rx="6" fill="#1e3a8a"/>
      <text x="170" y="89" fill="#ffffff" font-family="'Inter', sans-serif" font-weight="900" font-size="20" text-anchor="middle" letter-spacing="2">${plate}</text>
      
      <!-- Details -->
      <text x="35" y="125" fill="#1e40af" font-family="'Inter', sans-serif" font-weight="bold" font-size="8">VEHICLE MODEL</text>
      <text x="35" y="140" fill="#0f172a" font-family="'Inter', sans-serif" font-weight="700" font-size="11">${model}</text>
      
      <text x="185" y="125" fill="#1e40af" font-family="'Inter', sans-serif" font-weight="bold" font-size="8">VALID UNTIL</text>
      <text x="185" y="140" fill="#ef4444" font-family="'Inter', sans-serif" font-weight="800" font-size="11">${expiryDate}</text>
      
      <!-- Receipt details barcode style -->
      <text x="35" y="172" fill="#64748b" font-family="'Inter', sans-serif" font-weight="600" font-size="7">RECEIPT NO: JPJ-MY-8492027581</text>
      <text x="35" y="184" fill="#64748b" font-family="'Inter', sans-serif" font-weight="600" font-size="7">FEE PAID: RM 90.00 (M-COMMERCE)</text>
      
      <!-- Hologram seal representation -->
      <rect x="275" y="150" width="30" height="38" fill="#a855f7" rx="3" fill-opacity="0.8"/>
      <circle cx="290" cy="169" r="10" fill="#f43f5e" fill-opacity="0.8"/>
    </svg>
  `;
}

// App Logic Functions

// Calculate and update dashboard statistics cards
function updateStatistics() {
  const total = usersDatabase.length;
  const pending = usersDatabase.filter(u => u.status === 'pending').length;
  const approved = usersDatabase.filter(u => u.status === 'approved').length;
  const rejected = usersDatabase.filter(u => u.status === 'rejected').length;

  document.getElementById('stat-total').innerText = total;
  document.getElementById('stat-pending').innerText = pending;
  document.getElementById('stat-approved').innerText = approved;
  document.getElementById('stat-rejected').innerText = rejected;
  
  // Update sidebar pending badge
  const pendingBadge = document.getElementById('pending-badge');
  pendingBadge.innerText = pending;
  pendingBadge.style.display = pending > 0 ? 'inline-block' : 'none';
}

// Render data tables
function renderTables() {
  const searchBar = document.getElementById('search-bar');
  const roleFilter = document.getElementById('role-filter');
  const statusFilter = document.getElementById('status-filter');

  const query = searchBar.value.toLowerCase().trim();
  const roleValue = roleFilter.value;
  const statusValue = statusFilter.value;

  const filtered = usersDatabase.filter(user => {
    const matchesSearch = user.id.toLowerCase().includes(query) || user.name.toLowerCase().includes(query);
    const matchesRole = roleValue === 'all' || user.role === roleValue;
    const matchesStatus = statusValue === 'all' || user.status === statusValue;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Render Verifications Tab Table
  const verificationsTbody = document.getElementById('verifications-tbody');
  verificationsTbody.innerHTML = '';
  
  if (filtered.length === 0) {
    verificationsTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No records found.</td></tr>`;
  } else {
    filtered.forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${user.id}</strong></td>
        <td>${user.name}</td>
        <td><span style="font-weight:600; text-transform:capitalize;">${user.role}</span></td>
        <td>${user.plate || '<span style="color:var(--text-muted)">-</span>'}</td>
        <td>${user.model || '<span style="color:var(--text-muted)">-</span>'}</td>
        <td>${user.color || '<span style="color:var(--text-muted)">-</span>'}</td>
        <td><span class="status-badge ${user.status}">${user.status}</span></td>
        <td>
          <div class="btn-group">
            <button class="btn btn-primary" onclick="openInspectionModal('${user.id}')">View</button>
            ${user.status === 'pending' ? `
              <button class="btn btn-secondary" onclick="approveDirect('${user.id}')">Approve</button>
              <button class="btn btn-danger" onclick="openRejectReasonModal('${user.id}')">Reject</button>
            ` : ''}
          </div>
        </td>
      `;
      verificationsTbody.appendChild(tr);
    });
  }

  // Render Dashboard Pending Preview Backlog
  const pendingBacklog = usersDatabase.filter(u => u.status === 'pending');
  const backlogTbody = document.getElementById('dashboard-backlog-tbody');
  backlogTbody.innerHTML = '';

  if (pendingBacklog.length === 0) {
    backlogTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 24px;">All verifications caught up! No pending documents.</td></tr>`;
  } else {
    pendingBacklog.forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${user.id}</strong></td>
        <td>${user.name}</td>
        <td><span style="font-weight:600; text-transform:capitalize;">${user.role}</span></td>
        <td>${user.plate || '<span style="color:var(--text-muted)">-</span>'}</td>
        <td><span class="status-badge pending">Pending</span></td>
        <td>
          <div class="btn-group">
            <button class="btn btn-primary" onclick="openInspectionModal('${user.id}')">View</button>
          </div>
        </td>
      `;
      backlogTbody.appendChild(tr);
    });
  }
}

// Actions & Modal Hooks

// Direct Approval from table
window.approveDirect = function(userId) {
  const user = usersDatabase.find(u => u.id === userId);
  if (user) {
    user.status = 'approved';
    user.reason = '';
    updateStatistics();
    renderTables();
  }
};

// Open Document View Modal
window.openInspectionModal = function(userId) {
  const user = usersDatabase.find(u => u.id === userId);
  if (!user) return;

  currentSelectedUserId = userId;

  // Set text fields
  document.getElementById('modal-user-name').innerText = `Verify Documents - ${user.name}`;
  document.getElementById('modal-user-matric').innerText = `Matric / Staff ID: ${user.id}`;
  
  document.getElementById('ocr-val-name').value = user.name;
  document.getElementById('ocr-val-id').value = user.id;

  // Generate and draw Matric Card SVG
  document.getElementById('matric-image-container').innerHTML = drawMatricCard(user.id, user.name);

  // Toggle Road Tax based on role
  const roadTaxGroup = document.getElementById('roadtax-preview-group');
  const ocrVehicleDetails = document.getElementById('ocr-vehicle-details');
  const modalApproveBtn = document.getElementById('modal-approve-btn');
  const modalDeclineBtn = document.getElementById('modal-decline-btn');

  // Configure action buttons visibility
  if (user.status !== 'pending') {
    modalApproveBtn.style.display = 'none';
    modalDeclineBtn.style.display = 'none';
  } else {
    modalApproveBtn.style.display = 'inline-flex';
    modalDeclineBtn.style.display = 'inline-flex';
  }

  if (user.role === 'driver') {
    roadTaxGroup.style.display = 'block';
    ocrVehicleDetails.style.display = 'block';
    
    document.getElementById('ocr-val-plate').value = user.plate || 'N/A';
    document.getElementById('ocr-val-model').value = user.model || 'N/A';
    document.getElementById('ocr-val-color').value = user.color || 'N/A';
    
    // Draw Road Tax SVG
    document.getElementById('roadtax-image-container').innerHTML = drawRoadTax(
      user.plate || 'N/A', 
      user.model || 'N/A', 
      user.expiryDate || 'N/A'
    );
  } else {
    roadTaxGroup.style.display = 'none';
    ocrVehicleDetails.style.display = 'none';
  }

  // Open Modal
  document.getElementById('view-modal').style.display = 'flex';
};

// Close view modal
document.getElementById('close-view-modal').addEventListener('click', () => {
  document.getElementById('view-modal').style.display = 'none';
  currentSelectedUserId = null;
});

// Approve from inside Modal
document.getElementById('modal-approve-btn').addEventListener('click', () => {
  if (currentSelectedUserId) {
    approveDirect(currentSelectedUserId);
    document.getElementById('view-modal').style.display = 'none';
    currentSelectedUserId = null;
  }
});

// Reject from inside Modal
document.getElementById('modal-decline-btn').addEventListener('click', () => {
  if (currentSelectedUserId) {
    openRejectReasonModal(currentSelectedUserId);
  }
});

// Open Reject Reason modal
window.openRejectReasonModal = function(userId) {
  currentSelectedUserId = userId;
  document.getElementById('reject-reason-text').value = '';
  document.getElementById('reject-modal').style.display = 'flex';
};

// Close Reject Reason modal
document.getElementById('close-reject-modal').addEventListener('click', () => {
  document.getElementById('reject-modal').style.display = 'none';
});
document.getElementById('cancel-reject-btn').addEventListener('click', () => {
  document.getElementById('reject-modal').style.display = 'none';
});

// Confirm rejection with reason
document.getElementById('confirm-reject-btn').addEventListener('click', () => {
  const reason = document.getElementById('reject-reason-text').value.trim();
  if (!reason) {
    alert('Please enter a reason for rejecting the documents.');
    return;
  }

  const user = usersDatabase.find(u => u.id === currentSelectedUserId);
  if (user) {
    user.status = 'rejected';
    user.reason = reason;
    
    updateStatistics();
    renderTables();
    
    // Close both modals
    document.getElementById('reject-modal').style.display = 'none';
    document.getElementById('view-modal').style.display = 'none';
    currentSelectedUserId = null;
  }
});

// Search & Filter event listeners
document.getElementById('search-bar').addEventListener('input', renderTables);
document.getElementById('role-filter').addEventListener('change', renderTables);
document.getElementById('status-filter').addEventListener('change', renderTables);

// View backlog navigation shortcut
document.getElementById('view-all-backlog').addEventListener('click', () => {
  const tab = document.querySelector('.menu-item[data-tab="verifications"]');
  tab.click();
  // Set status filter to Pending only to easily view pending items
  document.getElementById('status-filter').value = 'pending';
  renderTables();
});

// Tab Navigation Logic
const menuItems = document.querySelectorAll('.menu-item');
menuItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Active tab style toggle
    menuItems.forEach(mi => mi.classList.remove('active'));
    item.classList.add('active');

    // Section switch
    const tabName = item.getAttribute('data-tab');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`${tabName}-section`).classList.add('active');
  });
});

// Theme Mode toggler logic
const themeToggleBtn = document.getElementById('theme-toggle');

// Load saved theme
const savedTheme = localStorage.getItem('admin-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggleBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('admin-theme', newTheme);
});

// Initial Setup
updateStatistics();
renderTables();
