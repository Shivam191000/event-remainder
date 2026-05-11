// =============================================
//   EVENT REMINDER SYSTEM — API-POWERED APP
// =============================================

const API_BASE = '/api';

// ---- API Helper ----
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('er_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // Token expired or invalid
  if (res.status === 401) {
    localStorage.removeItem('er_token');
    localStorage.removeItem('er_user');
    window.location.href = 'login.html';
    return null;
  }

  return res.json();
}

// ---- Auth Guard ----
const currentUser = JSON.parse(localStorage.getItem('er_user') || 'null');
const er_token = localStorage.getItem('er_token');
if (!currentUser || !er_token) {
  window.location.href = 'login.html';
}

// ---- State ----
let events = [];
let currentFilter = 'all';
let currentCat = 'all';
let currentView = 'grid';
let currentSort = 'date';
let pendingDeleteId = null;
let selectedPriority = 'normal';

const SORT_CYCLE = ['date', 'priority', 'title', 'status'];
const SORT_LABELS = { date: '📅 Date', priority: '🔴 Priority', title: '🔤 Title', status: '✅ Status' };
const CAT_ICONS = { general: '📌', work: '💼', personal: '🏠', health: '🏥', social: '🎉', education: '📚' };
const PRIORITY_CONFIG = {
  normal: { label: 'Normal', icon: '🔵', cls: 'normal' },
  important: { label: 'Important', icon: '🔴', cls: 'important' },
  urgent: { label: 'Urgent', icon: '⚡', cls: 'urgent' },
};

// ---- DOM References ----
const form = document.getElementById('add-event-form');
const titleInput = document.getElementById('event-title');
const descInput = document.getElementById('event-desc');
const dateInput = document.getElementById('event-date');
const catSelect = document.getElementById('event-category');
const eventsGrid = document.getElementById('events-grid');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const sectionTitle = document.getElementById('section-title');
const eventsCount = document.getElementById('events-count');
const totalCount = document.getElementById('total-count');
const pendingCount = document.getElementById('pending-count');
const doneCount = document.getElementById('done-count');
const importantCount = document.getElementById('important-count');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toast-msg');
const toastIcon = document.getElementById('toast-icon');
const modalOverlay = document.getElementById('modal-overlay');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');
const modalEventName = document.getElementById('modal-event-name');
const detailOverlay = document.getElementById('detail-overlay');
const detailContent = document.getElementById('detail-content');
const filterBtns = document.querySelectorAll('.filter-btn');
const catBtns = document.querySelectorAll('.cat-btn');
const importantBanner = document.getElementById('important-banner');
const bannerEvents = document.getElementById('banner-events');
const userPill = document.getElementById('user-pill');

// ---- Init User UI ----
function initUser() {
  if (!currentUser) return;
  const initial = currentUser.name ? currentUser.name[0].toUpperCase() : '?';
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('user-name').textContent = currentUser.name || 'User';
  document.getElementById('dropdown-email').textContent = currentUser.email || '';
}

// ---- User Dropdown Toggle ----
userPill.addEventListener('click', (e) => {
  e.stopPropagation();
  userPill.classList.toggle('open');
});
document.addEventListener('click', () => userPill.classList.remove('open'));

// ---- Logout ----
function logout() {
  localStorage.removeItem('er_token');
  localStorage.removeItem('er_user');
  window.location.href = 'login.html';
}

// ---- Toast ----
let toastTimer = null;
function showToast(message, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toastIcon.textContent = icons[type] || '✅';
  toastMsg.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ---- Date Utilities ----
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getDateStatus(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((eventDate - today) / 86400000);
  if (diff < 0) return { cls: 'date-overdue', label: `${Math.abs(diff)}d overdue` };
  if (diff === 0) return { cls: 'date-today', label: 'Today!' };
  if (diff === 1) return { cls: 'date-upcoming', label: 'Tomorrow' };
  if (diff <= 7) return { cls: 'date-upcoming', label: `In ${diff} days` };
  return { cls: '', label: formatDate(dateStr) };
}

function isOverdue(e) {
  if (e.isCompleted) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(e.date + 'T00:00:00') < today;
}
function isToday(e) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(e.date + 'T00:00:00').getTime() === today.getTime();
}

