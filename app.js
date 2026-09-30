/* Reinigungsplaner – Manager-Dashboard (PWA), Version 3
   Lokale Planung (Mitarbeiter, Zimmerliste, Verteilung) + Live-Abgleich mit den Mitarbeiter-Apps über den gemeinsamen Webhook. */
const MSTORE = { staff: "mgr_staff_v1", rooms: "mgr_rooms_v1", assignments: "mgr_assignments_v1", settings: "mgr_settings_v1" };
const STATUS_CONFIG = {
  blue:   { short: "Blau", cssClass: "status-blue", color: "#2563eb" },
  red:    { short: "Rot", cssClass: "status-red", color: "#dc2626" },
  yellow: { short: "Gelb", cssClass: "status-yellow", color: "#ca8a04" }
};
const STATUS_ORDER = ["blue", "red", "yellow"];
let state = { currentDate: todayStr(), activeTab: "staff", editingStaffId: null, editingRoomId: null, groupBy: "employee", overview: null, overviewDate: null, overviewAt: null };

/* ---------- Speicher ---------- */
function loadAll(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
function saveAll(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function getStaff() { return loadAll(MSTORE.staff, []); }
function setStaff(v) { saveAll(MSTORE.staff, v); }
function getRoomsAll() { return loadAll(MSTORE.rooms, []); }
function setRoomsAll(v) { saveAll(MSTORE.rooms, v); }
function getAssignmentsAll() { return loadAll(MSTORE.assignments, []); }
function setAssignmentsAll(v) { saveAll(MSTORE.assignments, v); }
function getSettings() { return loadAll(MSTORE.settings, { webhookUrl: "" }); }
function setSettings(v) { saveAll(MSTORE.settings, v); }

/* ---------- Hilfsfunktionen ---------- */
function todayStr() { return formatDateKey(new Date()); }
function formatDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function parseDateKey(key) { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); }
function shiftDate(key, days) { const d = parseDateKey(key); d.setDate(d.getDate() + days); return formatDateKey(d); }
function formatDateLabel(key) {
  let label = parseDateKey(key).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  if (key === todayStr()) label = "Heute · " + label;
  return label;
}
function fmtTime(ts) { return ts ? new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "–"; }
function uuid() { return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9); }
function normName(n) { return String(n || "").trim().toLowerCase().replace(/\s+/g, " "); }
function dayOfYear(dateKey) { const d = parseDateKey(dateKey); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }
function deriveFloor(number) {
  const digits = String(number).replace(/\D/g, "");
  if (digits.length >= 3) return parseInt(digits.slice(0, -2), 10);
  return digits.length ? 0 : null;
}
let toastTimeout = null;
function showToast(msg) {
  const t = document.getElementById("toast"); if (!t) return;
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => t.classList.add("hidden"), 3000);
}
function webhook() { return getSettings().webhookUrl || ""; }
function postToWebhook(payload) {
  const url = webhook(); if (!url) return Promise.reject(new Error("Keine Webhook-URL"));
  return fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
    .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res; });
}

/* ---------- Faire Verteilung ----------
   Priorität 1: möglichst wenige Etagenwechsel (jeder bekommt einen zusammenhängenden Etagenbereich).
   Priorität 2: gleiche Arbeitslast (Suiten zählen doppelt; ohne Suiten = exakt gleiche Zimmeranzahl, max. 1 Unterschied).
   „Bitte nicht stören“-Zimmer werden nie verteilt. Ein Tageswert rotiert, wer welchen Bereich bekommt. */
function roomWeight(r) { return r.isSuite ? 2 : 1; }
function distributeRooms(rooms, employeeIds, rotateSeed) {
  const n = employeeIds.length; const assignment = {};
  employeeIds.forEach(id => assignment[id] = []);
  if (n === 0) return assignment;
  const sorted = rooms.filter(r => !r.dnd).sort((a, b) => (a.floor - b.floor) || String(a.number).localeCompare(String(b.number), "de", { numeric: true }));
  const total = sorted.reduce((s, r) => s + roomWeight(r), 0);
  if (total === 0) return assignment;
  const order = employeeIds.map((_, i) => employeeIds[(i + rotateSeed) % n]);
  let prefix = 0;
  sorted.forEach(r => {
    const w = roomWeight(r); const mid = prefix + w / 2;
    const k = Math.min(n - 1, Math.floor(mid * n / total));
    assignment[order[k]].push(r); prefix += w;
  });
  return assignment;
}

