/* Reinigungsplaner - Manager-Dashboard (PWA) */
const MSTORE = { staff: "mgr_staff_v1", rooms: "mgr_rooms_v1", assignments: "mgr_assignments_v1", settings: "mgr_settings_v1" };
const STATUS_CONFIG = {
  blue: { short: "Blau", cssClass: "status-blue", color: "#2563eb" },
  red: { short: "Rot", cssClass: "status-red", color: "#dc2626" },
  yellow: { short: "Gelb", cssClass: "status-yellow", color: "#ca8a04" }
};
const STATUS_ORDER = ["blue", "red", "yellow"];
let state = { currentDate: todayStr(), activeTab: "staff", editingStaffId: null, editingRoomId: null, groupBy: "employee" };

function loadAll(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
function saveAll(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function getStaff() { return loadAll(MSTORE.staff, []); }
function setStaff(s) { saveAll(MSTORE.staff, s); }
function getRoomsAll() { return loadAll(MSTORE.rooms, []); }
function setRoomsAll(r) { saveAll(MSTORE.rooms, r); }
function getAssignmentsAll() { return loadAll(MSTORE.assignments, []); }
function setAssignmentsAll(a) { saveAll(MSTORE.assignments, a); }
function getSettings() { return loadAll(MSTORE.settings, { webhookUrl: "" }); }
function setSettings(s) { saveAll(MSTORE.settings, s); }

function todayStr() { const d = new Date(); return formatDateKey(d); }
function formatDateKey(d) { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }
function parseDateKey(key) { const [y,m,d] = key.split("-").map(Number); return new Date(y, m-1, d); }
function shiftDate(key, days) { const d = parseDateKey(key); d.setDate(d.getDate()+days); return formatDateKey(d); }
function formatDateLabel(key) {
  const d = parseDateKey(key); const opts = { weekday:"short", day:"2-digit", month:"2-digit", year:"numeric" };
  let label = d.toLocaleDateString("de-DE", opts); if (key === todayStr()) label = "Heute · " + label; return label;
}
function uuid() { return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2,9); }
function dayOfYear(dateKey) { const d = parseDateKey(dateKey); const start = new Date(d.getFullYear(),0,0); return Math.floor((d-start)/86400000); }

let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById("toast"); if (!toast) return;
  toast.textContent = msg; toast.classList.remove("hidden");
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.add("hidden"), 2500);
}

function distributeRooms(rooms, employeeIds, rotateSeed) {
  const n = employeeIds.length;
  const assignment = {}; employeeIds.forEach(id => assignment[id] = []);
  if (n === 0) return assignment;
  const activeRooms = rooms.filter(r => !r.dnd);
  const sortedRooms = [...activeRooms].sort((a,b) => a.floor !== b.floor ? a.floor-b.floor : a.number.localeCompare(b.number,"de",{numeric:true}));
  const total = sortedRooms.length; const base = Math.floor(total/n); const rem = total % n;
  const order = employeeIds.map((_,i) => employeeIds[(i+rotateSeed)%n]);
  let idx = 0;
  order.forEach((empId,i) => { const count = base + (i<rem?1:0); assignment[empId] = sortedRooms.slice(idx, idx+count); idx += count; });
  return assignment;
}

function renderHeader() { document.getElementById("currentDateLabel").textContent = formatDateLabel(state.currentDate); }

function renderStaffTab() {
  const staff = getStaff();
  const rows = staff.map(s => `
    <div class="list-item" data-id="${s.id}">
      <div><div class="name">${s.name} ${s.active ? "" : '<span class="badge">Pausiert</span>'}</div>
      <div class="sub">${s.email || "Keine E-Mail hinterlegt"}</div></div>
      <button class="btn small secondary" data-action="edit-staff">✏️</button>
    </div>`).join("");
  return `<div class="card"><div class="card-header"><h3>Mitarbeiter (Wochenliste)</h3></div>
    <p class="muted">Tragen Sie hier alle Mitarbeiter ein. Mit "Pausiert" markieren Sie jemanden, der diese Woche nicht arbeitet.</p>
    ${staff.length === 0 ? '<p class="muted">Noch keine Mitarbeiter eingetragen.</p>' : rows}</div>
    <button id="btnAddStaff" class="fab">+</button>`;
}

