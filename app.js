const STORAGE_KEY = "sagra-booking-state-v1";
const ADMIN_SESSION_KEY = "sagra-admin-session-v1";
const ADMIN_CREDENTIALS = { username: "admin", password: "admin" };

const defaultState = {
  events: [],
  reservations: []
};

const els = {
  bookingForm: document.getElementById("bookingForm"),
  bookingEvent: document.getElementById("bookingEvent"),
  bookingTime: document.getElementById("bookingTime"),
  bookingSeats: document.getElementById("bookingSeats"),
  bookingName: document.getElementById("bookingName"),
  bookingSummary: document.getElementById("bookingSummary"),
  bookingAvailability: document.getElementById("bookingAvailability"),
  lookupForm: document.getElementById("lookupForm"),
  lookupCode: document.getElementById("lookupCode"),
  lookupResult: document.getElementById("lookupResult"),
  editReservationForm: document.getElementById("editReservationForm"),
  editReservationId: document.getElementById("editReservationId"),
  editName: document.getElementById("editName"),
  editEvent: document.getElementById("editEvent"),
  editTime: document.getElementById("editTime"),
  editSeats: document.getElementById("editSeats"),
  cancelReservationButton: document.getElementById("cancelReservationButton"),
  adminLoginPanel: document.getElementById("adminLoginPanel"),
  adminPanel: document.getElementById("adminPanel"),
  adminSessionBadge: document.getElementById("adminSessionBadge"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  adminUsername: document.getElementById("adminUsername"),
  adminPassword: document.getElementById("adminPassword"),
  adminLogoutButton: document.getElementById("adminLogoutButton"),
  eventForm: document.getElementById("eventForm"),
  eventId: document.getElementById("eventId"),
  eventName: document.getElementById("eventName"),
  eventDate: document.getElementById("eventDate"),
  eventTimes: document.getElementById("eventTimes"),
  capacityMode: document.getElementById("capacityMode"),
  manualCapacityField: document.getElementById("manualCapacityField"),
  manualCapacity: document.getElementById("manualCapacity"),
  tableSeatsField: document.getElementById("tableSeatsField"),
  tableSeats: document.getElementById("tableSeats"),
  tableCountField: document.getElementById("tableCountField"),
  tableCount: document.getElementById("tableCount"),
  resetEventFormButton: document.getElementById("resetEventFormButton"),
  eventList: document.getElementById("eventList"),
  reservationList: document.getElementById("reservationList"),
  toast: document.getElementById("toast")
};

let state = loadState();
let currentLookupReservationId = null;

init();

function init() {
  bindEvents();
  syncAdminPanel();
  renderAll();
}

function bindEvents() {
  els.bookingEvent.addEventListener("change", () => {
    populateTimes("booking");
    renderBookingSummary();
    refreshBookingAvailability();
  });
  els.bookingTime.addEventListener("change", refreshBookingAvailability);
  els.bookingSeats.addEventListener("input", refreshBookingAvailability);
  els.bookingForm.addEventListener("submit", handleBookingSubmit);

  els.lookupForm.addEventListener("submit", handleLookupSubmit);
  els.editEvent.addEventListener("change", () => populateTimes("edit"));
  els.editReservationForm.addEventListener("submit", handleEditSubmit);
  els.cancelReservationButton.addEventListener("click", handleDeleteReservation);

  els.adminLoginForm.addEventListener("submit", handleAdminLogin);
  els.adminLogoutButton.addEventListener("click", handleAdminLogout);
  els.capacityMode.addEventListener("change", syncCapacityModeFields);
  els.eventForm.addEventListener("submit", handleEventSubmit);
  els.resetEventFormButton.addEventListener("click", resetEventForm);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      reservations: Array.isArray(parsed.reservations) ? parsed.reservations : []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isAdminLoggedIn() {
  return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function syncAdminPanel() {
  const loggedIn = isAdminLoggedIn();
  els.adminLoginPanel.classList.toggle("hidden", loggedIn);
  els.adminPanel.classList.toggle("hidden", !loggedIn);
  els.adminSessionBadge.textContent = loggedIn ? "Autenticato" : "Non autenticato";
  els.adminSessionBadge.className = `status-pill ${loggedIn ? "ok" : "neutral"}`;
}

function renderAll() {
  sortEvents();
  saveState();
  populateEventSelects();
  populateTimes("booking");
  renderBookingSummary();
  renderLookupState();
  renderEventList();
  renderReservationList();
  syncCapacityModeFields();
  refreshBookingAvailability();
}

function sortEvents() {
  state.events.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.name.localeCompare(b.name);
  });
}

function populateEventSelects() {
  const publicOptions = state.events.map((event) => optionMarkup(event.id, formatEventLabel(event)));
  setSelectOptions(
    els.bookingEvent,
    publicOptions,
    publicOptions.length ? null : "Nessun evento disponibile"
  );

  const editOptions = state.events.map((event) => optionMarkup(event.id, formatEventLabel(event)));
  setSelectOptions(
    els.editEvent,
    editOptions,
    editOptions.length ? null : "Nessun evento"
  );
}

function setSelectOptions(select, options, emptyLabel) {
  if (!options.length) {
    select.innerHTML = `<option value="">${emptyLabel}</option>`;
    select.disabled = true;
    return;
  }

  const currentValue = select.value;
  select.disabled = false;
  select.innerHTML = options.join("");

  const stillExists = [...select.options].some((option) => option.value === currentValue);
  select.value = stillExists ? currentValue : select.options[0].value;
}

function optionMarkup(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function populateTimes(target) {
  const eventSelect = target === "booking" ? els.bookingEvent : els.editEvent;
  const timeSelect = target === "booking" ? els.bookingTime : els.editTime;
  const event = getEventById(eventSelect.value);

  if (!event) {
    setSelectOptions(timeSelect, [], "Nessun orario");
    return;
  }

  const options = event.times.map((time) => optionMarkup(time, time));
  const previousValue = timeSelect.value;
  setSelectOptions(timeSelect, options, "Nessun orario");

  if (event.times.includes(previousValue)) {
    timeSelect.value = previousValue;
  }
}

function refreshBookingAvailability() {
  const event = getEventById(els.bookingEvent.value);
  const seatsRequested = Number(els.bookingSeats.value || 0);
  const time = els.bookingTime.value;

  if (!event || !time) {
    els.bookingAvailability.textContent = "Seleziona una data disponibile";
    els.bookingAvailability.className = "status-pill neutral";
    return;
  }

  const metrics = getAvailabilityMetrics(event, time);
  let message = `Disponibili ${metrics.remainingSeats} posti`;
  let tone = "ok";

  if (event.capacityMode === "tables") {
    message += ` • ${metrics.remainingTables}/${metrics.totalTables} tavoli liberi`;
  }

  if (seatsRequested > 0) {
    const check = canReserve(event.id, time, seatsRequested);
    if (check.ok) {
      message += " • richiesta possibile";
    } else {
      message = check.reason;
      tone = "danger";
    }
  } else if (metrics.remainingSeats === 0) {
    message = "Fascia oraria al completo";
    tone = "danger";
  } else if (metrics.remainingSeats < Math.max(4, Math.floor(metrics.totalSeats * 0.2))) {
    tone = "warn";
  }

  els.bookingAvailability.textContent = message;
  els.bookingAvailability.className = `status-pill ${tone}`;
}

function renderBookingSummary() {
  if (!state.events.length) {
    els.bookingSummary.innerHTML = "Nessun evento configurato. Accedi come admin per creare la prima data.";
    return;
  }

  const nextEvent = getEventById(els.bookingEvent.value) || state.events[0];
  if (!nextEvent) {
    els.bookingSummary.textContent = "";
    return;
  }

  const modeText = nextEvent.capacityMode === "manual"
    ? `Capienza totale: ${nextEvent.manualCapacity} posti`
    : `Tavoli componibili: ${nextEvent.tableCount} tavoli da ${nextEvent.tableSeats} posti base`;

  els.bookingSummary.innerHTML = `
    <strong>${escapeHtml(nextEvent.name)}</strong><br>
    ${escapeHtml(formatLongDate(nextEvent.date))}<br>
    ${escapeHtml(modeText)}<br>
    Orari disponibili: ${escapeHtml(nextEvent.times.join(", "))}
  `;
}

function renderLookupState() {
  if (!currentLookupReservationId) {
    els.editReservationForm.classList.add("hidden");
    return;
  }

  const reservation = getReservationById(currentLookupReservationId);
  if (!reservation) {
    currentLookupReservationId = null;
    els.editReservationForm.classList.add("hidden");
    return;
  }

  populateEventSelects();
  els.editReservationId.value = reservation.id;
  els.editName.value = reservation.name;
  els.editEvent.value = reservation.eventId;
  populateTimes("edit");
  els.editTime.value = reservation.time;
  els.editSeats.value = reservation.seats;
  els.editReservationForm.classList.remove("hidden");

  const event = getEventById(reservation.eventId);
  els.lookupResult.classList.remove("empty");
  els.lookupResult.innerHTML = `
    <strong>Prenotazione trovata</strong><br>
    Codice: ${escapeHtml(reservation.code)}<br>
    Evento: ${escapeHtml(event ? formatEventLabel(event) : "Evento rimosso")}<br>
    Orario: ${escapeHtml(reservation.time)}<br>
    Posti richiesti: ${reservation.seats}
  `;
}

function renderEventList() {
  if (!state.events.length) {
    els.eventList.innerHTML = `<div class="stack-card">Nessun evento creato.</div>`;
    return;
  }

  els.eventList.innerHTML = state.events.map((event) => {
    const stats = getEventUsageSummary(event);
    const modeDescription = event.capacityMode === "manual"
      ? `${event.manualCapacity} posti totali`
      : `${event.tableCount} tavoli da ${event.tableSeats} posti base`;

    return `
      <article class="stack-card">
        <div class="stack-card-header">
          <div>
            <h4>${escapeHtml(event.name)}</h4>
            <p>${escapeHtml(formatLongDate(event.date))}</p>
          </div>
          <div class="meta-row">
            <span class="meta-chip">${escapeHtml(modeDescription)}</span>
            <span class="meta-chip">${stats.reservations} prenotazioni</span>
          </div>
        </div>
        <p>Orari: ${escapeHtml(event.times.join(", "))}</p>
        <p>${escapeHtml(stats.description)}</p>
        <div class="inline-buttons">
          <button type="button" class="secondary-button" data-action="edit-event" data-id="${escapeHtml(event.id)}">Modifica</button>
          <button type="button" class="danger-button" data-action="delete-event" data-id="${escapeHtml(event.id)}">Elimina</button>
        </div>
      </article>
    `;
  }).join("");

  bindAdminListActions();
}

function renderReservationList() {
  if (!state.reservations.length) {
    els.reservationList.innerHTML = `<div class="stack-card">Nessuna prenotazione registrata.</div>`;
    return;
  }

  const sortedReservations = [...state.reservations].sort((a, b) => {
    const eventA = getEventById(a.eventId);
    const eventB = getEventById(b.eventId);
    const dateA = eventA?.date || "9999-12-31";
    const dateB = eventB?.date || "9999-12-31";
    const byDate = dateA.localeCompare(dateB);
    if (byDate !== 0) return byDate;
    return a.time.localeCompare(b.time);
  });

  els.reservationList.innerHTML = sortedReservations.map((reservation) => {
    const event = getEventById(reservation.eventId);
    const tableInfo = reservation.tablesUsed
      ? ` • tavoli usati: ${reservation.tablesUsed}`
      : "";

    return `
      <article class="stack-card">
        <div class="stack-card-header">
          <div>
            <h4>${escapeHtml(reservation.name)}</h4>
            <p>${escapeHtml(event ? formatEventLabel(event) : "Evento rimosso")} • ${escapeHtml(reservation.time)}</p>
          </div>
          <div class="meta-row">
            <span class="meta-chip">${reservation.seats} posti${tableInfo}</span>
            <span class="meta-chip">${escapeHtml(reservation.code)}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function bindAdminListActions() {
  document.querySelectorAll("[data-action='edit-event']").forEach((button) => {
    button.addEventListener("click", () => fillEventForm(button.dataset.id));
  });

  document.querySelectorAll("[data-action='delete-event']").forEach((button) => {
    button.addEventListener("click", () => deleteEvent(button.dataset.id));
  });
}

function handleBookingSubmit(event) {
  event.preventDefault();
  const eventId = els.bookingEvent.value;
  const time = els.bookingTime.value;
  const seats = Number(els.bookingSeats.value);
  const name = els.bookingName.value.trim();

  const validation = canReserve(eventId, time, seats);
  if (!name) {
    showToast("Inserisci il nome per la prenotazione.");
    return;
  }
  if (!validation.ok) {
    showToast(validation.reason);
    return;
  }

  const newReservation = buildReservation({
    id: crypto.randomUUID(),
    eventId,
    time,
    seats,
    name
  });

  state.reservations.push(newReservation);
  saveState();
  renderAll();
  els.bookingForm.reset();
  populateEventSelects();
  populateTimes("booking");
  renderBookingSummary();
  refreshBookingAvailability();

  els.lookupCode.value = newReservation.code;
  showToast(`Prenotazione confermata. Codice: ${newReservation.code}`);
  currentLookupReservationId = newReservation.id;
  renderLookupState();
}

function handleLookupSubmit(event) {
  event.preventDefault();
  const code = els.lookupCode.value.trim().toUpperCase();
  const reservation = state.reservations.find((item) => item.code === code);

  if (!reservation) {
    currentLookupReservationId = null;
    els.editReservationForm.classList.add("hidden");
    els.lookupResult.classList.add("empty");
    els.lookupResult.textContent = "Nessuna prenotazione trovata con questo codice.";
    return;
  }

  currentLookupReservationId = reservation.id;
  renderLookupState();
}

function handleEditSubmit(event) {
  event.preventDefault();
  const reservationId = els.editReservationId.value;
  const existing = getReservationById(reservationId);
  if (!existing) {
    showToast("Prenotazione non trovata.");
    return;
  }

  const eventId = els.editEvent.value;
  const time = els.editTime.value;
  const seats = Number(els.editSeats.value);
  const name = els.editName.value.trim();

  const validation = canReserve(eventId, time, seats, reservationId);
  if (!name) {
    showToast("Inserisci il nome della prenotazione.");
    return;
  }
  if (!validation.ok) {
    showToast(validation.reason);
    return;
  }

  Object.assign(existing, buildReservation({
    id: existing.id,
    code: existing.code,
    createdAt: existing.createdAt,
    eventId,
    time,
    seats,
    name
  }));

  saveState();
  renderAll();
  showToast("Prenotazione aggiornata.");
}

function handleDeleteReservation() {
  const reservationId = els.editReservationId.value;
  const existing = getReservationById(reservationId);
  if (!existing) {
    showToast("Prenotazione non trovata.");
    return;
  }

  const confirmed = window.confirm(`Vuoi cancellare la prenotazione ${existing.code}?`);
  if (!confirmed) return;

  state.reservations = state.reservations.filter((item) => item.id !== reservationId);
  currentLookupReservationId = null;
  saveState();
  renderAll();
  els.lookupResult.classList.add("empty");
  els.lookupResult.textContent = "Prenotazione cancellata.";
  showToast("Prenotazione cancellata.");
}

function handleAdminLogin(event) {
  event.preventDefault();
  const username = els.adminUsername.value.trim();
  const password = els.adminPassword.value;

  if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
    showToast("Credenziali non corrette.");
    return;
  }

  localStorage.setItem(ADMIN_SESSION_KEY, "true");
  els.adminLoginForm.reset();
  syncAdminPanel();
  showToast("Accesso amministratore effettuato.");
}

function handleAdminLogout() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  syncAdminPanel();
  showToast("Sessione amministratore chiusa.");
}

function handleEventSubmit(event) {
  event.preventDefault();
  if (!isAdminLoggedIn()) {
    showToast("Accedi come amministratore per salvare gli eventi.");
    return;
  }

  const capacityMode = els.capacityMode.value;
  const payload = {
    id: els.eventId.value || crypto.randomUUID(),
    name: els.eventName.value.trim(),
    date: els.eventDate.value,
    times: normalizeTimes(els.eventTimes.value),
    capacityMode,
    manualCapacity: capacityMode === "manual" ? Number(els.manualCapacity.value) : null,
    tableSeats: capacityMode === "tables" ? Number(els.tableSeats.value) : null,
    tableCount: capacityMode === "tables" ? Number(els.tableCount.value) : null
  };

  const validationError = validateEventPayload(payload);
  if (validationError) {
    showToast(validationError);
    return;
  }

  const existingIndex = state.events.findIndex((item) => item.id === payload.id);
  if (existingIndex >= 0) {
    state.events.splice(existingIndex, 1, payload);
    showToast("Evento aggiornato.");
  } else {
    state.events.push(payload);
    showToast("Evento creato.");
  }

  saveState();
  renderAll();
  resetEventForm();
}

function syncCapacityModeFields() {
  const mode = els.capacityMode.value;
  const tables = mode === "tables";
  els.manualCapacityField.classList.toggle("hidden", tables);
  els.tableSeatsField.classList.toggle("hidden", !tables);
  els.tableCountField.classList.toggle("hidden", !tables);

  els.manualCapacity.required = !tables;
  els.tableSeats.required = tables;
  els.tableCount.required = tables;
}

function resetEventForm() {
  els.eventForm.reset();
  els.eventId.value = "";
  els.capacityMode.value = "manual";
  els.tableSeats.value = 4;
  els.tableCount.value = 10;
  syncCapacityModeFields();
}

function fillEventForm(eventId) {
  const event = getEventById(eventId);
  if (!event) return;

  els.eventId.value = event.id;
  els.eventName.value = event.name;
  els.eventDate.value = event.date;
  els.eventTimes.value = event.times.join(", ");
  els.capacityMode.value = event.capacityMode;
  els.manualCapacity.value = event.manualCapacity ?? "";
  els.tableSeats.value = event.tableSeats ?? 4;
  els.tableCount.value = event.tableCount ?? 10;
  syncCapacityModeFields();
  window.scrollTo({ top: els.eventForm.offsetTop - 20, behavior: "smooth" });
}

function deleteEvent(eventId) {
  const event = getEventById(eventId);
  if (!event) return;

  const linkedReservations = state.reservations.filter((item) => item.eventId === eventId).length;
  const confirmed = window.confirm(
    `Eliminare "${event.name}" del ${formatLongDate(event.date)}? Verranno eliminate anche ${linkedReservations} prenotazioni collegate.`
  );
  if (!confirmed) return;

  state.events = state.events.filter((item) => item.id !== eventId);
  state.reservations = state.reservations.filter((item) => item.eventId !== eventId);
  if (currentLookupReservationId && !getReservationById(currentLookupReservationId)) {
    currentLookupReservationId = null;
  }
  saveState();
  renderAll();
  showToast("Evento eliminato.");
}

function validateEventPayload(payload) {
  if (!payload.name) return "Inserisci un nome evento.";
  if (!payload.date) return "Seleziona la data dell'evento.";
  if (!payload.times.length) return "Inserisci almeno un orario valido.";

  if (payload.capacityMode === "manual") {
    if (!Number.isInteger(payload.manualCapacity) || payload.manualCapacity <= 0) {
      return "I posti disponibili devono essere maggiori di zero.";
    }
  }

  if (payload.capacityMode === "tables") {
    if (!Number.isInteger(payload.tableSeats) || payload.tableSeats < 2) {
      return "I posti del tavolo base devono essere almeno 2.";
    }
    if (!Number.isInteger(payload.tableCount) || payload.tableCount <= 0) {
      return "Il numero tavoli deve essere maggiore di zero.";
    }
  }

  const linkedReservations = state.reservations.filter((item) => item.eventId === payload.id);
  const invalidTimeReservation = linkedReservations.find((item) => !payload.times.includes(item.time));
  if (invalidTimeReservation) {
    return `Esistono prenotazioni sull'orario ${invalidTimeReservation.time}: non puoi rimuoverlo finché restano attive.`;
  }

  for (const time of payload.times) {
    const reservationsAtTime = linkedReservations.filter((item) => item.time === time);

    if (payload.capacityMode === "manual") {
      const totalSeatsReserved = reservationsAtTime.reduce((sum, item) => sum + item.seats, 0);
      if (totalSeatsReserved > payload.manualCapacity) {
        return `Capienza insufficiente per le prenotazioni già presenti alle ${time}.`;
      }
      continue;
    }

    const usedTables = reservationsAtTime.reduce((sum, item) => {
      return sum + getTablesNeeded(payload.tableSeats, item.seats);
    }, 0);

    if (reservationsAtTime.some((item) => getTablesNeeded(payload.tableSeats, item.seats) > payload.tableCount)) {
      return `Almeno una prenotazione alle ${time} non entra nella nuova configurazione tavoli.`;
    }

    if (usedTables > payload.tableCount) {
      return `Tavoli insufficienti alle ${time} per le prenotazioni già registrate.`;
    }
  }

  return "";
}

function normalizeTimes(value) {
  return [...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => /^\d{1,2}:\d{2}$/.test(item))
      .map((item) => item.padStart(5, "0"))
  )].sort();
}

function buildReservation({ id, code, createdAt, eventId, time, seats, name }) {
  const event = getEventById(eventId);
  const tablesUsed = event?.capacityMode === "tables"
    ? getTablesNeeded(event.tableSeats, seats)
    : null;

  return {
    id,
    code: code || generateReservationCode(),
    createdAt: createdAt || new Date().toISOString(),
    eventId,
    time,
    seats,
    name,
    tablesUsed
  };
}

function getAvailabilityMetrics(event, time, reservationIdToIgnore = null) {
  const reservations = state.reservations.filter((item) =>
    item.eventId === event.id &&
    item.time === time &&
    item.id !== reservationIdToIgnore
  );

  if (event.capacityMode === "manual") {
    const reservedSeats = reservations.reduce((sum, item) => sum + item.seats, 0);
    return {
      totalSeats: event.manualCapacity,
      remainingSeats: Math.max(0, event.manualCapacity - reservedSeats),
      reservedSeats,
      totalTables: null,
      remainingTables: null
    };
  }

  const usedTables = reservations.reduce((sum, item) => sum + (item.tablesUsed || 0), 0);
  return {
    totalSeats: getComposableCapacity(event.tableSeats, event.tableCount),
    remainingSeats: Math.max(0, getComposableCapacity(event.tableSeats, event.tableCount - usedTables)),
    reservedSeats: reservations.reduce((sum, item) => sum + item.seats, 0),
    totalTables: event.tableCount,
    remainingTables: Math.max(0, event.tableCount - usedTables),
    usedTables
  };
}

function canReserve(eventId, time, seats, reservationIdToIgnore = null) {
  const event = getEventById(eventId);
  if (!event) return { ok: false, reason: "Evento non trovato." };
  if (!time) return { ok: false, reason: "Seleziona un orario." };
  if (!event.times.includes(time)) return { ok: false, reason: "Orario non disponibile per questo evento." };
  if (!Number.isInteger(seats) || seats <= 0) {
    return { ok: false, reason: "Il numero posti deve essere maggiore di zero." };
  }

  if (event.capacityMode === "manual") {
    const metrics = getAvailabilityMetrics(event, time, reservationIdToIgnore);
    if (seats > metrics.remainingSeats) {
      return { ok: false, reason: `Posti insufficienti: ne restano ${metrics.remainingSeats}.` };
    }
    return { ok: true };
  }

  const tablesNeeded = getTablesNeeded(event.tableSeats, seats);
  if (tablesNeeded > event.tableCount) {
    return {
      ok: false,
      reason: `Richiesta troppo grande: servirebbero ${tablesNeeded} tavoli, ma l'evento ne ha ${event.tableCount}.`
    };
  }

  const metrics = getAvailabilityMetrics(event, time, reservationIdToIgnore);
  if (tablesNeeded > metrics.remainingTables) {
    return {
      ok: false,
      reason: `Tavoli insufficienti per questo orario: ne restano ${metrics.remainingTables}.`
    };
  }

  return { ok: true };
}

function getEventUsageSummary(event) {
  const reservations = state.reservations.filter((item) => item.eventId === event.id);
  const reservationsByTime = event.times.map((time) => {
    const metrics = getAvailabilityMetrics(event, time);
    if (event.capacityMode === "manual") {
      return `${time}: ${metrics.remainingSeats}/${metrics.totalSeats} posti liberi`;
    }
    return `${time}: ${metrics.remainingTables}/${metrics.totalTables} tavoli liberi (${metrics.remainingSeats} posti teorici)`;
  });

  return {
    reservations: reservations.length,
    description: reservationsByTime.join(" • ")
  };
}

function getComposableCapacity(tableSeats, tableCount) {
  if (tableCount <= 0) return 0;
  return (tableSeats * tableCount) - (2 * (tableCount - 1));
}

function getTablesNeeded(tableSeats, guests) {
  let tables = 1;
  while (getComposableCapacity(tableSeats, tables) < guests) {
    tables += 1;
  }
  return tables;
}

function generateReservationCode() {
  let code = "";
  do {
    code = `SAGRA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  } while (state.reservations.some((item) => item.code === code));
  return code;
}

function getEventById(eventId) {
  return state.events.find((event) => event.id === eventId) || null;
}

function getReservationById(reservationId) {
  return state.reservations.find((item) => item.id === reservationId) || null;
}

function formatEventLabel(event) {
  return `${formatLongDate(event.date)} • ${event.name}`;
}

function formatLongDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 3200);
}