/* ---------- Mitarbeiter ---------- */
function renderStaffTab() {
  const staff = getStaff();
  const rows = staff.map(s => `<div class="list-item" data-id="${s.id}"><div><div class="name">${s.name} ${s.active ? "" : '<span class="badge">Pausiert</span>'}</div>
    <div class="sub">${s.email || "Keine E-Mail hinterlegt"}</div></div><button class="btn small secondary" data-action="edit-staff">✏️</button></div>`).join("");
  return `<div class="card"><div class="card-header"><h3>Mitarbeiter (Wochenliste)</h3></div>
    <p class="muted">Der Name muss exakt dem Namen in den Einstellungen der Mitarbeiter-App entsprechen – nur so kommt die Zuteilung beim richtigen Mitarbeiter an. „Pausiert“ = diese Woche nicht im Dienst.</p>
    ${staff.length === 0 ? '<p class="muted">Noch keine Mitarbeiter eingetragen.</p>' : rows}</div><button id="btnAddStaff" class="fab">+</button>`;
}
function openStaffModal(id) {
  state.editingStaffId = id || null; const del = document.getElementById("btnDeleteStaff");
  if (id) {
    const s = getStaff().find(x => x.id === id); if (!s) return;
    document.getElementById("staffModalTitle").textContent = `${s.name} bearbeiten`;
    document.getElementById("inputStaffName").value = s.name; document.getElementById("inputStaffEmail").value = s.email || "";
    document.getElementById("inputStaffActive").checked = s.active; del.classList.remove("hidden");
  } else {
    document.getElementById("staffModalTitle").textContent = "Mitarbeiter hinzufügen";
    document.getElementById("inputStaffName").value = ""; document.getElementById("inputStaffEmail").value = "";
    document.getElementById("inputStaffActive").checked = true; del.classList.add("hidden");
  }
  document.getElementById("staffModal").classList.remove("hidden");
}
function closeStaffModal() { document.getElementById("staffModal").classList.add("hidden"); state.editingStaffId = null; }
function saveStaffFromModal() {
  const name = document.getElementById("inputStaffName").value.trim(); const email = document.getElementById("inputStaffEmail").value.trim();
  const active = document.getElementById("inputStaffActive").checked;
  if (!name) { showToast("Bitte einen Namen eingeben."); return; }
  const staff = getStaff();
  if (staff.some(s => normName(s.name) === normName(name) && s.id !== state.editingStaffId)) { showToast("Dieser Name existiert bereits."); return; }
  if (state.editingStaffId) { const s = staff.find(x => x.id === state.editingStaffId); Object.assign(s, { name, email, active }); }
  else staff.push({ id: uuid(), name, email, active });
  setStaff(staff); closeStaffModal(); renderTab(); showToast("Mitarbeiter gespeichert.");
}
function deleteStaffFromModal() {
  if (!state.editingStaffId) return;
  setStaff(getStaff().filter(s => s.id !== state.editingStaffId)); closeStaffModal(); renderTab(); showToast("Mitarbeiter gelöscht.");
}

