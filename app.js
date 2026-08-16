/* ---------- Storage ---------- */
const STORAGE_KEY = 'clinicEntries';
const CLINIC_PHONE_KEY = 'clinicOwnerLabel';

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}
function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- Date helpers ---------- */
function pad(n) { return n.toString().padStart(2, '0'); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return toISODate(new Date()); }
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toISODate(dt);
}
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/* ---------- Phone helpers ---------- */
function cleanPhone(phone) {
  return (phone || '').replace(/\D/g, '');
}
function waLink(phone, message) {
  let digits = cleanPhone(phone);
  if (digits.length === 10) digits = '91' + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
function telLink(phone) {
  let digits = cleanPhone(phone);
  if (digits.length === 10) digits = '91' + digits;
  return `tel:+${digits}`;
}

/* ---------- Treatment badge ---------- */
function treatmentBadgeClass(t) {
  const map = { Skin: 'badge-skin', Hair: 'badge-hair', Dental: 'badge-dental' };
  return map[t] || 'badge-other';
}
function treatmentAccentClass(t) {
  const map = { Skin: 'accent-skin', Hair: 'accent-hair', Dental: 'accent-dental' };
  return map[t] || 'accent-other';
}

/* ---------- Location filter ---------- */
const LOCATION_FILTER_KEY = 'clinicLocationFilter';
let currentLocationFilter = localStorage.getItem(LOCATION_FILTER_KEY) || 'All';

function applyLocationFilter(entries) {
  if (currentLocationFilter === 'All') return entries;
  return entries.filter(e => e.location === currentLocationFilter);
}

document.querySelectorAll('.loc-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    currentLocationFilter = chip.getAttribute('data-location');
    localStorage.setItem(LOCATION_FILTER_KEY, currentLocationFilter);
    document.querySelectorAll('.loc-chip').forEach(c => c.classList.toggle('active', c === chip));
    if (currentLocationFilter !== 'All') {
      document.getElementById('f_location').value = currentLocationFilter;
    }
    renderToday();
    renderPatients(document.getElementById('patientSearch').value);
    renderReports();
  });
});

/* ---------- Derive latest entry per patient ---------- */
function getLatestEntriesByPatient(entries) {
  const byPhone = {};
  entries.forEach(e => {
    const key = cleanPhone(e.phone) || e.name.toLowerCase();
    const existing = byPhone[key];
    if (!existing || e.visitDate > existing.visitDate ||
        (e.visitDate === existing.visitDate && e.createdAt > existing.createdAt)) {
      byPhone[key] = e;
    }
  });
  return Object.values(byPhone);
}

/* ---------- Rendering: Today tab ---------- */
function renderToday() {
  const entries = applyLocationFilter(loadEntries());
  const latest = getLatestEntriesByPatient(entries);
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 6);

  const dueToday = latest.filter(e => e.nextVisit && e.nextVisit <= today)
    .sort((a, b) => a.nextVisit.localeCompare(b.nextVisit));
  const dueTomorrow = latest.filter(e => e.nextVisit === tomorrow)
    .sort((a, b) => a.name.localeCompare(b.name));
  const dueWeek = latest.filter(e => e.nextVisit && e.nextVisit > tomorrow && e.nextVisit <= weekEnd)
    .sort((a, b) => a.nextVisit.localeCompare(b.nextVisit));

  renderDueList('dueTodayList', dueToday, 'today');
  renderDueList('dueTomorrowList', dueTomorrow, 'tomorrow');
  renderDueList('dueWeekList', dueWeek, 'week');

  document.getElementById('dueTodayHeading').textContent = `Due Today${dueToday.length ? ` (${dueToday.length})` : ''}`;
  document.getElementById('dueTomorrowHeading').textContent = `Due Tomorrow${dueTomorrow.length ? ` (${dueTomorrow.length})` : ''}`;
  document.getElementById('dueWeekHeading').textContent = `Due This Week${dueWeek.length ? ` (${dueWeek.length})` : ''}`;
}

