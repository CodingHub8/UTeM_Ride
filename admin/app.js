// UTeM Ride — Admin Portal Application Logic
// Connected to Firebase Firestore and Authentication in Real-time

// Provide a safe fallback global process object if env-config.js failed to load or was blocked by browser file:// restrictions
if (typeof process === 'undefined') {
  window.process = { env: {} };
}

// 1. Initialize Firebase Compat using project credentials from .env via auto-generated env-config.js
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};



// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Local Cache of Users & Verifications
let usersDatabase = [];
let currentSelectedUserId = null;

// ============================================================
// AUTHENTICATION & LOGIN SCREEN CONTROL
// ============================================================
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const logoutBtn = document.getElementById('logout-btn');

// Listen for Firebase Auth changes
auth.onAuthStateChanged((user) => {
  if (user || localStorage.getItem('admin_logged_in') === 'true') {
    // Authenticated: hide login overlay and start database synchronization
    loginOverlay.style.display = 'none';
    startDatabaseListeners();
  } else {
    // Unauthenticated: show login overlay
    loginOverlay.style.display = 'flex';
  }
});

// Handle Sign In submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  try {
    // Try to authenticate using Firebase Auth
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    console.warn("Firebase Auth login failed. Checking mock fallback...", error.message);
    // Fallback: If credentials match the requested mock details, allow mock access
    if (email === 'admin@utemride.com' && password === 'admin12345') {
      localStorage.setItem('admin_logged_in', 'true');
      loginOverlay.style.display = 'none';
      startDatabaseListeners();
    } else {
      alert("Invalid credentials! Please try again.\nError: " + error.message);
    }
  }
});

// Handle Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await auth.signOut();
  } catch (err) {
    console.error("Sign out error:", err);
  }
  localStorage.removeItem('admin_logged_in');
  location.reload(); // Reload page to clear all cached listeners and data
});


// ============================================================
// FIRESTORE LIVE REAL-TIME DATA SYNCHRONIZATION
// ============================================================
let usersUnsubscribe = null;
let docsUnsubscribe = null;
let ridesUnsubscribe = null;
let chartInstances = {};
let cachedAnalyticsPayload = null;

const STATUS_LABELS = {
  requested: 'Requested',
  accepted: 'Accepted',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  unknown: 'Unknown',
};

function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    text: isDark ? '#cbd5e1' : '#475569',
    grid: isDark ? '#334155' : '#e2e8f0',
    primary: '#0057B8',
    secondary: '#10b981',
    accent: '#f59e0b',
    danger: '#ef4444',
    palette: ['#0057B8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'],
  };
}

function destroyCharts() {
  Object.values(chartInstances).forEach((c) => c?.destroy());
  chartInstances = {};
}

function parseRideDate(ride) {
  if (ride.created_at?.toDate) return ride.created_at.toDate();
  if (ride.timestamp) return new Date(ride.timestamp);
  return null;
}

function getDummyRideAnalytics() {
  return {
    pickups: [
      { location: 'Kolej Kediaman Lestari, UTeM', count: 42 },
      { location: 'FTMK, UTeM Main Campus', count: 31 },
      { location: 'FKE, UTeM', count: 18 },
      { location: 'Kolej Tun Fatimah', count: 12 },
      { location: 'UTeM Main Gate', count: 9 },
    ],
    destinations: [
      { location: 'Mydin MITC, Ayer Keroh', count: 27 },
      { location: 'Mahkota Parade, Melaka', count: 22 },
      { location: 'Melaka Sentral', count: 19 },
      { location: 'AEON Bandaraya Melaka', count: 14 },
      { location: 'UTeM Main Campus', count: 11 },
    ],
  };
}

function getDummyRidesForCharts() {
  const dummy = getDummyRideAnalytics();
  const rides = [];
  const statuses = ['completed', 'completed', 'completed', 'requested', 'accepted', 'cancelled', 'in_progress'];
  const now = Date.now();

  dummy.pickups.forEach((p, i) => {
    for (let n = 0; n < p.count; n++) {
      const dayOffset = n % 7;
      rides.push({
        pickup_address: p.location,
        destination_address: dummy.destinations[n % dummy.destinations.length].location,
        status: statuses[(i + n) % statuses.length],
        timestamp: now - dayOffset * 86400000 - n * 3600000,
      });
    }
  });

  return rides.slice(0, 120);
}