/* ---------- Zimmerliste ---------- */
function getRoomsForDate(dateKey) { return getRoomsAll().filter(r => r.date === dateKey); }
function roomNumberExistsOnDate(number, dateKey, excludeId) { return getRoomsAll().some(r => r.date === dateKey && String(r.number) === String(number) && r.id !== excludeId); }
function sortRoomsList(rooms) {
  return [...rooms].sort((a, b) => (a.floor - b.floor) || (STATUS_ORDER.indexOf(a.color) - STATUS_ORDER.indexOf(b.color)) || String(a.number).localeCompare(String(b.number), "de", { numeric: true }));
}
function renderRoomsTab() {
  const rooms = sortRoomsList(getRoomsForDate(state.currentDate));
  const rows = rooms.map(r => `<div class="room-item ${STATUS_CONFIG[r.color].cssClass} ${r.dnd ? "room-dnd" : ""}" data-id="${r.id}"><div><span class="room-num">${r.number}</span>
    <span class="room-meta">Etage ${r.floor} · ${STATUS_CONFIG[r.color].short}${r.isSuite ? " · Suite" : ""}${r.ww ? " · WW" : ""}${r.dnd ? ' <span class="badge dnd">Nicht stören</span>' : ""}</span></div>
    <button class="btn small secondary" data-action="edit-room">✏️</button></div>`).join("");
  const dndCount = rooms.filter(r => r.dnd).length;
  return `<div class="card"><div class="card-header"><h3>Zimmerliste – ${formatDateLabel(state.currentDate)}</h3><span class="muted">${rooms.length} Zimmer</span></div>
    <button id="btnBulk" class="btn secondary full">📋 Mehrere Zimmer auf einmal eintragen</button>
    ${dndCount > 0 ? `<p class="muted">🔴 ${dndCount} Zimmer mit „Bitte nicht stören“ – werden nicht verteilt und nicht mitgezählt.</p>` : ""}
    ${rooms.length === 0 ? '<p class="muted">Noch keine Zimmer für diesen Tag.</p>' : rows}</div><button id="btnAddRoom" class="fab">+</button>`;
}
function updateDndRowVisibility() {
  const row = document.getElementById("dndRow");
  if (document.getElementById("inputStatus").value === "yellow") row.classList.remove("hidden");
  else { row.classList.add("hidden"); document.getElementById("inputDnd").checked = false; }
}
function openRoomModal(id) {
  state.editingRoomId = id || null; const del = document.getElementById("btnDeleteRoom");
  if (id) {
    const r = getRoomsAll().find(x => x.id === id); if (!r) return;
    document.getElementById("roomModalTitle").textContent = `Zimmer ${r.number} bearbeiten`;
    document.getElementById("inputRoomNumber").value = r.number; document.getElementById("inputRoomFloor").value = r.floor;
    document.getElementById("inputStatus").value = r.color; document.getElementById("inputWW").checked = !!r.ww;
    document.getElementById("inputIsSuite").checked = !!r.isSuite; document.getElementById("inputDnd").checked = !!r.dnd; del.classList.remove("hidden");
  } else {
    document.getElementById("roomModalTitle").textContent = "Zimmer hinzufügen";
    document.getElementById("inputRoomNumber").value = ""; document.getElementById("inputRoomFloor").value = "";
    document.getElementById("inputStatus").value = "blue";
    ["inputWW", "inputIsSuite", "inputDnd"].forEach(i => document.getElementById(i).checked = false); del.classList.add("hidden");
  }
  updateDndRowVisibility(); document.getElementById("roomModal").classList.remove("hidden");
}
function closeRoomModal() { document.getElementById("roomModal").classList.add("hidden"); state.editingRoomId = null; }
function saveRoomFromModal() {
  const number = document.getElementById("inputRoomNumber").value.trim(); const fl = document.getElementById("inputRoomFloor").value.toString().trim();
  const color = document.getElementById("inputStatus").value; const ww = document.getElementById("inputWW").checked; const isSuite = document.getElementById("inputIsSuite").checked;
  const dnd = color === "yellow" ? document.getElementById("inputDnd").checked : false;
  if (!number) { showToast("Bitte eine Zimmernummer eingeben."); return; }
  const floor = fl === "" ? deriveFloor(number) : parseInt(fl, 10);
  if (floor === null || isNaN(floor)) { showToast("Etage konnte nicht ermittelt werden – bitte eintragen."); return; }
  if (roomNumberExistsOnDate(number, state.currentDate, state.editingRoomId)) { showToast(`Zimmer ${number} ist bereits eingetragen.`); return; }
  const rooms = getRoomsAll();
  if (state.editingRoomId) { const r = rooms.find(x => x.id === state.editingRoomId); Object.assign(r, { number, floor, color, ww, isSuite, dnd }); }
  else rooms.push({ id: uuid(), number, floor, color, ww, isSuite, dnd, date: state.currentDate });
  setRoomsAll(rooms); closeRoomModal(); renderTab(); showToast("Zimmer gespeichert."); pushDndListForDate(state.currentDate);
}
function deleteRoomFromModal() {
  if (!state.editingRoomId) return;
  setRoomsAll(getRoomsAll().filter(r => r.id !== state.editingRoomId)); closeRoomModal(); renderTab(); showToast("Zimmer gelöscht."); pushDndListForDate(state.currentDate);
}
function parseBulk(text) {
  const colorMap = { b: "blue", blau: "blue", blue: "blue", r: "red", rot: "red", red: "red", y: "yellow", g: "yellow", gelb: "yellow", yellow: "yellow" };
  const rooms = []; const errors = [];
  String(text || "").split(/\n|;/).map(l => l.trim()).filter(Boolean).forEach(line => {
    const tokens = line.split(/[\s,]+/).filter(Boolean); const number = tokens[0];
    let color = null, ww = false, isSuite = false, dnd = false;
    tokens.slice(1).forEach(t => { const k = t.toLowerCase();
      if (colorMap[k]) color = colorMap[k]; else if (k === "ww") ww = true; else if (k === "suite" || k === "s") isSuite = true; else if (k === "dnd" || k === "ns") dnd = true; });
    if (!color) { errors.push(`${line} (Farbe fehlt)`); return; }
    if (dnd && color !== "yellow") { errors.push(`${number}: „dnd“ gilt nur für Gelb – ignoriert`); dnd = false; }
    rooms.push({ number, color, ww, isSuite, dnd });
  });
  return { rooms, errors };
}
function saveBulkFromModal() {
  const { rooms: parsed, errors } = parseBulk(document.getElementById("inputBulk").value);
  if (parsed.length === 0) { showToast(errors.length ? "Keine gültige Zeile: " + errors[0] : "Bitte Zimmer eingeben."); return; }
  const rooms = getRoomsAll(); let added = 0, skipped = 0;
  parsed.forEach(p => {
    if (rooms.some(r => r.date === state.currentDate && String(r.number) === String(p.number))) { skipped++; return; }
    const floor = deriveFloor(p.number); if (floor === null) { errors.push(`${p.number} (Etage unbekannt)`); return; }
    rooms.push({ id: uuid(), number: p.number, floor, color: p.color, ww: p.ww, isSuite: p.isSuite, dnd: p.dnd, date: state.currentDate }); added++;
  });
  setRoomsAll(rooms); document.getElementById("bulkModal").classList.add("hidden"); document.getElementById("inputBulk").value = "";
  renderTab(); showToast(`${added} Zimmer hinzugefügt${skipped ? ", " + skipped + " schon vorhanden" : ""}${errors.length ? ", " + errors.length + " Hinweis(e)" : ""}.`);
  pushDndListForDate(state.currentDate);
}
function pushDndListForDate(dateKey) {
  if (!webhook()) return Promise.resolve(false);
  const nums = getRoomsForDate(dateKey).filter(r => r.dnd).map(r => String(r.number));
  return postToWebhook({ type: "dndUpdate", date: dateKey, roomNumbers: nums }).then(() => true).catch(() => false);
}