function renderDueList(containerId, list, variant) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state">Nothing here</div>`;
    return;
  }
  const today = todayStr();
  list.forEach(e => {
    const card = document.createElement('div');
    card.className = `patient-card ${treatmentAccentClass(e.treatment)}`;
    const overdue = variant === 'today' && e.nextVisit < today;
    let dateLabel;
    if (overdue) {
      dateLabel = `<span style="color:var(--danger);font-weight:600;">Overdue &middot; was due ${formatDisplayDate(e.nextVisit)}</span>`;
    } else if (variant === 'tomorrow') {
      dateLabel = `<span style="color:var(--warn);font-weight:600;">Tomorrow</span>`;
    } else {
      dateLabel = `Due ${formatDisplayDate(e.nextVisit)}`;
    }
    card.innerHTML = `
      <div class="card-info">
        <div class="card-name">${escapeHtml(e.name)}</div>
        <div class="card-sub">
          <span class="badge ${treatmentBadgeClass(e.treatment)}">${e.treatment}</span>
          <span class="badge badge-location">&#128205; ${e.location}</span>
          ${dateLabel}
        </div>
      </div>
      <div class="card-actions">
        <a class="call-btn" href="${telLink(e.phone)}" title="Call patient">&#128222;</a>
        <button class="wa-btn" title="Send WhatsApp reminder">&#128172;</button>
      </div>
    `;
    card.querySelector('.call-btn').addEventListener('click', (ev) => ev.stopPropagation());
    card.querySelector('.wa-btn').addEventListener('click', (ev) => {
      ev.stopPropagation();
      const msg = `Hi ${e.name}, this is a reminder from the clinic for your upcoming ${e.treatment.toLowerCase()} follow-up visit. Please let us know a convenient time. Thank you!`;
      window.open(waLink(e.phone, msg), '_blank');
    });
    card.addEventListener('click', () => openHistory(cleanPhone(e.phone) || e.name.toLowerCase()));
    container.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Add Entry form ---------- */
const form = document.getElementById('entryForm');
const nameInput = document.getElementById('f_name');
const phoneInput = document.getElementById('f_phone');
const suggestionsBox = document.getElementById('matchSuggestions');

document.getElementById('f_visitDate').value = todayStr();

nameInput.addEventListener('input', () => {
  const q = nameInput.value.trim().toLowerCase();
  suggestionsBox.innerHTML = '';
  if (q.length < 2) return;
  const entries = loadEntries();
  const latest = getLatestEntriesByPatient(entries);
  const matches = latest.filter(e => e.name.toLowerCase().includes(q)).slice(0, 5);
  matches.forEach(m => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = `${m.name} — ${m.phone}`;
    item.addEventListener('click', () => {
      nameInput.value = m.name;
      phoneInput.value = m.phone;
      document.getElementById('f_treatment').value = m.treatment;
      if (m.location) document.getElementById('f_location').value = m.location;
      suggestionsBox.innerHTML = '';
    });
    suggestionsBox.appendChild(item);
  });
});

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const entries = loadEntries();
  const entry = {
    id: uid(),
    location: document.getElementById('f_location').value,
    name: nameInput.value.trim(),
    phone: phoneInput.value.trim(),
    treatment: document.getElementById('f_treatment').value,
    visitDate: document.getElementById('f_visitDate').value,
    fee: Number(document.getElementById('f_fee').value) || 0,
    paid: document.getElementById('f_paid').checked,
    nextVisit: document.getElementById('f_nextVisit').value || '',
    notes: document.getElementById('f_notes').value.trim(),
    createdAt: Date.now()
  };
  entries.push(entry);
  saveEntries(entries);
  form.reset();
  document.getElementById('f_visitDate').value = todayStr();
  document.getElementById('f_paid').checked = true;
  if (currentLocationFilter !== 'All') {
    document.getElementById('f_location').value = currentLocationFilter;
  }
  suggestionsBox.innerHTML = '';
  showToast('Entry saved');
  renderToday();
  renderPatients();
  renderReports();
  switchTab('today');
});