// ---- Stats (from local events array) ----
function updateStats() {
  const total = events.length;
  const done = events.filter(e => e.isCompleted).length;
  const pending = total - done;
  const imp = events.filter(e => (e.priority === 'important' || e.priority === 'urgent') && !e.isCompleted).length;
  totalCount.textContent = total;
  pendingCount.textContent = pending;
  doneCount.textContent = done;
  importantCount.textContent = imp;
}

// ---- Important Banner ----
function updateBanner() {
  const urgent = events.filter(e => !e.isCompleted && (e.priority === 'important' || e.priority === 'urgent'));
  if (urgent.length === 0) { importantBanner.style.display = 'none'; return; }
  importantBanner.style.display = 'flex';
  bannerEvents.innerHTML = urgent.map(e => {
    return `<span class="banner-tag" onclick="openDetail('${e.id}')">${PRIORITY_CONFIG[e.priority].icon} ${escapeHtml(e.title)}</span>`;
  }).join('');
}

// ---- Sort ----
function getSortedEvents(arr) {
  return [...arr].sort((a, b) => {
    if (currentSort === 'date') return new Date(a.date) - new Date(b.date);
    if (currentSort === 'priority') {
      const order = { urgent: 0, important: 1, normal: 2 };
      return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
    }
    if (currentSort === 'title') return a.title.localeCompare(b.title);
    if (currentSort === 'status') return (a.isCompleted ? 1 : 0) - (b.isCompleted ? 1 : 0);
    return 0;
  });
}

function cycleSort() {
  const idx = SORT_CYCLE.indexOf(currentSort);
  currentSort = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
  document.getElementById('sort-label').textContent = SORT_LABELS[currentSort];
  renderEvents();
}

// ---- View Toggle ----
function setView(view) {
  currentView = view;
  eventsGrid.classList.toggle('list-view', view === 'list');
  document.getElementById('view-grid').classList.toggle('active', view === 'grid');
  document.getElementById('view-list').classList.toggle('active', view === 'list');
}

// ---- Filter ----
const FILTER_TITLES = {
  all: 'All Events', pending: 'Pending Events', completed: 'Completed Events',
  important: 'Important Events', urgent: 'Urgent Events',
  today: 'Due Today', overdue: 'Overdue Events',
};
function setFilter(filter) {
  currentFilter = filter;
  filterBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
  sectionTitle.textContent = FILTER_TITLES[filter] || 'Events';
}

filterBtns.forEach(btn => btn.addEventListener('click', () => { setFilter(btn.dataset.filter); renderEvents(); }));
catBtns.forEach(btn => btn.addEventListener('click', () => {
  currentCat = btn.dataset.cat;
  catBtns.forEach(b => b.classList.toggle('active', b.dataset.cat === currentCat));
  renderEvents();
}));
searchInput.addEventListener('input', renderEvents);