function openStaffModal(id) {
  state.editingStaffId = id || null;
  const delBtn = document.getElementById("btnDeleteStaff");
  if (id) {
    const s = getStaff().find(x => x.id === id); if (!s) return;
    document.getElementById("staffModalTitle").textContent = `${s.name} bearbeiten`;
    document.getElementById("inputStaffName").value = s.name;
    document.getElementById("inputStaffEmail").value = s.email || "";
    document.getElementById("inputStaffActive").checked = s.active;
    delBtn.classList.remove("hidden");
  } else {
    document.getElementById("staffModalTitle").textContent = "Mitarbeiter hinzufügen";
    document.getElementById("inputStaffName").value = "";
    document.getElementById("inputStaffEmail").value = "";
    document.getElementById("inputStaffActive").checked = true;
    delBtn.classList.add("hidden");
  }
  document.getElementById("staffModal").classList.remove("hidden");
}
function closeStaffModal() { document.getElementById("staffModal").classList.add("hidden"); state.editingStaffId = null; }
function saveStaffFromModal() {
  const name = document.getElementById("inputStaffName").value.trim();
  const email = document.getElementById("inputStaffEmail").value.trim();
  const active = document.getElementById("inputStaffActive").checked;
  if (!name) { showToast("Bitte einen Namen eingeben."); return; }
  const staff = getStaff();
  if (state.editingStaffId) { const s = staff.find(x => x.id === state.editingStaffId); s.name=name; s.email=email; s.active=active; }
  else staff.push({ id: uuid(), name, email, active });
  setStaff(staff); closeStaffModal(); renderTab(); showToast("Mitarbeiter gespeichert.");
}
function deleteStaffFromModal() {
  if (!state.editingStaffId) return;
  setStaff(getStaff().filter(s => s.id !== state.editingStaffId));
  closeStaffModal(); renderTab(); showToast("Mitarbeiter gelöscht.");
}

function getRoomsForDate(dateKey) { return getRoomsAll().filter(r => r.date === dateKey); }
function roomNumberExistsOnDate(number, dateKey, excludeId) { return getRoomsAll().some(r => r.date===dateKey && r.number===number && r.id!==excludeId); }
function sortRoomsList(rooms) {
  return [...rooms].sort((a,b) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    const oa = STATUS_ORDER.indexOf(a.color), ob = STATUS_ORDER.indexOf(b.color);
    if (oa !== ob) return oa - ob;
    return a.number.localeCompare(b.number, "de", { numeric: true });
  });
}
function renderRoomsTab() {
  const rooms = sortRoomsList(getRoomsForDate(state.currentDate));
  const rows = rooms.map(r => `
    <div class="room-item ${STATUS_CONFIG[r.color].cssClass} ${r.dnd ? "room-dnd" : ""}" data-id="${r.id}">
      <div><span class="room-num">${r.number}</span>
      <span class="room-meta">Etage ${r.floor} · ${STATUS_CONFIG[r.color].short}${r.isSuite ? " · Suite":""}${r.ww ? " · WW":""}${r.dnd ? ' · <span class="badge dnd">Nicht stören</span>':""}</span></div>
      <button class="btn small secondary" data-action="edit-room">✏️</button>
    </div>`).join("");
  const dndCount = rooms.filter(r => r.dnd).length;
  return `<div class="card"><div class="card-header"><h3>Zimmerliste – ${formatDateLabel(state.currentDate)}</h3><span class="muted">${rooms.length} Zimmer</span></div>
    <p class="muted">Tragen Sie hier die Zimmerliste ein, die das Hotel Ihnen für diesen Tag gegeben hat.</p>
    ${dndCount>0 ? `<p class="muted">🔴 ${dndCount} Zimmer mit Bitte-nicht-stören - werden nicht verteilt und nicht mitgezählt.</p>` : ""}
    ${rooms.length===0 ? '<p class="muted">Noch keine Zimmer für diesen Tag.</p>' : rows}</div>
    <button id="btnAddRoom" class="fab">+</button>`;
}

function updateDndRowVisibility() {
  const status = document.getElementById("inputStatus").value;
  const dndRow = document.getElementById("dndRow");
  if (status === "yellow") dndRow.classList.remove("hidden");
  else { dndRow.classList.add("hidden"); document.getElementById("inputDnd").checked = false; }
}