function prefillAddForm(entry) {
  nameInput.value = entry.name;
  phoneInput.value = entry.phone;
  document.getElementById('f_treatment').value = entry.treatment;
  document.getElementById('f_visitDate').value = todayStr();
  document.getElementById('f_fee').value = '';
  document.getElementById('f_paid').checked = true;
  document.getElementById('f_nextVisit').value = '';
  document.getElementById('f_notes').value = '';
}

/* ---------- Patients tab ---------- */
function renderPatients(filterText) {
  const entries = applyLocationFilter(loadEntries());
  const latest = getLatestEntriesByPatient(entries)
    .sort((a, b) => a.name.localeCompare(b.name));
  const filter = (filterText || '').trim().toLowerCase();
  const filtered = filter
    ? latest.filter(e => e.name.toLowerCase().includes(filter) || cleanPhone(e.phone).includes(filter))
    : latest;

  const container = document.getElementById('patientList');
  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">No patients found</div>`;
    return;
  }
  filtered.forEach(e => {
    const card = document.createElement('div');
    card.className = `patient-card ${treatmentAccentClass(e.treatment)}`;
    card.innerHTML = `
      <div class="card-info">
        <div class="card-name">${escapeHtml(e.name)}</div>
        <div class="card-sub">
          <span class="badge ${treatmentBadgeClass(e.treatment)}">${e.treatment}</span>
          <span class="badge badge-location">&#128205; ${e.location}</span>
          Last visit ${formatDisplayDate(e.visitDate)}
        </div>
      </div>
      <div class="card-actions">
        <a class="call-btn" href="${telLink(e.phone)}" title="Call patient">&#128222;</a>
        <button class="wa-btn" title="Message on WhatsApp">&#128172;</button>
      </div>
    `;
    card.querySelector('.call-btn').addEventListener('click', (ev) => ev.stopPropagation());
    card.querySelector('.wa-btn').addEventListener('click', (ev) => {
      ev.stopPropagation();
      window.open(waLink(e.phone, `Hi ${e.name}, this is the clinic.`), '_blank');
    });
    card.addEventListener('click', () => openHistory(cleanPhone(e.phone) || e.name.toLowerCase()));
    container.appendChild(card);
  });
}

document.getElementById('patientSearch').addEventListener('input', (ev) => {
  renderPatients(ev.target.value);
});