/* ---------- Verteilung ---------- */
function getAssignmentForDate(dateKey) { return getAssignmentsAll().find(a => a.date === dateKey) || null; }
function saveAssignmentForDate(dateKey, map, seed) {
  const all = getAssignmentsAll().filter(a => a.date !== dateKey); all.push({ date: dateKey, assignment: map, rotateSeed: seed, sentAt: null }); setAssignmentsAll(all);
}
function renderDistributeTab() {
  const staff = getStaff(); const all = getRoomsForDate(state.currentDate);
  const active = all.filter(r => !r.dnd); const dndCount = all.length - active.length; const existing = getAssignmentForDate(state.currentDate);
  const boxes = staff.map(s => `<label class="checkbox-label" style="margin-bottom:8px;"><input type="checkbox" class="present-checkbox" data-id="${s.id}" ${s.active ? "checked" : ""}> ${s.name}</label>`).join("");
  let result = "";
  if (existing) {
    result = Object.keys(existing.assignment).map(id => {
      const emp = staff.find(s => s.id === id); const rs = existing.assignment[id];
      const chips = rs.map(r => `<span class="room-chip" style="background:${STATUS_CONFIG[r.color].color}22;color:${STATUS_CONFIG[r.color].color};">${r.number}</span>`).join("");
      const floors = [...new Set(rs.map(r => r.floor))].sort((a, b) => a - b); const cc = {}; rs.forEach(r => cc[r.color] = (cc[r.color] || 0) + 1);
      const load = rs.reduce((s, r) => s + roomWeight(r), 0);
      return `<div class="employee-assign-card"><h4><span>${emp ? emp.name : "Unbekannt"} — ${rs.length} Zimmer${load !== rs.length ? " (Last " + load + ")" : ""}</span></h4>
        <div class="muted">Etagen: ${floors.length ? floors.join(", ") : "–"}</div>
        <div class="muted" style="margin-bottom:6px;">${STATUS_ORDER.map(c => `${STATUS_CONFIG[c].short}: ${cc[c] || 0}`).join(" · ")}</div><div>${chips}</div></div>`;
    }).join("");
  }
  return `<div class="card"><div class="card-header"><h3>Wer arbeitet heute?</h3></div>${staff.length === 0 ? '<p class="muted">Zuerst Mitarbeiter im Tab „Mitarbeiter“ eintragen.</p>' : boxes}</div>
    <div class="card"><div class="card-header"><h3>Verteilung</h3><span class="muted">${active.length} zu verteilen${dndCount > 0 ? " · " + dndCount + " ausgeschlossen" : ""}</span></div>
    <button id="btnDistribute" class="btn primary full">Zimmer gerecht verteilen</button>
    ${existing ? `<button id="btnSendAssignments" class="btn secondary full">An Mitarbeiter senden${existing.sentAt ? " (erneut)" : ""}</button>` : ""}
    ${existing && existing.sentAt ? `<div class="muted">Zuletzt gesendet: ${new Date(existing.sentAt).toLocaleString("de-DE")}</div>` : ""}</div>
    ${result ? `<div class="card"><div class="card-header"><h3>Ergebnis</h3></div>${result}</div>` : ""}`;
}
function handleDistributeClick() {
  const ids = Array.from(document.querySelectorAll(".present-checkbox")).filter(cb => cb.checked).map(cb => cb.dataset.id);
  if (ids.length === 0) { showToast("Bitte mindestens einen Mitarbeiter auswählen."); return; }
  const rooms = getRoomsForDate(state.currentDate);
  if (rooms.filter(r => !r.dnd).length === 0) { showToast("Bitte zuerst die Zimmerliste für diesen Tag eintragen."); return; }
  const seed = dayOfYear(state.currentDate) % ids.length;
  saveAssignmentForDate(state.currentDate, distributeRooms(rooms, ids, seed), seed); renderTab(); showToast("Zimmer wurden verteilt.");
}
function handleSendAssignments() {
  if (!webhook()) { showToast("Bitte zuerst die Webhook-URL in den Einstellungen eintragen."); return Promise.resolve(false); }
  const existing = getAssignmentForDate(state.currentDate); if (!existing) { showToast("Bitte zuerst verteilen."); return Promise.resolve(false); }
  const staff = getStaff();
  /* Alle bekannten Mitarbeiter bekommen eine Zuteilung – wer heute nicht eingeteilt ist, bekommt eine leere Liste (löscht alte Zuteilungen). */
  const jobs = staff.map(emp => postToWebhook({ type: "assignment", date: state.currentDate, employeeName: emp.name, employeeEmail: emp.email || "",
    rooms: (existing.assignment[emp.id] || []).map(r => ({ number: String(r.number), floor: r.floor, color: r.color, ww: !!r.ww, isSuite: !!r.isSuite })) }));
  jobs.push(pushDndListForDate(state.currentDate));
  return Promise.all(jobs).then(() => {
    existing.sentAt = Date.now(); const all = getAssignmentsAll().filter(a => a.date !== state.currentDate); all.push(existing); setAssignmentsAll(all);
    renderTab(); showToast("Zuteilungen an die Mitarbeiter gesendet."); return true;
  }).catch(err => { showToast("Senden fehlgeschlagen: " + err.message); return false; });
}