function openRoomModal(id) {
  state.editingRoomId = id || null;
  const delBtn = document.getElementById("btnDeleteRoom");
  if (id) {
    const r = getRoomsAll().find(x => x.id === id); if (!r) return;
    document.getElementById("roomModalTitle").textContent = `Zimmer ${r.number} bearbeiten`;
    document.getElementById("inputRoomNumber").value = r.number;
    document.getElementById("inputRoomFloor").value = r.floor;
    document.getElementById("inputStatus").value = r.color;
    document.getElementById("inputWW").checked = r.ww;
    document.getElementById("inputIsSuite").checked = r.isSuite;
    document.getElementById("inputDnd").checked = !!r.dnd;
    delBtn.classList.remove("hidden");
  } else {
    document.getElementById("roomModalTitle").textContent = "Zimmer hinzufügen";
    document.getElementById("inputRoomNumber").value = "";
    document.getElementById("inputRoomFloor").value = "";
    document.getElementById("inputStatus").value = "blue";
    document.getElementById("inputWW").checked = false;
    document.getElementById("inputIsSuite").checked = false;
    document.getElementById("inputDnd").checked = false;
    delBtn.classList.add("hidden");
  }
  updateDndRowVisibility();
  document.getElementById("roomModal").classList.remove("hidden");
}
function closeRoomModal() { document.getElementById("roomModal").classList.add("hidden"); state.editingRoomId = null; }
function saveRoomFromModal() {
  const number = document.getElementById("inputRoomNumber").value.trim();
  const floor = parseInt(document.getElementById("inputRoomFloor").value, 10);
  const color = document.getElementById("inputStatus").value;
  const ww = document.getElementById("inputWW").checked;
  const isSuite = document.getElementById("inputIsSuite").checked;
  const dnd = color === "yellow" ? document.getElementById("inputDnd").checked : false;
  if (!number) { showToast("Bitte eine Zimmernummer eingeben."); return; }
  if (isNaN(floor)) { showToast("Bitte eine Etage eingeben."); return; }
  if (roomNumberExistsOnDate(number, state.currentDate, state.editingRoomId)) { showToast(`Zimmer ${number} ist bereits eingetragen.`); return; }
  const rooms = getRoomsAll();
  if (state.editingRoomId) {
    const r = rooms.find(x => x.id === state.editingRoomId);
    r.number=number; r.floor=floor; r.color=color; r.ww=ww; r.isSuite=isSuite; r.dnd=dnd;
  } else rooms.push({ id: uuid(), number, floor, color, ww, isSuite, dnd, date: state.currentDate });
  setRoomsAll(rooms); closeRoomModal(); renderTab(); showToast("Zimmer gespeichert.");
  pushDndListForDate(state.currentDate);
}
function deleteRoomFromModal() {
  if (!state.editingRoomId) return;
  setRoomsAll(getRoomsAll().filter(r => r.id !== state.editingRoomId));
  closeRoomModal(); renderTab(); showToast("Zimmer gelöscht.");
  pushDndListForDate(state.currentDate);
}

function pushDndListForDate(dateKey) {
  const settings = getSettings(); if (!settings.webhookUrl) return;
  const dndNumbers = getRoomsForDate(dateKey).filter(r => r.dnd).map(r => r.number);
  fetch(settings.webhookUrl, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body: JSON.stringify({ type:"dndUpdate", date:dateKey, roomNumbers:dndNumbers }) }).catch(()=>{});
}

function getAssignmentForDate(dateKey) { return getAssignmentsAll().find(a => a.date===dateKey) || null; }
function saveAssignmentForDate(dateKey, assignmentMap, rotateSeed) {
  const all = getAssignmentsAll().filter(a => a.date !== dateKey);
  all.push({ date: dateKey, assignment: assignmentMap, rotateSeed, sentAt: null });
  setAssignmentsAll(all);
}