/* ---------- History modal ---------- */
function openHistory(key) {
  const entries = loadEntries();
  const history = entries
    .filter(e => (cleanPhone(e.phone) || e.name.toLowerCase()) === key)
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt - a.createdAt);
  if (history.length === 0) return;

  const modal = document.getElementById('historyModal');
  const content = document.getElementById('historyContent');
  const patient = history[0];

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <div>
        <h2 style="margin-top:0;margin-bottom:2px;">${escapeHtml(patient.name)}</h2>
        <div class="card-sub">${escapeHtml(patient.phone)}</div>
      </div>
      <div class="card-actions">
        <a class="call-btn" href="${telLink(patient.phone)}" title="Call patient">&#128222;</a>
        <a class="wa-btn" href="${waLink(patient.phone, `Hi ${patient.name}, this is the clinic.`)}" target="_blank" title="Message on WhatsApp">&#128172;</a>
      </div>
    </div>
    <div style="margin-bottom:10px;"></div>`;

  history.forEach(e => {
    html += `
      <div class="history-entry">
        <div class="card-sub">
          <span class="badge ${treatmentBadgeClass(e.treatment)}">${e.treatment}</span>
          <span class="badge badge-location">&#128205; ${e.location}</span>
          <span class="badge ${e.paid ? 'badge-paid' : 'badge-due'}">${e.paid ? 'Paid' : 'Due'}</span>
        </div>
        <div style="margin-top:6px;font-weight:600;">${formatDisplayDate(e.visitDate)} &middot; ₹${e.fee}</div>
        ${e.nextVisit ? `<div class="card-sub">Next visit: ${formatDisplayDate(e.nextVisit)}</div>` : ''}
        ${e.notes ? `<div class="card-sub" style="margin-top:4px;">${escapeHtml(e.notes)}</div>` : ''}
        <div style="margin-top:8px;display:flex;gap:10px;">
          <button class="btn-secondary" style="width:auto;padding:6px 12px;font-size:0.8rem;margin:0;" data-toggle-paid="${e.id}">${e.paid ? 'Mark Unpaid' : 'Mark Paid'}</button>
          <button class="btn-secondary" style="width:auto;padding:6px 12px;font-size:0.8rem;margin:0;color:var(--danger);border-color:var(--danger);" data-delete="${e.id}">Delete</button>
        </div>
      </div>
    `;
  });

  content.innerHTML = html;

  content.querySelectorAll('[data-toggle-paid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-paid');
      const all = loadEntries();
      const idx = all.findIndex(x => x.id === id);
      if (idx > -1) {
        all[idx].paid = !all[idx].paid;
        saveEntries(all);
        openHistory(key);
        renderReports();
      }
    });
  });
  content.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this entry? This cannot be undone.')) return;
      const id = btn.getAttribute('data-delete');
      let all = loadEntries();
      all = all.filter(x => x.id !== id);
      saveEntries(all);
      renderToday();
      renderPatients(document.getElementById('patientSearch').value);
      renderReports();
      const remaining = all.filter(e => (cleanPhone(e.phone) || e.name.toLowerCase()) === key);
      if (remaining.length === 0) closeHistoryModal();
      else openHistory(key);
    });
  });

  modal.classList.add('show');
}
function closeHistoryModal() {
  document.getElementById('historyModal').classList.remove('show');
}
document.getElementById('closeModal').addEventListener('click', closeHistoryModal);
document.getElementById('historyModal').addEventListener('click', (ev) => {
  if (ev.target.id === 'historyModal') closeHistoryModal();
});

/* ---------- Reports tab ---------- */
let reportDate = new Date();

function renderReports() {
  const year = reportDate.getFullYear();
  const month = reportDate.getMonth();
  document.getElementById('reportMonthLabel').textContent = monthLabel(year, month);

  const entries = applyLocationFilter(loadEntries());
  const monthEntries = entries.filter(e => {
    const [y, m] = e.visitDate.split('-').map(Number);
    return y === year && (m - 1) === month;
  });

  const revenue = monthEntries.filter(e => e.paid).reduce((sum, e) => sum + e.fee, 0);
  const due = monthEntries.filter(e => !e.paid).reduce((sum, e) => sum + e.fee, 0);
  const visits = monthEntries.length;
  const uniquePatients = new Set(monthEntries.map(e => cleanPhone(e.phone) || e.name.toLowerCase())).size;

  document.getElementById('statRevenue').textContent = `₹${revenue.toLocaleString('en-IN')}`;
  document.getElementById('statDue').textContent = `₹${due.toLocaleString('en-IN')}`;
  document.getElementById('statVisits').textContent = visits;
  document.getElementById('statPatients').textContent = uniquePatients;

  const byTreatment = {};
  monthEntries.forEach(e => {
    byTreatment[e.treatment] = byTreatment[e.treatment] || { count: 0, revenue: 0 };
    byTreatment[e.treatment].count += 1;
    if (e.paid) byTreatment[e.treatment].revenue += e.fee;
  });

  const container = document.getElementById('treatmentBreakdown');
  container.innerHTML = '';
  const types = Object.keys(byTreatment);
  if (types.length === 0) {
    container.innerHTML = `<div class="empty-state">No visits this month</div>`;
  } else {
    types.forEach(t => {
      const row = document.createElement('div');
      row.className = `patient-card ${treatmentAccentClass(t)}`;
      row.innerHTML = `
        <div class="card-info">
          <div class="card-name"><span class="badge ${treatmentBadgeClass(t)}">${t}</span></div>
          <div class="card-sub">${byTreatment[t].count} visits</div>
        </div>
        <div style="font-weight:700;color:var(--primary-dark);">₹${byTreatment[t].revenue.toLocaleString('en-IN')}</div>
      `;
      container.appendChild(row);
    });
  }

  const locationBlock = document.getElementById('locationBreakdownBlock');
  if (currentLocationFilter !== 'All') {
    locationBlock.style.display = 'none';
  } else {
    locationBlock.style.display = '';
    const byLocation = {};
    monthEntries.forEach(e => {
      byLocation[e.location] = byLocation[e.location] || { count: 0, revenue: 0 };
      byLocation[e.location].count += 1;
      if (e.paid) byLocation[e.location].revenue += e.fee;
    });
    const locContainer = document.getElementById('locationBreakdown');
    locContainer.innerHTML = '';
    const locs = Object.keys(byLocation);
    if (locs.length === 0) {
      locContainer.innerHTML = `<div class="empty-state">No visits this month</div>`;
    } else {
      locs.forEach(loc => {
        const row = document.createElement('div');
        row.className = 'patient-card accent-location';
        row.innerHTML = `
          <div class="card-info">
            <div class="card-name">&#128205; ${loc}</div>
            <div class="card-sub">${byLocation[loc].count} visits</div>
          </div>
          <div style="font-weight:700;color:var(--primary-dark);">₹${byLocation[loc].revenue.toLocaleString('en-IN')}</div>
        `;
        locContainer.appendChild(row);
      });
    }
  }
}

document.getElementById('prevMonth').addEventListener('click', () => {
  reportDate.setMonth(reportDate.getMonth() - 1);
  renderReports();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  reportDate.setMonth(reportDate.getMonth() + 1);
  renderReports();
});

/* ---------- Export / Import ---------- */
document.getElementById('exportBtn').addEventListener('click', async () => {
  const data = JSON.stringify(loadEntries(), null, 2);
  const fileName = `clinic-backup-${todayStr()}.json`;
  const file = new File([data], fileName, { type: 'application/json' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'White Tooth backup',
        text: 'Save this somewhere safe, e.g. Google Drive or "Message Yourself" on WhatsApp.'
      });
      showToast('Backup ready to save');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup file downloaded');
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('Invalid file');
      if (!confirm(`Import ${imported.length} entries? This will merge with existing data.`)) return;
      const existing = loadEntries();
      const existingIds = new Set(existing.map(e => e.id));
      const merged = existing.concat(imported.filter(e => !existingIds.has(e.id)));
      saveEntries(merged);
      showToast('Backup restored');
      renderToday(); renderPatients(); renderReports();
    } catch (e) {
      alert('Could not read this backup file.');
    }
  };
  reader.readAsText(file);
  ev.target.value = '';
});

/* ---------- Tabs ---------- */
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('app').scrollTop = 0;
}

/* ---------- Prevent accidental value change from mouse-wheel scroll over number fields ---------- */
document.querySelectorAll('input[type="number"]').forEach(el => {
  el.addEventListener('wheel', () => el.blur(), { passive: true });
});
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
});

/* ---------- Header date ---------- */
document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-IN', {
  weekday: 'short', day: 'numeric', month: 'short'
});

/* ---------- Init ---------- */
switchTab('today');
document.querySelectorAll('.loc-chip').forEach(c => {
  c.classList.toggle('active', c.getAttribute('data-location') === currentLocationFilter);
});
if (currentLocationFilter !== 'All') {
  document.getElementById('f_location').value = currentLocationFilter;
}
renderToday();
renderPatients();
renderReports();

/* ---------- Service worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

/* ---------- Toast ---------- */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}