/* ---------- Bericht (Live) ---------- */
function renderReportTab() {
  const cached = (state.overview && state.overviewDate === state.currentDate) ? buildReportView(state.overview) : '<p class="muted" style="padding:0 4px;">Lade aktuellen Stand…</p>';
  return `<div class="card"><div class="card-header"><h3>Gruppieren nach</h3></div><div class="select-group">
    <button data-group="employee" class="${state.groupBy === "employee" ? "active" : ""}">Mitarbeiter</button>
    <button data-group="floor" class="${state.groupBy === "floor" ? "active" : ""}">Etage</button>
    <button data-group="color" class="${state.groupBy === "color" ? "active" : ""}">Farbe</button></div>
    <button id="btnRefreshReport" class="btn secondary full">↻ Status aktualisieren</button></div><div id="reportResult">${cached}</div>`;
}
function fetchOverview() {
  if (!webhook()) { showToast("Bitte zuerst die Webhook-URL eintragen."); return Promise.resolve(null); }
  const date = state.currentDate;
  return fetch(`${webhook()}?action=getOverview&date=${encodeURIComponent(date)}`).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(d => { state.overview = d; state.overviewDate = date; state.overviewAt = Date.now(); return d; });
}
function refreshReport() {
  const box = document.getElementById("reportResult");
  return fetchOverview().then(d => { const b = document.getElementById("reportResult"); if (b && d) b.innerHTML = buildReportView(d); return d; })
    .catch(err => { showToast("Abruf fehlgeschlagen: " + err.message); const b = document.getElementById("reportResult"); if (b) b.innerHTML = '<p class="muted">Abruf fehlgeschlagen.</p>'; return null; });
}
function presenceFor(member, shifts) {
  const sh = (shifts || []).find(s => normName(s.employeeName) === normName(member.name));
  if (!sh || !sh.kommen) return { label: "Nicht eingestempelt", cls: "off" };
  if (sh.gehen) return { label: `Gegangen ${fmtTime(sh.gehen)}`, cls: "gone" };
  return { label: `Anwesend seit ${fmtTime(sh.kommen)}`, cls: "on" };
}
function buildReportItems(overview) {
  const staff = getStaff(); const entry = getAssignmentForDate(state.currentDate); const status = (overview && overview.status) || {};
  const planned = []; 
  if (entry) {
    Object.keys(entry.assignment).forEach(id => { const emp = staff.find(s => s.id === id);
      entry.assignment[id].forEach(r => planned.push({ number: String(r.number), floor: r.floor, color: r.color, employeeName: emp ? emp.name : "Unbekannt" })); });
  } else {
    getRoomsForDate(state.currentDate).filter(r => !r.dnd).forEach(r => planned.push({ number: String(r.number), floor: r.floor, color: r.color, employeeName: "Nicht zugeteilt" }));
  }
  planned.forEach(it => { const s = status[it.number]; it.state = s && s.endTime ? "done" : (s && s.startTime ? "progress" : "open"); it.doneBy = s ? s.employeeName : null; });
  const nums = new Set(planned.map(p => p.number));
  const dnd = new Set(getRoomsForDate(state.currentDate).filter(r => r.dnd).map(r => String(r.number)));
  const extras = Object.keys(status).filter(n => !nums.has(n) && !dnd.has(n)).map(n => ({ number: n, employeeName: status[n].employeeName, state: status[n].endTime ? "done" : "progress" }));
  return { planned, extras, dndCount: dnd.size };
}
function chipFor(it) {
  const icon = it.state === "done" ? " ✓" : (it.state === "progress" ? " ⏳" : "");
  return `<span class="room-chip chip-${it.state}">${it.number}${icon}</span>`;
}
function buildReportView(overview) {
  const staff = getStaff(); const { planned, extras, dndCount } = buildReportItems(overview);
  const done = planned.filter(i => i.state === "done").length; const prog = planned.filter(i => i.state === "progress").length; const open = planned.length - done - prog;
  const shifts = (overview && overview.shifts) || [];
  const cards = staff.filter(s => s.active || planned.some(p => p.employeeName === s.name)).map(s => {
    const mine = planned.filter(p => p.employeeName === s.name); const pr = presenceFor(s, shifts);
    const perColor = STATUS_ORDER.map(c => { const m = mine.filter(x => x.color === c); return m.length ? `${STATUS_CONFIG[c].short} ${m.filter(x => x.state === "done").length}/${m.length}` : null; }).filter(Boolean).join(" · ");
    const d = mine.filter(x => x.state === "done").length; const p = mine.filter(x => x.state === "progress").length;
    return `<div class="employee-assign-card"><h4><span>${s.name}</span><span class="badge ${pr.cls}">${pr.label}</span></h4>
      <div class="muted">${mine.length ? `Erledigt ${d}/${mine.length}${p ? " · in Arbeit " + p : ""}${perColor ? " · " + perColor : ""}` : "Keine Zimmer zugeteilt"}</div></div>`;
  }).join("");
  const groups = {};
  planned.forEach(it => { const key = state.groupBy === "employee" ? it.employeeName : state.groupBy === "floor" ? "Etage " + it.floor : STATUS_CONFIG[it.color].short; (groups[key] = groups[key] || []).push(it); });
  const groupHtml = Object.keys(groups).sort((a, b) => a.localeCompare(b, "de", { numeric: true })).map(key => {
    const list = groups[key]; const dn = list.filter(i => i.state === "done").length; const pct = Math.round(dn / list.length * 100);
    const sorted = [...list].sort((a, b) => (a.floor - b.floor) || a.number.localeCompare(b.number, "de", { numeric: true }));
    return `<div class="group-block"><div class="group-title"><span>${key}</span><span class="muted">${dn}/${list.length}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><div>${sorted.map(chipFor).join("")}</div></div>`;
  }).join("");
  const stamp = state.overviewAt ? `Stand: ${fmtTime(state.overviewAt)}` : "";
  return `<div class="card"><div class="stat-grid">
      <div class="stat-box"><div class="stat-value">${done}/${planned.length}</div><div class="stat-label">Erledigt</div></div>
      <div class="stat-box"><div class="stat-value">${prog}</div><div class="stat-label">In Arbeit</div></div>
      <div class="stat-box"><div class="stat-value">${open}</div><div class="stat-label">Noch offen</div></div></div>
      <div class="legend">✓ erledigt · ⏳ in Arbeit · rot = offen ${stamp ? "· " + stamp : ""}</div>
      ${dndCount > 0 ? `<p class="muted">🔴 ${dndCount} Zimmer mit „Bitte nicht stören“ sind nicht eingerechnet.</p>` : ""}
      ${extras.length ? `<p class="muted">Zusätzlich von Mitarbeitern eingetragen: ${extras.map(e => e.number + " (" + e.employeeName + ")").join(", ")}</p>` : ""}</div>
    <div class="card"><div class="card-header"><h3>Mitarbeiter heute</h3></div>${cards || '<p class="muted">Keine Mitarbeiter.</p>'}</div>
    <div class="card"><div class="card-header"><h3>Zimmer nach ${state.groupBy === "employee" ? "Mitarbeiter" : state.groupBy === "floor" ? "Etage" : "Farbe"}</h3></div>
      ${groupHtml || '<p class="muted">Keine Zimmer für diesen Tag. Zuerst Zimmerliste eintragen und verteilen.</p>'}</div>`;
}