function renderDistributeTab() {
  const staff = getStaff();
  const allRooms = getRoomsForDate(state.currentDate);
  const activeRoomsCount = allRooms.filter(r => !r.dnd).length;
  const dndCount = allRooms.filter(r => r.dnd).length;
  const existing = getAssignmentForDate(state.currentDate);
  const staffCheckboxes = staff.map(s => `<label class="checkbox-label" style="margin-bottom:8px;">
    <input type="checkbox" class="present-checkbox" data-id="${s.id}" ${s.active ? "checked":""}>${s.name}</label>`).join("");
  let resultHtml = "";
  if (existing) {
    resultHtml = Object.keys(existing.assignment).map(empId => {
      const emp = staff.find(s => s.id === empId);
      const empRooms = existing.assignment[empId];
      const chips = empRooms.map(r => `<span class="room-chip" style="background:${STATUS_CONFIG[r.color].color}22;color:${STATUS_CONFIG[r.color].color};">${r.number}</span>`).join("");
      const floorsTouched = [...new Set(empRooms.map(r => r.floor))].sort((a,b)=>a-b);
      const colorCounts = {}; empRooms.forEach(r => colorCounts[r.color]=(colorCounts[r.color]||0)+1);
      const summary = STATUS_ORDER.map(c => `${STATUS_CONFIG[c].short}: ${colorCounts[c]||0}`).join(" · ");
      return `<div class="employee-assign-card"><h4>${emp?emp.name:"Unbekannt"} — ${empRooms.length} Zimmer</h4>
        <div class="muted" style="margin-bottom:2px;">Etagen: ${floorsTouched.join(", ")}</div>
        <div class="muted" style="margin-bottom:6px;">${summary}</div><div>${chips}</div></div>`;
    }).join("");
  }
  return `<div class="card"><div class="card-header"><h3>Wer arbeitet heute?</h3></div>
    ${staff.length===0 ? '<p class="muted">Zuerst Mitarbeiter im Tab "Mitarbeiter" eintragen.</p>' : staffCheckboxes}</div>
    <div class="card"><div class="card-header"><h3>Verteilung</h3><span class="muted">${activeRoomsCount} zu verteilen${dndCount>0?" · "+dndCount+" ausgeschlossen":""}</span></div>
    <button id="btnDistribute" class="btn primary full">Zimmer gerecht verteilen</button>
    ${existing ? `<button id="btnSendAssignments" class="btn secondary full">An Google Drive senden${existing.sentAt?" (erneut)":""}</button>` : ""}
    ${existing && existing.sentAt ? `<div class="muted" style="margin-top:4px;">Zuletzt gesendet: ${new Date(existing.sentAt).toLocaleString("de-DE")}</div>` : ""}</div>
    ${resultHtml ? `<div class="card"><div class="card-header"><h3>Ergebnis</h3></div>${resultHtml}</div>` : ""}`;
}

function handleDistributeClick() {
  const presentIds = Array.from(document.querySelectorAll(".present-checkbox")).filter(cb => cb.checked).map(cb => cb.dataset.id);
  if (presentIds.length === 0) { showToast("Bitte mindestens einen Mitarbeiter auswählen."); return; }
  const rooms = getRoomsForDate(state.currentDate);
  const activeRooms = rooms.filter(r => !r.dnd);
  if (activeRooms.length === 0) { showToast("Bitte zuerst die Zimmerliste für diesen Tag eintragen."); return; }
  const rotateSeed = dayOfYear(state.currentDate) % presentIds.length;
  const assignment = distributeRooms(rooms, presentIds, rotateSeed);
  saveAssignmentForDate(state.currentDate, assignment, rotateSeed);
  renderTab(); showToast("Zimmer wurden verteilt.");
}

function handleSendAssignments() {
  const settings = getSettings();
  if (!settings.webhookUrl) { showToast("Bitte zuerst die Webhook-URL in den Einstellungen eintragen."); return; }
  const existing = getAssignmentForDate(state.currentDate);
  if (!existing) { showToast("Bitte zuerst verteilen."); return; }
  const staff = getStaff();
  const sendPromises = Object.keys(existing.assignment).map(empId => {
    const emp = staff.find(s => s.id === empId); if (!emp) return Promise.resolve();
    const payload = { type:"assignment", date: state.currentDate, employeeName: emp.name, employeeEmail: emp.email||"", rooms: existing.assignment[empId] };
    return fetch(settings.webhookUrl, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body: JSON.stringify(payload) });
  });
  Promise.all(sendPromises).then(() => {
    existing.sentAt = Date.now();
    const all = getAssignmentsAll().filter(a => a.date !== state.currentDate);
    all.push(existing); setAssignmentsAll(all); renderTab(); showToast("Zuteilungen an Google Drive gesendet.");
  }).catch(err => showToast("Senden fehlgeschlagen: " + err.message));
}