function aggregateRideLocations(rides) {
  const pickupMap = {};
  const destMap = {};
  rides.forEach((ride) => {
    const p = ride.pickup_address || 'Unknown pickup';
    const d = ride.destination_address || 'Unknown destination';
    pickupMap[p] = (pickupMap[p] || 0) + 1;
    destMap[d] = (destMap[d] || 0) + 1;
  });
  const toList = (map) =>
    Object.entries(map)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  return { pickups: toList(pickupMap), destinations: toList(destMap) };
}

function aggregateRidesByDay(rides, days = 7) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const keys = [];
  const labels = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    keys.push(key);
    labels.push(d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' }));
  }

  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  rides.forEach((ride) => {
    const date = parseRideDate(ride);
    if (!date) return;
    const key = date.toISOString().slice(0, 10);
    if (counts[key] !== undefined) counts[key]++;
  });

  return { labels, data: keys.map((k) => counts[k]) };
}

function aggregateStatusBreakdown(rides) {
  const map = {};
  rides.forEach((ride) => {
    const s = ride.status || 'unknown';
    map[s] = (map[s] || 0) + 1;
  });
  return map;
}

function truncateLabel(text, max = 28) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function buildAnalyticsPayload(rides) {
  const locations = aggregateRideLocations(rides);
  const timeline = aggregateRidesByDay(rides, 7);
  const statusMap = aggregateStatusBreakdown(rides);
  const completed = statusMap.completed || 0;
  const active = (statusMap.requested || 0) + (statusMap.accepted || 0) + (statusMap.arrived || 0) + (statusMap.in_progress || 0);
  const weekTotal = timeline.data.reduce((sum, n) => sum + n, 0);

  return {
    rides,
    pickups: locations.pickups,
    destinations: locations.destinations,
    timeline,
    statusMap,
    stats: {
      total: rides.length,
      completed,
      active,
      avgPerDay: +(weekTotal / 7).toFixed(1),
    },
  };
}

function renderAnalyticsTables(pickups, destinations) {
  const pickupBody = document.getElementById('analytics-pickup-tbody');
  const destBody = document.getElementById('analytics-destination-tbody');
  pickupBody.innerHTML =
    pickups.map((r) => `<tr><td>${r.location}</td><td><strong>${r.count}</strong></td></tr>`).join('') ||
    '<tr><td colspan="2">No data</td></tr>';
  destBody.innerHTML =
    destinations.map((r) => `<tr><td>${r.location}</td><td><strong>${r.count}</strong></td></tr>`).join('') ||
    '<tr><td colspan="2">No data</td></tr>';
}

function renderAnalyticsStats(stats) {
  document.getElementById('analytics-stat-total').textContent = stats.total;
  document.getElementById('analytics-stat-completed').textContent = stats.completed;
  document.getElementById('analytics-stat-active').textContent = stats.active;
  document.getElementById('analytics-stat-avg').textContent = stats.avgPerDay;
}