/* ---------- Einstellungen ---------- */
function openSettingsModal() {
  const s = getSettings(); document.getElementById("inputWebhook").value = s.webhookUrl || "";
  document.getElementById("webhookStatus").textContent = s.webhookUrl ? "Konfiguriert." : "Nicht konfiguriert.";
  document.getElementById("settingsModal").classList.remove("hidden");
}
function closeSettingsModal() { document.getElementById("settingsModal").classList.add("hidden"); }
function saveSettingsFromModal() { setSettings({ webhookUrl: document.getElementById("inputWebhook").value.trim() }); closeSettingsModal(); showToast("Einstellungen gespeichert."); }
function testWebhookConnection() {
  const url = document.getElementById("inputWebhook").value.trim(); if (!url) { showToast("Bitte zuerst eine Webhook-URL eingeben."); return Promise.resolve(false); }
  document.getElementById("webhookStatus").textContent = "Teste…";
  return fetch(`${url}?action=ping`).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(d => { const v = d && d.version ? ` (Skript-Version ${d.version})` : ""; const old = !d || d.version !== "5";
      document.getElementById("webhookStatus").textContent = old ? "Verbindung ok, aber das Skript ist veraltet – bitte Version 5 einfügen und neu bereitstellen." : "Verbindung erfolgreich ✓" + v;
      showToast(old ? "Skript veraltet – Version 5 nötig." : "Verbindung erfolgreich."); return !old; })
    .catch(err => { document.getElementById("webhookStatus").textContent = "Fehler: " + err.message; showToast("Verbindung fehlgeschlagen."); return false; });
}