function renderReportTab() {
  return `<div class="card"><div class="card-header"><h3>Gruppieren nach</h3></div>
    <div class="select-group">
      <button data-group="employee" class="${state.groupBy==="employee"?"active":""}">Mitarbeiter</button>
      <button data-group="floor" class="${state.groupBy==="floor"?"active":""}">Etage</button>
      <button data-group="color" class="${state.groupBy==="color"?"active":""}">Farbe</button>
    </div>
    <button id="btnRefreshReport" class="btn secondary full">Status aktualisieren</button></div>
    <div id="reportResult"><p class="muted" style="padding:0 16px;">Klicken Sie auf "Status aktualisieren", um den aktuellen Stand zu laden.</p></div>`;
}

function fetchTodayReports(callback) {
  const settings = getSettings();
  if (!settings.webhookUrl) { showToast("Bitte zuerst die Webhook-URL eintragen."); callback([]); return; }
  const url = `${settings.webhookUrl}?action=getReports&date=${encodeURIComponent(state.currentDate)}`;
  fetch(url).then(res => { if (!res.ok) throw new Error("HTTP "+res.status); return res.json(); })
    .then(data => callback(Array.isArray(data) ? data : []))
    .catch(err => { showToast("Abruf fehlgeschlagen: " + err.message); callback([]); });
}

function buildReportView(completedReports) {
  const staff = getStaff();
  const assignmentEntry = getAssignmentForDate(state.currentDate);
  const rooms = getRoomsForDate(state.currentDate).filter(r => !r.dnd);
  const completedByNumber = {}; completedReports.forEach(r => { completedByNumber[r.roomNumber] = r; });
  let items = [];
  if (assignmentEntry) {
    Object.keys(assignmentEntry.assignment).forEach(empId => {
      const emp = staff.find(s => s.id === empId);
      assignmentEntry.assignment[empId].forEach(r => {
        items.push({ number:r.number, floor:r.floor, color:r.color, employeeName: emp?emp.name:"Unbekannt", done: !!completedByNumber[r.number] });
      });
    });
  } else {
    rooms.forEach(r => items.push({ number:r.number, floor:r.floor, color:r.color, employeeName:"Nicht zugeteilt", done: !!completedByNumber[r.number] }));
  }
  let groups = {};
  items.forEach(it => {
    let key;
    if (state.groupBy === "employee") key = it.employeeName;
    else if (state.groupBy === "floor") key = "Etage " + it.floor;
    else key = STATUS_CONFIG[it.color] ? STATUS_CONFIG[it.color].short : it.color;
    if (!groups[key]) groups[key] = []; groups[key].push(it);
  });
  const totalDone = items.filter(i => i.done).length;
  const totalCount = items.length;
  const dndCount = getRoomsForDate(state.currentDate).filter(r => r.dnd).length;
  const groupHtml = Object.keys(groups).sort().map(key => {
    const list = groups[key]; const done = list.filter(i => i.done).length;
    const pct = list.length>0 ? Math.round((done/list.length)*100) : 0;
    const chips = list.map(it => `<span class="room-chip" style="background:${it.done?"#16a34a22":"#dc262622"};color:${it.done?"#16a34a":"#dc2626"};">${it.number}${it.done?" ✓":""}</span>`).join("");
    return `<div class="group-block"><div class="group-title"><span>${key}</span><span class="muted">${done}/${list.length}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><div>${chips}</div></div>`;
  }).join("");
  return `<div class="card">
    ${dndCount>0 ? `<p class="muted">🔴 ${dndCount} Zimmer mit Bitte-nicht-stören wurden aus dieser Auswertung ausgeschlossen.</p>` : ""}
    <div class="stat-grid"><div class="stat-box"><div class="stat-value">${totalDone}/${totalCount}</div><div class="stat-label">Zimmer erledigt</div></div>
    <div class="stat-box"><div class="stat-value">${totalCount-totalDone}</div><div class="stat-label">Noch offen</div></div></div>
    ${groupHtml || '<p class="muted">Keine Daten für diesen Tag.</p>'}</div>`;
}