function renderAnalyticsCharts(payload) {
  if (typeof Chart === 'undefined') return;

  destroyCharts();
  const colors = getChartColors();
  const commonScale = {
    ticks: { color: colors.text, font: { size: 11 } },
    grid: { color: colors.grid },
  };

  const lineCtx = document.getElementById('chart-rides-line');
  if (lineCtx) {
    chartInstances.line = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: payload.timeline.labels,
        datasets: [
          {
            label: 'Rides',
            data: payload.timeline.data,
            borderColor: colors.primary,
            backgroundColor: 'rgba(0, 87, 184, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: colors.primary,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: commonScale,
          y: { ...commonScale, beginAtZero: true, ticks: { ...commonScale.ticks, stepSize: 1 } },
        },
      },
    });
  }

  const topPickups = payload.pickups.slice(0, 6);
  const pickupCtx = document.getElementById('chart-pickup-bar');
  if (pickupCtx) {
    chartInstances.pickup = new Chart(pickupCtx, {
      type: 'bar',
      data: {
        labels: topPickups.map((r) => truncateLabel(r.location)),
        datasets: [
          {
            label: 'Bookings',
            data: topPickups.map((r) => r.count),
            backgroundColor: colors.palette.slice(0, topPickups.length),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ...commonScale, beginAtZero: true, ticks: { ...commonScale.ticks, stepSize: 1 } },
          y: { ...commonScale, ticks: { ...commonScale.ticks, autoSkip: false } },
        },
      },
    });
  }

  const topDest = payload.destinations.slice(0, 6);
  const destCtx = document.getElementById('chart-destination-bar');
  if (destCtx) {
    chartInstances.destination = new Chart(destCtx, {
      type: 'bar',
      data: {
        labels: topDest.map((r) => truncateLabel(r.location)),
        datasets: [
          {
            label: 'Bookings',
            data: topDest.map((r) => r.count),
            backgroundColor: colors.secondary,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ...commonScale, beginAtZero: true, ticks: { ...commonScale.ticks, stepSize: 1 } },
          y: { ...commonScale, ticks: { ...commonScale.ticks, autoSkip: false } },
        },
      },
    });
  }

  const statusEntries = Object.entries(payload.statusMap).sort((a, b) => b[1] - a[1]);
  const statusCtx = document.getElementById('chart-status-doughnut');
  if (statusCtx && statusEntries.length) {
    chartInstances.status = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: statusEntries.map(([k]) => STATUS_LABELS[k] || k),
        datasets: [
          {
            data: statusEntries.map(([, v]) => v),
            backgroundColor: colors.palette.slice(0, statusEntries.length),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.text, boxWidth: 12, padding: 14, font: { size: 11 } },
          },
        },
      },
    });
  }
}

function renderAnalyticsDashboard(rides) {
  const payload = buildAnalyticsPayload(rides);
  cachedAnalyticsPayload = payload;
  renderAnalyticsStats(payload.stats);
  renderAnalyticsTables(payload.pickups, payload.destinations);
  renderAnalyticsCharts(payload);
}

function refreshAnalyticsChartsTheme() {
  if (cachedAnalyticsPayload) {
    renderAnalyticsCharts(cachedAnalyticsPayload);
  }
}

function startRideAnalyticsListener() {
  if (ridesUnsubscribe) ridesUnsubscribe();
  ridesUnsubscribe = db.collection('rides').onSnapshot(
    (snap) => {
      const rides = [];
      snap.forEach((docSnap) => rides.push(docSnap.data()));
      if (rides.length === 0) {
        renderAnalyticsDashboard(getDummyRidesForCharts());
        return;
      }
      renderAnalyticsDashboard(rides);
    },
    () => {
      renderAnalyticsDashboard(getDummyRidesForCharts());
    }
  );
}

function startDatabaseListeners() {
  if (usersUnsubscribe) usersUnsubscribe();
  if (docsUnsubscribe) docsUnsubscribe();
  startRideAnalyticsListener();

  // Listen to users collection
  usersUnsubscribe = db.collection('users').onSnapshot((usersSnapshot) => {
    // Listen to user_documents collection
    docsUnsubscribe = db.collection('user_documents').onSnapshot((docsSnapshot) => {
      const docsMap = {};
      docsSnapshot.forEach((docSnap) => {
        docsMap[docSnap.id] = docSnap.data();
      });

      const usersList = [];
      usersSnapshot.forEach((userSnap) => {
        const userData = userSnap.data();
        const userId = userSnap.id;
        const userDoc = docsMap[userId] || {};

        // Driver check: if vehicle details exist in userData, or road tax in userDoc, user acts as a driver.
        const hasVehicleData = !!(userData.vehiclePlate || userData.vehicleModel || userDoc.road_tax_url);
        const role = hasVehicleData ? 'driver' : 'passenger';
        
        // Calculate status dynamically:
        // Passengers: always approved
        // Approved Driver: is_verified is true
        // Rejected Driver: rejection_reason is populated
        // Pending Driver: otherwise
        let status = 'pending';
        if (role === 'passenger') {
          status = 'approved';
        } else if (userData.is_verified === true || userDoc.is_verified === true) {
          status = 'approved';
        } else if (userData.rejection_reason || userDoc.rejection_reason) {
          status = 'rejected';
        }

        usersList.push({
          id: userId,
          name: userData.name || 'Anonymous User',
          email: userData.email || '',
          phone: userData.phone || '',
          role: role,
          plate: userData.vehiclePlate || '',
          model: userData.vehicleModel || '',
          color: userData.vehicleColor || '',
          status: status,
          reason: userData.rejection_reason || userDoc.rejection_reason || '',
          matricCardUrl: userDoc.matric_card_url || '',
          roadTaxUrl: userDoc.road_tax_url || '',
          expiryDate: userData.roadTaxExpiry || 'N/A'
        });
      });

      // If Firestore is completely empty, inject dummy mock data for validation/preview
      if (usersList.length === 0) {
        console.log("Firestore users collection is empty. Loading sandbox mock datasets.");
        usersDatabase = getMockData();
      } else {
        usersDatabase = usersList;
      }

      updateStatistics();
      renderTables();
    }, (err) => {
      console.error("Firestore user_documents listener failed:", err);
    });
  }, (err) => {
    console.error("Firestore users listener failed:", err);
  });
}