// ---- Render Events (from local array — already filtered server side on fetch) ----
function renderEvents() {
  const query = searchInput.value.trim().toLowerCase();

  let filtered = events.filter(e => {
    if (currentFilter === 'pending' && e.isCompleted) return false;
    if (currentFilter === 'completed' && !e.isCompleted) return false;
    if (currentFilter === 'important' && e.priority !== 'important') return false;
    if (currentFilter === 'urgent' && e.priority !== 'urgent') return false;
    if (currentFilter === 'today' && !isToday(e)) return false;
    if (currentFilter === 'overdue' && !isOverdue(e)) return false;
    if (currentCat !== 'all' && e.category !== currentCat) return false;
    if (query && !e.title.toLowerCase().includes(query) && !e.description.toLowerCase().includes(query)) return false;
    return true;
  });

  filtered = getSortedEvents(filtered);
  eventsGrid.innerHTML = '';
  eventsCount.textContent = `${filtered.length} event${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    emptyState.classList.add('visible');
    const icons = { completed: '🏆', overdue: '🚨', today: '📅', important: '🔴', urgent: '⚡' };
    emptyState.querySelector('.empty-icon').textContent = icons[currentFilter] || (query ? '🔍' : '📭');
    emptyState.querySelector('h3').textContent = query ? 'No matching events'
      : (FILTER_TITLES[currentFilter] ? `No ${FILTER_TITLES[currentFilter].toLowerCase()}` : 'No events yet');
    emptyState.querySelector('p').textContent = query ? 'Try a different search term.'
      : (currentFilter === 'all' ? 'Add your first event using the form!' : '');
  } else {
    emptyState.classList.remove('visible');
    filtered.forEach(event => eventsGrid.appendChild(createEventCard(event)));
  }

  updateStats();
  updateBanner();
}

// ---- Create Card ----
function createEventCard(event) {
  const card = document.createElement('div');
  const prio = event.priority || 'normal';
  card.className = `event-card priority-${prio}${event.isCompleted ? ' completed' : ''}`;
  card.dataset.id = event.id;

  const dateStatus = getDateStatus(event.date);
  const cat = event.category || 'general';
  const catIcon = CAT_ICONS[cat] || '📌';
  const prioConf = PRIORITY_CONFIG[prio];
  const overdueWarning = isOverdue(event)
    ? `<span class="status-badge" style="background:rgba(245,71,110,0.12);color:#f5476e;border-color:rgba(245,71,110,0.25);">🚨 Overdue</span>` : '';

  card.innerHTML = `
    <div class="card-body">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(event.title)}</h3>
        <div class="card-badges">
          ${prio !== 'normal' ? `<span class="status-badge ${prio}">${prioConf.icon} ${prioConf.label}</span>` : ''}
          <span class="status-badge ${event.isCompleted ? 'completed' : 'pending'}">${event.isCompleted ? '✓ Done' : '● Pending'}</span>
        </div>
      </div>
      <p class="card-desc">${escapeHtml(event.description)}</p>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:2px;">
        <div class="card-date">
          <span class="date-icon">📅</span>
          <span class="${dateStatus.cls}">${dateStatus.label}</span>
        </div>
        <span class="cat-badge">${catIcon} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
        ${overdueWarning}
      </div>
    </div>
    <div class="card-actions">
      ${event.isCompleted
      ? `<button class="action-btn complete-btn done-btn" disabled><span>✓</span> Done</button>`
      : `<button class="action-btn complete-btn" onclick="event.stopPropagation();markComplete('${event.id}')"><span>✓</span> Mark Done</button>`
    }
      <button class="action-btn" onclick="event.stopPropagation();openDetail('${event.id}')" style="color:var(--accent-2);border-color:rgba(91,138,245,0.3);">👁 View</button>
      <button class="action-btn remove-btn" onclick="event.stopPropagation();confirmRemove('${event.id}')"><span>🗑</span> Remove</button>
    </div>
  `;

  card.addEventListener('click', () => openDetail(event.id));
  return card;
}

// ---- Escape HTML ----
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

// ---- Priority Selector ----
document.querySelectorAll('.priority-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedPriority = btn.dataset.priority;
    document.querySelectorAll('.priority-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ---- Add Event ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let valid = true;
  const title = titleInput.value.trim();
  const desc = descInput.value.trim();
  const date = dateInput.value;
  const category = catSelect.value;

  document.getElementById('title-error').textContent = '';
  document.getElementById('desc-error').textContent = '';
  document.getElementById('date-error').textContent = '';

  if (!title) { document.getElementById('title-error').textContent = 'Title is required.'; titleInput.focus(); valid = false; }
  if (!desc) { document.getElementById('desc-error').textContent = 'Description is required.'; if (valid) descInput.focus(); valid = false; }
  if (!date) { document.getElementById('date-error').textContent = 'Please select a date.'; if (valid) dateInput.focus(); valid = false; }
  if (!valid) return;

  // Disable submit button
  const addBtn = document.getElementById('add-btn');
  addBtn.disabled = true;
  addBtn.textContent = 'Adding...';

  try {
    const data = await apiFetch('/events', {
      method: 'POST',
      body: JSON.stringify({ title, description: desc, date, category, priority: selectedPriority }),
    });
    if (data && data.success) {
      events.push(data.event);
      form.reset();
      setDefaultDate();
      selectedPriority = 'normal';
      document.querySelectorAll('.priority-opt').forEach(b => b.classList.remove('active'));
      document.getElementById('prio-normal').classList.add('active');
      showToast(`Event "${title}" added! 🎉`, 'success');
      setFilter('all');
      renderEvents();
    } else {
      showToast(data?.message || 'Failed to add event.', 'error');
    }
  } catch (err) {
    showToast('Network error. Please check the server.', 'error');
  } finally {
    addBtn.disabled = false;
    addBtn.innerHTML = '<span class="btn-icon">+</span> Add Event';
  }
});

// ---- Mark Complete ----
async function markComplete(id) {
  const event = events.find(e => e.id === id);
  if (!event || event.isCompleted) return;

  try {
    const data = await apiFetch(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isCompleted: true }),
    });
    if (data && data.success) {
      const idx = events.findIndex(e => e.id === id);
      if (idx !== -1) events[idx] = data.event;
      showToast(`"${data.event.title}" marked as completed! ✨`, 'success');
      renderEvents();
    } else {
      showToast(data?.message || 'Failed to update event.', 'error');
    }
  } catch (err) {
    showToast('Network error. Please check the server.', 'error');
  }
}

// ---- Remove ----
function confirmRemove(id) {
  const event = events.find(e => e.id === id);
  if (!event) return;
  pendingDeleteId = id;
  modalEventName.textContent = `"${event.title}" will be permanently deleted.`;
  modalOverlay.classList.add('open');
}

modalConfirm.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  const event = events.find(e => e.id === id);
  pendingDeleteId = null;
  modalOverlay.classList.remove('open');

  try {
    const data = await apiFetch(`/events/${id}`, { method: 'DELETE' });
    if (data && data.success) {
      events = events.filter(e => e.id !== id);
      showToast(`"${event?.title}" removed.`, 'info');
      renderEvents();
    } else {
      showToast(data?.message || 'Failed to delete event.', 'error');
    }
  } catch (err) {
    showToast('Network error. Please check the server.', 'error');
  }
});

modalCancel.addEventListener('click', () => {
  pendingDeleteId = null;
  modalOverlay.classList.remove('open');
});
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) { pendingDeleteId = null; modalOverlay.classList.remove('open'); }
});

// ---- Detail Modal ----
function openDetail(id) {
  const e = events.find(ev => ev.id === id);
  if (!e) return;
  const prio = e.priority || 'normal';
  const prioConf = PRIORITY_CONFIG[prio];
  const cat = e.category || 'general';
  const catIcon = CAT_ICONS[cat] || '📌';
  const dateStatus = getDateStatus(e.date);
  const prioColors = { normal: 'var(--accent-2)', important: 'var(--important)', urgent: 'var(--urgent)' };
  const prioBgs = { normal: 'rgba(91,138,245,0.12)', important: 'var(--important-bg)', urgent: 'var(--urgent-bg)' };

  detailContent.innerHTML = `
    <div class="detail-priority-tag" style="background:${prioBgs[prio]};color:${prioColors[prio]};border:1px solid ${prioColors[prio]}33;">
      ${prioConf.icon} ${prioConf.label} Priority
    </div>
    <div class="detail-title">${escapeHtml(e.title)}</div>
    <div class="detail-meta">
      <span class="status-badge ${e.isCompleted ? 'completed' : 'pending'}">${e.isCompleted ? '✓ Done' : '● Pending'}</span>
      <span class="cat-badge">${catIcon} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
      <span class="card-date"><span class="date-icon">📅</span><span class="${dateStatus.cls}">${dateStatus.label}</span></span>
      ${isOverdue(e) ? `<span class="status-badge" style="background:rgba(245,71,110,0.12);color:#f5476e;border-color:rgba(245,71,110,0.25);">🚨 Overdue</span>` : ''}
    </div>
    <p class="detail-desc">${escapeHtml(e.description)}</p>
    <div class="detail-actions">
      ${!e.isCompleted ? `<button class="btn btn-primary" onclick="markComplete('${id}');closeDetail()"><span>✓</span> Mark Done</button>` : ''}
      <button class="btn btn-ghost" onclick="closeDetail()">Close</button>
      <button class="btn btn-danger" onclick="closeDetail();confirmRemove('${id}')">🗑 Remove</button>
    </div>
  `;
  detailOverlay.classList.add('open');
}

function closeDetail() { detailOverlay.classList.remove('open'); }
detailOverlay.addEventListener('click', (e) => { if (e.target === detailOverlay) closeDetail(); });

// ---- Keyboard Shortcuts ----
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { modalOverlay.classList.remove('open'); closeDetail(); pendingDeleteId = null; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchInput.focus(); }
});

// ---- Default date ----
function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
}

// ---- Seed Sample Events for Demo Account ----
async function seedSampleEventsIfNeeded() {
  if (events.length > 0) return;
  if (currentUser?.email !== 'demo@eventreminder.app') return;

  const today = new Date();
  const fmt = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const in3 = new Date(today); in3.setDate(today.getDate() + 3);

  const samples = [
    { title: 'Team Stand-up Meeting', description: 'Daily sync with the engineering team.', date: fmt(today), category: 'work', priority: 'normal' },
    { title: 'Project Deadline 🚨', description: 'Submit the final project report before EOD.', date: fmt(tomorrow), category: 'work', priority: 'urgent' },
    { title: 'Doctor Appointment', description: 'Annual health checkup. Bring insurance card.', date: fmt(nextWeek), category: 'health', priority: 'important' },
    { title: 'Birthday Party 🎉', description: "Sarah's surprise party at The Grand Venue.", date: fmt(in3), category: 'social', priority: 'important' },
  ];

  for (const s of samples) {
    const data = await apiFetch('/events', { method: 'POST', body: JSON.stringify(s) });
    if (data && data.success) events.push(data.event);
  }
  // Mark the 3rd as completed to show the "Done" state
  const review = await apiFetch('/events', {
    method: 'POST', body: JSON.stringify({
      title: 'Code Review Session', description: 'Review pull requests for the new auth module.',
      date: fmt(yesterday), category: 'work', priority: 'normal'
    })
  });
  if (review && review.success) {
    const done = await apiFetch(`/events/${review.event.id}`, { method: 'PUT', body: JSON.stringify({ isCompleted: true }) });
    if (done && done.success) events.push(done.event);
  }
}

// ---- Show loading overlay while fetching ----
function showPageLoader() {
  emptyState.classList.remove('visible');
  eventsGrid.innerHTML = `
    <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem;gap:1rem;color:var(--text-muted);">
      <div style="width:40px;height:40px;border:3px solid rgba(124,110,245,0.2);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <span>Loading your events...</span>
    </div>
  `;
}

// ---- Init ----
async function init() {
  initUser();
  setDefaultDate();
  showPageLoader();

  try {
    const data = await apiFetch('/events');
    if (data && data.success) {
      events = data.events;
      await seedSampleEventsIfNeeded();
      renderEvents();
    } else {
      showToast('Failed to load events from server.', 'error');
      renderEvents();
    }
  } catch (err) {
    showToast('Cannot connect to server. Please restart the backend.', 'error');
    eventsGrid.innerHTML = '';
    emptyState.classList.add('visible');
    emptyState.querySelector('.empty-icon').textContent = '🔌';
    emptyState.querySelector('h3').textContent = 'Server not reachable';
    emptyState.querySelector('p').textContent = 'Run: cd backend && node server.js';
  }
}

init();