function openSettingsModal() {
  const s = getSettings();
  document.getElementById("inputWebhook").value = s.webhookUrl || "";
  document.getElementById("webhookStatus").textContent = s.webhookUrl ? "Konfiguriert." : "Nicht konfiguriert.";
  document.getElementById("settingsModal").classList.remove("hidden");
}
function closeSettingsModal() { document.getElementById("settingsModal").classList.add("hidden"); }
function saveSettingsFromModal() {
  const webhookUrl = document.getElementById("inputWebhook").value.trim();
  setSettings({ webhookUrl }); closeSettingsModal(); showToast("Einstellungen gespeichert.");
}
function testWebhookConnection() {
  const webhookUrl = document.getElementById("inputWebhook").value.trim();
  if (!webhookUrl) { showToast("Bitte zuerst eine Webhook-URL eingeben."); return; }
  document.getElementById("webhookStatus").textContent = "Teste…";
  fetch(`${webhookUrl}?action=ping`).then(res => { if (!res.ok) throw new Error("HTTP "+res.status); return res.json(); })
    .then(() => { document.getElementById("webhookStatus").textContent = "Verbindung erfolgreich ✓"; showToast("Verbindung erfolgreich."); })
    .catch(err => { document.getElementById("webhookStatus").textContent = "Fehler: " + err.message; showToast("Verbindung fehlgeschlagen."); });
}

function renderTab() {
  const tabContent = document.getElementById("tabContent");
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === state.activeTab));
  if (state.activeTab === "staff") tabContent.innerHTML = renderStaffTab();
  else if (state.activeTab === "rooms") tabContent.innerHTML = renderRoomsTab();
  else if (state.activeTab === "distribute") tabContent.innerHTML = renderDistributeTab();
  else if (state.activeTab === "report") tabContent.innerHTML = renderReportTab();
  bindTabEvents(); renderHeader();
}

function bindTabEvents() {
  const addStaffBtn = document.getElementById("btnAddStaff");
  if (addStaffBtn) addStaffBtn.addEventListener("click", () => openStaffModal(null));
  document.querySelectorAll('[data-action="edit-staff"]').forEach(btn => btn.addEventListener("click", (e) => openStaffModal(e.target.closest(".list-item").dataset.id)));
  const addRoomBtn = document.getElementById("btnAddRoom");
  if (addRoomBtn) addRoomBtn.addEventListener("click", () => openRoomModal(null));
  document.querySelectorAll('[data-action="edit-room"]').forEach(btn => btn.addEventListener("click", (e) => openRoomModal(e.target.closest(".room-item").dataset.id)));
  const distBtn = document.getElementById("btnDistribute");
  if (distBtn) distBtn.addEventListener("click", handleDistributeClick);
  const sendBtn = document.getElementById("btnSendAssignments");
  if (sendBtn) sendBtn.addEventListener("click", handleSendAssignments);
  document.querySelectorAll("[data-group]").forEach(btn => btn.addEventListener("click", () => { state.groupBy = btn.dataset.group; renderTab(); }));
  const refreshBtn = document.getElementById("btnRefreshReport");
  if (refreshBtn) refreshBtn.addEventListener("click", () => {
    document.getElementById("reportResult").innerHTML = '<p class="muted" style="padding:0 16px;">Lade…</p>';
    fetchTodayReports((reports) => { document.getElementById("reportResult").innerHTML = buildReportView(reports); });
  });
}

function renderAll() { renderHeader(); renderTab(); }

function bindEvents() {
  document.getElementById("btnPrevDay").addEventListener("click", () => { state.currentDate = shiftDate(state.currentDate, -1); renderAll(); });
  document.getElementById("btnNextDay").addEventListener("click", () => { state.currentDate = shiftDate(state.currentDate, 1); renderAll(); });
  document.getElementById("btnToday").addEventListener("click", () => { state.currentDate = todayStr(); renderAll(); });
  document.getElementById("btnCancelStaff").addEventListener("click", closeStaffModal);
  document.getElementById("btnSaveStaff").addEventListener("click", saveStaffFromModal);
  document.getElementById("btnDeleteStaff").addEventListener("click", deleteStaffFromModal);
  document.getElementById("btnCancelRoom").addEventListener("click", closeRoomModal);
  document.getElementById("btnSaveRoom").addEventListener("click", saveRoomFromModal);
  document.getElementById("btnDeleteRoom").addEventListener("click", deleteRoomFromModal);
  document.getElementById("inputStatus").addEventListener("change", updateDndRowVisibility);
  document.getElementById("btnSettings").addEventListener("click", openSettingsModal);
  document.getElementById("btnCloseSettings").addEventListener("click", closeSettingsModal);
  document.getElementById("btnSaveSettings").addEventListener("click", saveSettingsFromModal);
  document.getElementById("btnTestWebhook").addEventListener("click", testWebhookConnection);
  document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => { state.activeTab = btn.dataset.tab; renderTab(); }));
}

function init() { bindEvents(); renderAll(); if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{}); }
document.addEventListener("DOMContentLoaded", init);