// Sandbox Static Data Mock generator (useful for verification when DB is empty)
function getMockData() {
  return [
    {
      id: "B032110194",
      name: "Muhammad Hazim",
      role: "driver",
      plate: "WKL 2847",
      model: "Perodua Myvi",
      color: "White",
      status: "pending",
      expiryDate: "15-05-2027",
      reason: "",
      matricCardUrl: "",
      roadTaxUrl: ""
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
      reason: "",
      matricCardUrl: "",
      roadTaxUrl: ""
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
      reason: "",
      matricCardUrl: "",
      roadTaxUrl: ""
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
      reason: "",
      matricCardUrl: "",
      roadTaxUrl: ""
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
      reason: "Road tax has expired since 05-02-2025. Please upload a valid document.",
      matricCardUrl: "",
      roadTaxUrl: ""
    }
  ];
}


// ============================================================
// SVG DOCUMENT GENERATORS (FALLBACK PREVIEWS)
// ============================================================
function drawMatricCard(id, name) {
  return `
    <svg width="340" height="210" viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f1f5f9;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="340" height="210" rx="12" fill="url(#cardGrad)" stroke="#cbd5e1" stroke-width="2"/>
      <path d="M 0 12 A 12 12 0 0 1 12 0 L 328 0 A 12 12 0 0 1 340 12 L 340 45 L 0 45 Z" fill="#0057B8"/>
      <text x="15" y="28" fill="#ffffff" font-family="'Inter', sans-serif" font-weight="bold" font-size="16">UNIVERSITI TEKNIKAL MELAKA</text>
      <rect x="20" y="60" width="90" height="110" rx="6" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
      <circle cx="65" cy="100" r="22" fill="#94a3b8"/>
      <path d="M 35 148 C 35 125, 95 125, 95 148 Z" fill="#94a3b8"/>
      <text x="125" y="80" fill="#0057B8" font-family="'Inter', sans-serif" font-weight="800" font-size="10" letter-spacing="0.5">STUDENT MATRIC CARD</text>
      <text x="125" y="105" fill="#64748b" font-family="'Inter', sans-serif" font-weight="bold" font-size="9">NAME</text>
      <text x="125" y="122" fill="#0f172a" font-family="'Inter', sans-serif" font-weight="700" font-size="12">${name.toUpperCase()}</text>
      <text x="125" y="148" fill="#64748b" font-family="'Inter', sans-serif" font-weight="bold" font-size="9">MATRIC ID</text>
      <text x="125" y="165" fill="#0f172a" font-family="'Inter', sans-serif" font-weight="bold" font-size="14">${id}</text>
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
      <rect width="340" height="210" rx="8" fill="url(#roadTaxGrad)" stroke="#1e3a8a" stroke-width="4" stroke-dasharray="10 5"/>
      <rect x="8" y="8" width="324" height="194" rx="4" fill="none" stroke="#1e3a8a" stroke-width="1.5"/>
      <circle cx="170" cy="105" r="50" fill="#3b82f6" fill-opacity="0.08" stroke="#3b82f6" stroke-width="2" stroke-opacity="0.12"/>
      <text x="170" y="32" fill="#1e3a8a" font-family="'Inter', sans-serif" font-weight="800" font-size="12" text-anchor="middle">JABATAN PENGANGKUTAN JALAN MALAYSIA</text>
      <text x="170" y="46" fill="#1e3a8a" font-family="'Inter', sans-serif" font-weight="bold" font-size="8" text-anchor="middle">LESEN KENDERAAN MOTOR (ROAD TAX)</text>
      <rect x="25" y="65" width="290" height="35" rx="6" fill="#1e3a8a"/>
      <text x="170" y="89" fill="#ffffff" font-family="'Inter', sans-serif" font-weight="900" font-size="20" text-anchor="middle" letter-spacing="2">${plate}</text>
      <text x="35" y="125" fill="#1e40af" font-family="'Inter', sans-serif" font-weight="bold" font-size="8">VEHICLE MODEL</text>
      <text x="35" y="140" fill="#0f172a" font-family="'Inter', sans-serif" font-weight="700" font-size="11">${model}</text>
      <text x="185" y="125" fill="#1e40af" font-family="'Inter', sans-serif" font-weight="bold" font-size="8">VALID UNTIL</text>
      <text x="185" y="140" fill="#ef4444" font-family="'Inter', sans-serif" font-weight="800" font-size="11">${expiryDate}</text>
      <text x="35" y="172" fill="#64748b" font-family="'Inter', sans-serif" font-weight="600" font-size="7">RECEIPT NO: JPJ-MY-8492027581</text>
      <text x="35" y="184" fill="#64748b" font-family="'Inter', sans-serif" font-weight="600" font-size="7">FEE PAID: RM 90.00 (M-COMMERCE)</text>
      <rect x="275" y="150" width="30" height="38" fill="#a855f7" rx="3" fill-opacity="0.8"/>
      <circle cx="290" cy="169" r="10" fill="#f43f5e" fill-opacity="0.8"/>
    </svg>
  `;
}