/* ---------- Tabs / Start ---------- */
function renderHeader() { document.getElementById("currentDateLabel").textContent = formatDateLabel(state.currentDate); }
function renderTab() {
  const content = document.getElementById("tabContent");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === state.activeTab));
  content.innerHTML = state.activeTab === "staff" ? renderStaffTab() : state.activeTab === "rooms" ? renderRoomsTab() : state.activeTab === "distribute" ? renderDistributeTab() : renderReportTab();
  bindTabEvents(); renderHeader();
  if (state.activeTab === "report" && webhook() && !(state.overview && state.overviewDate === state.currentDate)) refreshReport();
}
function bindTabEvents() {
  const $ = id => document.getElementById(id);
  if ($("btnAddStaff")) $("btnAddStaff").addEventListener("click", () => openStaffModal(null));
  document.querySelectorAll('[data-action="edit-staff"]').forEach(b => b.addEventListener("click", e => openStaffModal(e.target.closest(".list-item").dataset.id)));
  if ($("btnAddRoom")) $("btnAddRoom").addEventListener("click", () => openRoomModal(null));
  if ($("btnBulk")) $("btnBulk").addEventListener("click", () => $("bulkModal").classList.remove("hidden"));
  document.querySelectorAll('[data-action="edit-room"]').forEach(b => b.addEventListener("click", e => openRoomModal(e.target.closest(".room-item").dataset.id)));
  if ($("btnDistribute")) $("btnDistribute").addEventListener("click", handleDistributeClick);
  if ($("btnSendAssignments")) $("btnSendAssignments").addEventListener("click", handleSendAssignments);
  document.querySelectorAll("[data-group]").forEach(b => b.addEventListener("click", () => { state.groupBy = b.dataset.group; renderTab(); }));
  if ($("btnRefreshReport")) $("btnRefreshReport").addEventListener("click", refreshReport);
}
function renderAll() { renderHeader(); renderTab(); }
function changeDate(key) { state.currentDate = key; state.overview = null; renderAll(); }
function bindEvents() {
  const $ = id => document.getElementById(id);
  $("btnPrevDay").addEventListener("click", () => changeDate(shiftDate(state.currentDate, -1)));
  $("btnNextDay").addEventListener("click", () => changeDate(shiftDate(state.currentDate, 1)));
  $("btnToday").addEventListener("click", () => changeDate(todayStr()));
  $("btnCancelStaff").addEventListener("click", closeStaffModal); $("btnSaveStaff").addEventListener("click", saveStaffFromModal); $("btnDeleteStaff").addEventListener("click", deleteStaffFromModal);
  $("btnCancelRoom").addEventListener("click", closeRoomModal); $("btnSaveRoom").addEventListener("click", saveRoomFromModal); $("btnDeleteRoom").addEventListener("click", deleteRoomFromModal);
  $("inputStatus").addEventListener("change", updateDndRowVisibility);
  $("btnBulkCancel").addEventListener("click", () => $("bulkModal").classList.add("hidden")); $("btnBulkSave").addEventListener("click", saveBulkFromModal);
  $("btnSettings").addEventListener("click", openSettingsModal); $("btnCloseSettings").addEventListener("click", closeSettingsModal);
  $("btnSaveSettings").addEventListener("click", saveSettingsFromModal); $("btnTestWebhook").addEventListener("click", testWebhookConnection);
  document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => { state.activeTab = b.dataset.tab; renderTab(); }));
}
function init() {
  bindEvents(); renderAll();
  setInterval(() => { if (state.activeTab === "report" && document.visibilityState === "visible" && webhook()) refreshReport(); }, 60000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
document.addEventListener("DOMContentLoaded", init);