// ============================================================
// DASHBOARD RENDERING & STATISTICAL UPDATES
// ============================================================

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
            ${user.role === 'driver' ? `
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


// ============================================================
// MODAL INTERACTIONS & ACTIONS
// ============================================================

// Direct Approval from list view
window.approveDirect = function(userId) {
  const user = usersDatabase.find(u => u.id === userId);
  if (!user) return;

  // Confirm popup for admin sanity
  if (!confirm(`Are you sure you want to approve driver documents for ${user.name} (${user.id})?`)) return;

  db.collection('users').doc(userId).update({
    is_verified: true,
    rejection_reason: firebase.firestore.FieldValue.delete(),
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    return db.collection('user_documents').doc(userId).update({
      is_verified: true,
      verified_at: firebase.firestore.FieldValue.serverTimestamp(),
      rejection_reason: firebase.firestore.FieldValue.delete()
    });
  }).catch((error) => {
    console.error("Firestore approval update error:", error);
    alert("Failed to update database: " + error.message);
  });
};

// Open side-by-side verification details inspector
window.openInspectionModal = function(userId) {
  const user = usersDatabase.find(u => u.id === userId);
  if (!user) return;

  currentSelectedUserId = userId;

  // Render text content
  document.getElementById('modal-user-name').innerText = `Verify Documents - ${user.name}`;
  document.getElementById('modal-user-matric').innerText = `Matric / Staff ID: ${user.id}`;
  
  document.getElementById('ocr-val-name').value = user.name;
  document.getElementById('ocr-val-id').value = user.id;

  // Show uploaded image if exists, else fallback to mock SVG
  const matricContainer = document.getElementById('matric-image-container');
  if (user.matricCardUrl) {
    matricContainer.innerHTML = `<img src="${user.matricCardUrl}" alt="Matric Card" style="max-width:100%; max-height:220px; border-radius:var(--radius-sm); object-fit:contain;">`;
  } else {
    matricContainer.innerHTML = drawMatricCard(user.id, user.name);
  }

  // Toggle Road Tax section based on role and details
  const roadTaxGroup = document.getElementById('roadtax-preview-group');
  const ocrVehicleDetails = document.getElementById('ocr-vehicle-details');
  const modalApproveBtn = document.getElementById('modal-approve-btn');
  const modalDeclineBtn = document.getElementById('modal-decline-btn');

  // Passenger has no approve/reject buttons. Drivers should have them regardless of status.
  if (user.role === 'passenger') {
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
    
    const roadtaxContainer = document.getElementById('roadtax-image-container');
    if (user.roadTaxUrl) {
      roadtaxContainer.innerHTML = `<img src="${user.roadTaxUrl}" alt="Road Tax / VOC" style="max-width:100%; max-height:220px; border-radius:var(--radius-sm); object-fit:contain;">`;
    } else {
      roadtaxContainer.innerHTML = drawRoadTax(
        user.plate || 'N/A', 
        user.model || 'N/A', 
        user.expiryDate || 'N/A'
      );
    }
  } else {
    roadTaxGroup.style.display = 'none';
    ocrVehicleDetails.style.display = 'none';
  }

  // Display modal overlay
  document.getElementById('view-modal').style.display = 'flex';
};

// Close View Modal
document.getElementById('close-view-modal').addEventListener('click', () => {
  document.getElementById('view-modal').style.display = 'none';
  currentSelectedUserId = null;
});

// Modal approve event click
document.getElementById('modal-approve-btn').addEventListener('click', () => {
  if (currentSelectedUserId) {
    approveDirect(currentSelectedUserId);
    document.getElementById('view-modal').style.display = 'none';
    currentSelectedUserId = null;
  }
});

// Modal decline event click
document.getElementById('modal-decline-btn').addEventListener('click', () => {
  if (currentSelectedUserId) {
    openRejectReasonModal(currentSelectedUserId);
  }
});

// Open Reject Reason Overlay Modal
window.openRejectReasonModal = function(userId) {
  currentSelectedUserId = userId;
  document.getElementById('reject-reason-text').value = '';
  document.getElementById('reject-modal').style.display = 'flex';
};

// Close Reject Reason Modal
document.getElementById('close-reject-modal').addEventListener('click', () => {
  document.getElementById('reject-modal').style.display = 'none';
});
document.getElementById('cancel-reject-btn').addEventListener('click', () => {
  document.getElementById('reject-modal').style.display = 'none';
});

// Confirm rejection and write to database with reason
document.getElementById('confirm-reject-btn').addEventListener('click', () => {
  const reason = document.getElementById('reject-reason-text').value.trim();
  if (!reason) {
    alert('Please enter a reason for rejecting the documents.');
    return;
  }

  const user = usersDatabase.find(u => u.id === currentSelectedUserId);
  if (!user) return;

  db.collection('users').doc(currentSelectedUserId).update({
    is_verified: false,
    rejection_reason: reason,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    return db.collection('user_documents').doc(currentSelectedUserId).update({
      is_verified: false,
      rejection_reason: reason,
      rejected_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  }).then(() => {
    document.getElementById('reject-modal').style.display = 'none';
    document.getElementById('view-modal').style.display = 'none';
    currentSelectedUserId = null;
  }).catch((error) => {
    console.error("Firestore rejection update error:", error);
    alert("Failed to reject document in database: " + error.message);
  });
});


// ============================================================
// FILTERS & TAB HANDLERS
// ============================================================
document.getElementById('search-bar').addEventListener('input', renderTables);
document.getElementById('role-filter').addEventListener('change', renderTables);
document.getElementById('status-filter').addEventListener('change', renderTables);

document.getElementById('view-all-backlog').addEventListener('click', () => {
  const tab = document.querySelector('.menu-item[data-tab="verifications"]');
  tab.click();
  document.getElementById('status-filter').value = 'pending';
  renderTables();
});

// Tab Routing Menu items
const menuItems = document.querySelectorAll('.menu-item');
menuItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    menuItems.forEach(mi => mi.classList.remove('active'));
    item.classList.add('active');

    const tabName = item.getAttribute('data-tab');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`${tabName}-section`).classList.add('active');
    if (tabName === 'analytics') {
      setTimeout(() => refreshAnalyticsChartsTheme(), 50);
    }
  });
});

// Theme Mode toggler logic
const themeToggleBtn = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('admin-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggleBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('admin-theme', newTheme);
  refreshAnalyticsChartsTheme();
});

// Initial Setup
// Default status-filter selection is All Statuses ('all')
document.getElementById('status-filter').value = 'all';
updateStatistics();
renderTables();
