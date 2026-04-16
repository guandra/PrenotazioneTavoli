const STORAGE_KEY = "sagra-booking-state-v2";
const LEGACY_STORAGE_KEY = "sagra-booking-state-v1";
const ADMIN_SESSION_KEY = "sagra-admin-session-v1";
const ADMIN_CREDENTIALS = { username: "admin", password: "admin" };

const defaultState = {
  events: [],
  reservations: []
};

const page = document.body.dataset.page || "public";
const els = mapElements();
let state = loadState();
let currentLookupReservationId = null;
let toastTimer = null;

init();

function mapElements() {
  return {
    toast: byId("toast"),
    bookingForm: byId("bookingForm"),
    bookingEvent: byId("bookingEvent"),
    bookingTime: byId("bookingTime"),
    bookingSeats: byId("bookingSeats"),
    bookingName: byId("bookingName"),
    bookingPhone: byId("bookingPhone"),
    bookingSummary: byId("bookingSummary"),
    bookingConfirmation: byId("bookingConfirmation"),
    bookingAvailability: byId("bookingAvailability"),
    eventShowcase: byId("eventShowcase"),
    lookupForm: byId("lookupForm"),
    lookupCode: byId("lookupCode"),
    lookupResult: byId("lookupResult"),
    editReservationForm: byId("editReservationForm"),
    editReservationId: byId("editReservationId"),
    editName: byId("editName"),
    editPhone: byId("editPhone"),
    editEvent: byId("editEvent"),
    editTime: byId("editTime"),
    editSeats: byId("editSeats"),
    cancelReservationButton: byId("cancelReservationButton"),
    publicAdminLoginForm: byId("publicAdminLoginForm"),
    publicAdminUsername: byId("publicAdminUsername"),
    publicAdminPassword: byId("publicAdminPassword"),
    adminLoginPanel: byId("adminLoginPanel"),
    adminPanel: byId("adminPanel"),
    adminSessionBadge: byId("adminSessionBadge"),
    adminLoginForm: byId("adminLoginForm"),
    adminUsername: byId("adminUsername"),
    adminPassword: byId("adminPassword"),
    adminLogoutButton: byId("adminLogoutButton"),
    eventForm: byId("eventForm"),
    eventId: byId("eventId"),
    eventName: byId("eventName"),
    eventDate: byId("eventDate"),
    eventTimes: byId("eventTimes"),
    capacityMode: byId("capacityMode"),
    manualCapacityField: byId("manualCapacityField"),
    manualCapacity: byId("manualCapacity"),
    tableSeatsField: byId("tableSeatsField"),
    tableSeats: byId("tableSeats"),
    tableCountField: byId("tableCountField"),
    tableCount: byId("tableCount"),
    resetEventFormButton: byId("resetEventFormButton"),
    eventList: byId("eventList"),
    reservationList: byId("reservationList"),
    adminReservationEventFilter: byId("adminReservationEventFilter"),
    adminReservationSearch: byId("adminReservationSearch"),
    adminReservationForm: byId("adminReservationForm"),
    adminReservationId: byId("adminReservationId"),
    adminReservationName: byId("adminReservationName"),
    adminReservationPhone: byId("adminReservationPhone"),
    adminReservationEvent: byId("adminReservationEvent"),
    adminReservationTime: byId("adminReservationTime"),
    adminReservationSeats: byId("adminReservationSeats"),
    adminReservationDeleteButton: byId("adminReservationDeleteButton")
  };
}

function init() {
  bindSharedEvents();
  if (page === "public") {
    bindPublicPage();
  }
  if (page === "admin") {
    bindAdminPage();
  }
  syncAdminPanel();
  renderAll();
}

function bindSharedEvents() {
  if (els.bookingEvent) {
    els.bookingEvent.addEventListener("change", () => {
      populateTimes("booking");
      renderBookingSummary();
      refreshBookingAvailability();
    });
  }
  if (els.bookingTime) {
    els.bookingTime.addEventListener("change", refreshBookingAvailability);
  }
  if (els.bookingSeats) {
    els.bookingSeats.addEventListener("input", refreshBookingAvailability);
  }
}

function bindPublicPage() {
  els.bookingForm?.addEventListener("submit", handleBookingSubmit);
  els.lookupForm?.addEventListener("submit", handleLookupSubmit);
  els.editEvent?.addEventListener("change", () => populateTimes("edit"));
  els.editReservationForm?.addEventListener("submit", handleEditSubmit);
  els.cancelReservationButton?.addEventListener("click", handleDeleteReservation);
  els.publicAdminLoginForm?.addEventListener("submit", handlePublicAdminLogin);
}

function bindAdminPage() {
  els.adminLoginForm?.addEventListener("submit", handleAdminLogin);
  els.adminLogoutButton?.addEventListener("click", handleAdminLogout);
  els.capacityMode?.addEventListener("change", syncCapacityModeFields);
  els.eventForm?.addEventListener("submit", handleEventSubmit);
  els.resetEventFormButton?.addEventListener("click", resetEventForm);
  els.adminReservationEventFilter?.addEventListener("change", renderReservationList);
  els.adminReservationSearch?.addEventListener("input", renderReservationList);
  els.adminReservationEvent?.addEventListener("change", () => populateTimes("adminReservation"));
  els.adminReservationForm?.addEventListener("submit", handleAdminReservationSubmit);
  els.adminReservationDeleteButton?.addEventListener("click", handleAdminReservationDelete);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);

  try {
    const parsed = JSON.parse(raw);
    const reservations = Array.isArray(parsed.reservations) ? parsed.reservations : [];
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      reservations: reservations.map((reservation) => ({
        phone: reservation.phone || "",
        ...reservation
      }))
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function byId(id) {
  return document.getElementById(id);
}

function isAdminLoggedIn() {
  return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function syncAdminPanel() {
  const loggedIn = isAdminLoggedIn();
  if (els.adminLoginPanel) {
    els.adminLoginPanel.classList.toggle("hidden", loggedIn);
  }
  if (els.adminPanel) {
    els.adminPanel.classList.toggle("hidden", !loggedIn);
  }
  if (els.adminSessionBadge) {
    els.adminSessionBadge.textContent = loggedIn ? "Autenticato" : "Non autenticato";
    els.adminSessionBadge.className = `status-pill ${loggedIn ? "ok" : "neutral"}`;
  }
}

function renderAll() {
  sortEvents();
  saveState();
  renderEventShowcase();
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

function renderEventShowcase() {
  if (!els.eventShowcase) return;

  if (!state.events.length) {
    els.eventShowcase.innerHTML = `<div class="showcase-card muted-card">Le date saranno pubblicate qui appena disponibili.</div>`;
    return;
  }

  els.eventShowcase.innerHTML = state.events.map((event) => {
    const modeText = event.capacityMode === "manual"
      ? `${event.manualCapacity} posti disponibili`
      : `${event.tableCount} tavoli componibili`;

    return `
      <article class="showcase-card">
        <strong>${escapeHtml(event.name)}</strong>
        <span>${escapeHtml(formatLongDate(event.date))}</span>
        <span>Orari: ${escapeHtml(event.times.join(", "))}</span>
        <span>${escapeHtml(modeText)}</span>
      </article>
    `;
  }).join("");
}

function populateEventSelects() {
  const options = state.events.map((event) => optionMarkup(event.id, formatEventLabel(event)));
  if (els.bookingEvent) {
    setSelectOptions(els.bookingEvent, options, "Nessun evento disponibile");
  }
  if (els.editEvent) {
    setSelectOptions(els.editEvent, options, "Nessun evento");
  }
  if (els.adminReservationEvent) {
    setSelectOptions(els.adminReservationEvent, options, "Nessun evento");
  }
  if (els.adminReservationEventFilter) {
    setSelectOptions(
      els.adminReservationEventFilter,
      [`<option value="">Tutti gli eventi</option>`, ...options],
      "Tutti gli eventi"
    );
  }
}

function setSelectOptions(select, options, emptyLabel) {
  if (!select) return;

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
  const eventSelect = target === "booking"
    ? els.bookingEvent
    : target === "adminReservation"
      ? els.adminReservationEvent
      : els.editEvent;
  const timeSelect = target === "booking"
    ? els.bookingTime
    : target === "adminReservation"
      ? els.adminReservationTime
      : els.editTime;
  if (!eventSelect || !timeSelect) return;

  const event = getEventById(eventSelect.value);
  if (!event) {
    setSelectOptions(timeSelect, [], "Nessun orario");
    return;
  }

  const previousValue = timeSelect.value;
  const options = event.times.map((time) => optionMarkup(time, time));
  setSelectOptions(timeSelect, options, "Nessun orario");

  if (event.times.includes(previousValue)) {
    timeSelect.value = previousValue;
  }
}

function renderBookingSummary() {
  if (!els.bookingSummary) return;

  if (!state.events.length) {
    els.bookingSummary.innerHTML = "Nessun evento configurato al momento.";
    return;
  }

  const event = getEventById(els.bookingEvent?.value) || state.events[0];
  if (!event) {
    els.bookingSummary.textContent = "";
    return;
  }

  const modeText = event.capacityMode === "manual"
    ? `Capienza totale: ${event.manualCapacity} posti`
    : `Tavoli componibili: ${event.tableCount} tavoli da ${event.tableSeats} posti base`;

  els.bookingSummary.innerHTML = `
    <strong>${escapeHtml(event.name)}</strong><br>
    ${escapeHtml(formatLongDate(event.date))}<br>
    ${escapeHtml(modeText)}<br>
    Orari disponibili: ${escapeHtml(event.times.join(", "))}
  `;
}

function refreshBookingAvailability() {
  if (!els.bookingAvailability || !els.bookingEvent || !els.bookingTime) return;

  const event = getEventById(els.bookingEvent.value);
  const seatsRequested = Number(els.bookingSeats?.value || 0);
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
  }

  els.bookingAvailability.textContent = message;
  els.bookingAvailability.className = `status-pill ${tone}`;
}

function renderLookupState() {
  if (!els.lookupResult || !els.editReservationForm) return;

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

  els.editReservationId.value = reservation.id;
  els.editName.value = reservation.name;
  els.editPhone.value = reservation.phone || "";
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
    Nome: ${escapeHtml(reservation.name)}<br>
    Telefono: ${escapeHtml(reservation.phone || "-")}<br>
    Posti richiesti: ${reservation.seats}
  `;
}

function renderEventList() {
  if (!els.eventList) return;
  if (page === "admin" && !isAdminLoggedIn()) {
    els.eventList.innerHTML = "";
    return;
  }

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
  if (!els.reservationList) return;
  if (page !== "admin" || !isAdminLoggedIn()) {
    els.reservationList.innerHTML = "";
    return;
  }

  if (!state.reservations.length) {
    els.reservationList.innerHTML = `<div class="stack-card">Nessuna prenotazione registrata.</div>`;
    return;
  }

  const filterEventId = els.adminReservationEventFilter?.value || "";
  const searchTerm = (els.adminReservationSearch?.value || "").trim().toLowerCase();

  const filteredReservations = state.reservations.filter((reservation) => {
    if (filterEventId && reservation.eventId !== filterEventId) {
      return false;
    }
    if (!searchTerm) {
      return true;
    }
    return reservation.name.toLowerCase().includes(searchTerm) || (reservation.phone || "").toLowerCase().includes(searchTerm);
  });

  if (!filteredReservations.length) {
    els.reservationList.innerHTML = `<div class="stack-card">Nessuna prenotazione trovata con i filtri attuali.</div>`;
    return;
  }

  const sortedReservations = [...filteredReservations].sort((a, b) => {
    const eventA = getEventById(a.eventId);
    const eventB = getEventById(b.eventId);
    const dateA = eventA?.date || "9999-12-31";
    const dateB = eventB?.date || "9999-12-31";
    const byDate = dateA.localeCompare(dateB);
    if (byDate !== 0) return byDate;
    return a.time.localeCompare(b.time);
  });

  const grouped = groupReservationsByEvent(sortedReservations);
  els.reservationList.innerHTML = grouped.map(({ event, reservations }) => {
    const title = event ? formatEventLabel(event) : "Evento rimosso";
    return `
      <section class="group-card">
        <div class="group-header">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${reservations.length} prenotazioni</p>
          </div>
        </div>
        <div class="stack-list">
          ${reservations.map((reservation) => {
            const tableInfo = reservation.tablesUsed ? ` • tavoli usati: ${reservation.tablesUsed}` : "";
            return `
              <article class="stack-card">
                <div class="stack-card-header">
                  <div>
                    <h4>${escapeHtml(reservation.name)}</h4>
                    <p>${escapeHtml(reservation.time)} • telefono ${escapeHtml(reservation.phone || "-")}</p>
                  </div>
                  <div class="meta-row">
                    <span class="meta-chip">${reservation.seats} posti${tableInfo}</span>
                    <span class="meta-chip">${escapeHtml(reservation.code)}</span>
                  </div>
                </div>
                <div class="inline-buttons">
                  <button type="button" class="secondary-button" data-action="edit-reservation-admin" data-id="${escapeHtml(reservation.id)}">Modifica</button>
                  <button type="button" class="danger-button" data-action="delete-reservation-admin" data-id="${escapeHtml(reservation.id)}">Cancella</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }).join("");

  bindAdminReservationActions();
}

function bindAdminListActions() {
  document.querySelectorAll("[data-action='edit-event']").forEach((button) => {
    button.addEventListener("click", () => fillEventForm(button.dataset.id));
  });
  document.querySelectorAll("[data-action='delete-event']").forEach((button) => {
    button.addEventListener("click", () => deleteEvent(button.dataset.id));
  });
}

function bindAdminReservationActions() {
  document.querySelectorAll("[data-action='edit-reservation-admin']").forEach((button) => {
    button.addEventListener("click", () => fillAdminReservationForm(button.dataset.id));
  });
  document.querySelectorAll("[data-action='delete-reservation-admin']").forEach((button) => {
    button.addEventListener("click", () => deleteReservationById(button.dataset.id, true));
  });
}

function handleBookingSubmit(event) {
  event.preventDefault();
  const name = els.bookingName.value.trim();
  const phone = normalizePhone(els.bookingPhone.value);
  const eventId = els.bookingEvent.value;
  const time = els.bookingTime.value;
  const seats = Number(els.bookingSeats.value);

  if (!name) return showToast("Inserisci il nome per la prenotazione.");
  if (!phone) return showToast("Inserisci il numero di telefono.");

  const validation = canReserve(eventId, time, seats);
  if (!validation.ok) return showToast(validation.reason);

  const reservation = buildReservation({
    id: crypto.randomUUID(),
    eventId,
    time,
    seats,
    name,
    phone
  });

  state.reservations.push(reservation);
  currentLookupReservationId = reservation.id;
  saveState();
  renderAll();
  els.bookingForm.reset();
  populateEventSelects();
  populateTimes("booking");
  renderBookingSummary();
  refreshBookingAvailability();
  if (els.lookupCode) {
    els.lookupCode.value = reservation.code;
  }
  renderConfirmation(reservation);
  renderLookupState();
  showToast("Prenotazione confermata.");
}

function renderConfirmation(reservation) {
  if (!els.bookingConfirmation) return;
  const event = getEventById(reservation.eventId);
  els.bookingConfirmation.classList.remove("hidden");
  els.bookingConfirmation.innerHTML = `
    <p class="section-kicker">Prenotazione completata</p>
    <h3>Conserva questo codice</h3>
    <div class="confirmation-code">${escapeHtml(reservation.code)}</div>
    <p>
      Memorizzalo: ti servirà per modificare o cancellare la prenotazione e quando ti presenterai all'evento.
    </p>
    <p>
      ${escapeHtml(reservation.name)} • ${escapeHtml(reservation.phone)}<br>
      ${escapeHtml(event ? formatEventLabel(event) : "")} • ${escapeHtml(reservation.time)} • ${reservation.seats} posti
    </p>
  `;
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
  if (!existing) return showToast("Prenotazione non trovata.");

  const name = els.editName.value.trim();
  const phone = normalizePhone(els.editPhone.value);
  const eventId = els.editEvent.value;
  const time = els.editTime.value;
  const seats = Number(els.editSeats.value);

  if (!name) return showToast("Inserisci il nome della prenotazione.");
  if (!phone) return showToast("Inserisci il numero di telefono.");

  const validation = canReserve(eventId, time, seats, reservationId);
  if (!validation.ok) return showToast(validation.reason);

  Object.assign(existing, buildReservation({
    id: existing.id,
    code: existing.code,
    createdAt: existing.createdAt,
    eventId,
    time,
    seats,
    name,
    phone
  }));

  saveState();
  renderAll();
  showToast("Prenotazione aggiornata.");
}

function handleDeleteReservation() {
  const reservationId = els.editReservationId.value;
  deleteReservationById(reservationId, false);
}

function handlePublicAdminLogin(event) {
  event.preventDefault();
  const username = els.publicAdminUsername.value.trim();
  const password = els.publicAdminPassword.value;
  if (!checkAdminCredentials(username, password)) {
    return showToast("Credenziali admin non corrette.");
  }
  localStorage.setItem(ADMIN_SESSION_KEY, "true");
  els.publicAdminLoginForm.reset();
  window.location.href = "admin.html";
}

function handleAdminLogin(event) {
  event.preventDefault();
  const username = els.adminUsername.value.trim();
  const password = els.adminPassword.value;
  if (!checkAdminCredentials(username, password)) {
    return showToast("Credenziali non corrette.");
  }
  localStorage.setItem(ADMIN_SESSION_KEY, "true");
  els.adminLoginForm.reset();
  syncAdminPanel();
  renderAll();
  showToast("Accesso amministratore effettuato.");
}

function handleAdminLogout() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  syncAdminPanel();
  resetAdminReservationForm();
  renderAll();
  showToast("Sessione amministratore chiusa.");
}

function checkAdminCredentials(username, password) {
  return username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
}

function handleEventSubmit(event) {
  event.preventDefault();
  if (!isAdminLoggedIn()) return showToast("Accedi come amministratore per salvare gli eventi.");

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
  if (validationError) return showToast(validationError);

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
  if (!els.capacityMode) return;
  const tables = els.capacityMode.value === "tables";
  els.manualCapacityField?.classList.toggle("hidden", tables);
  els.tableSeatsField?.classList.toggle("hidden", !tables);
  els.tableCountField?.classList.toggle("hidden", !tables);

  if (els.manualCapacity) els.manualCapacity.required = !tables;
  if (els.tableSeats) els.tableSeats.required = tables;
  if (els.tableCount) els.tableCount.required = tables;
}

function resetEventForm() {
  if (!els.eventForm) return;
  els.eventForm.reset();
  els.eventId.value = "";
  els.capacityMode.value = "manual";
  els.tableSeats.value = 4;
  els.tableCount.value = 10;
  syncCapacityModeFields();
}

function fillEventForm(eventId) {
  const event = getEventById(eventId);
  if (!event || !els.eventForm) return;
  els.eventId.value = event.id;
  els.eventName.value = event.name;
  els.eventDate.value = event.date;
  els.eventTimes.value = event.times.join(", ");
  els.capacityMode.value = event.capacityMode;
  els.manualCapacity.value = event.manualCapacity ?? "";
  els.tableSeats.value = event.tableSeats ?? 4;
  els.tableCount.value = event.tableCount ?? 10;
  syncCapacityModeFields();
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  saveState();
  renderAll();
  showToast("Evento eliminato.");
}

function fillAdminReservationForm(reservationId) {
  const reservation = getReservationById(reservationId);
  if (!reservation || !els.adminReservationForm) return;

  els.adminReservationId.value = reservation.id;
  els.adminReservationName.value = reservation.name;
  els.adminReservationPhone.value = reservation.phone || "";
  els.adminReservationEvent.value = reservation.eventId;
  populateTimes("adminReservation");
  els.adminReservationTime.value = reservation.time;
  els.adminReservationSeats.value = reservation.seats;
  els.adminReservationForm.classList.remove("hidden");
  window.scrollTo({ top: els.adminReservationForm.offsetTop - 24, behavior: "smooth" });
}

function resetAdminReservationForm() {
  if (!els.adminReservationForm) return;
  els.adminReservationForm.reset();
  els.adminReservationId.value = "";
  els.adminReservationForm.classList.add("hidden");
}

function handleAdminReservationSubmit(event) {
  event.preventDefault();
  const reservationId = els.adminReservationId.value;
  const existing = getReservationById(reservationId);
  if (!existing) return showToast("Prenotazione non trovata.");

  const name = els.adminReservationName.value.trim();
  const phone = normalizePhone(els.adminReservationPhone.value);
  const eventId = els.adminReservationEvent.value;
  const time = els.adminReservationTime.value;
  const seats = Number(els.adminReservationSeats.value);

  if (!name) return showToast("Inserisci il nome della prenotazione.");
  if (!phone) return showToast("Inserisci il numero di telefono.");

  const validation = canReserve(eventId, time, seats, reservationId);
  if (!validation.ok) return showToast(validation.reason);

  Object.assign(existing, buildReservation({
    id: existing.id,
    code: existing.code,
    createdAt: existing.createdAt,
    eventId,
    time,
    seats,
    name,
    phone
  }));

  saveState();
  renderAll();
  showToast("Prenotazione aggiornata dall'admin.");
}

function handleAdminReservationDelete() {
  const reservationId = els.adminReservationId.value;
  deleteReservationById(reservationId, true);
}

function deleteReservationById(reservationId, fromAdmin) {
  const existing = getReservationById(reservationId);
  if (!existing) return showToast("Prenotazione non trovata.");

  if (!window.confirm(`Vuoi cancellare la prenotazione ${existing.code}?`)) return;

  state.reservations = state.reservations.filter((item) => item.id !== reservationId);
  if (currentLookupReservationId === reservationId) {
    currentLookupReservationId = null;
  }
  saveState();
  renderAll();

  if (fromAdmin) {
    resetAdminReservationForm();
  } else if (els.lookupResult) {
    els.lookupResult.classList.add("empty");
    els.lookupResult.textContent = "Prenotazione cancellata.";
  }
  showToast("Prenotazione cancellata.");
}

function groupReservationsByEvent(reservations) {
  const groups = new Map();
  for (const reservation of reservations) {
    const key = reservation.eventId || "missing";
    if (!groups.has(key)) {
      groups.set(key, {
        event: getEventById(reservation.eventId),
        reservations: []
      });
    }
    groups.get(key).reservations.push(reservation);
  }
  return [...groups.values()];
}

function validateEventPayload(payload) {
  if (!payload.name) return "Inserisci un nome evento.";
  if (!payload.date) return "Seleziona la data dell'evento.";
  if (!payload.times.length) return "Inserisci almeno un orario valido.";

  if (payload.capacityMode === "manual" && (!Number.isInteger(payload.manualCapacity) || payload.manualCapacity <= 0)) {
    return "I posti disponibili devono essere maggiori di zero.";
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

    const usedTables = reservationsAtTime.reduce((sum, item) => sum + getTablesNeeded(payload.tableSeats, item.seats), 0);
    if (reservationsAtTime.some((item) => getTablesNeeded(payload.tableSeats, item.seats) > payload.tableCount)) {
      return `Almeno una prenotazione alle ${time} non entra nella nuova configurazione tavoli.`;
    }
    if (usedTables > payload.tableCount) {
      return `Tavoli insufficienti alle ${time} per le prenotazioni già registrate.`;
    }
  }

  return "";
}

function buildReservation({ id, code, createdAt, eventId, time, seats, name, phone }) {
  const event = getEventById(eventId);
  const tablesUsed = event?.capacityMode === "tables" ? getTablesNeeded(event.tableSeats, seats) : null;
  return {
    id,
    code: code || generateReservationCode(),
    createdAt: createdAt || new Date().toISOString(),
    eventId,
    time,
    seats,
    name,
    phone,
    tablesUsed
  };
}

function getAvailabilityMetrics(event, time, reservationIdToIgnore = null) {
  const reservations = state.reservations.filter((item) =>
    item.eventId === event.id && item.time === time && item.id !== reservationIdToIgnore
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
    remainingTables: Math.max(0, event.tableCount - usedTables)
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
    return seats > metrics.remainingSeats
      ? { ok: false, reason: `Posti insufficienti: ne restano ${metrics.remainingSeats}.` }
      : { ok: true };
  }

  const tablesNeeded = getTablesNeeded(event.tableSeats, seats);
  if (tablesNeeded > event.tableCount) {
    return { ok: false, reason: `Richiesta troppo grande: servirebbero ${tablesNeeded} tavoli, ma l'evento ne ha ${event.tableCount}.` };
  }

  const metrics = getAvailabilityMetrics(event, time, reservationIdToIgnore);
  return tablesNeeded > metrics.remainingTables
    ? { ok: false, reason: `Tavoli insufficienti per questo orario: ne restano ${metrics.remainingTables}.` }
    : { ok: true };
}

function getEventUsageSummary(event) {
  const reservations = state.reservations.filter((item) => item.eventId === event.id);
  const description = event.times.map((time) => {
    const metrics = getAvailabilityMetrics(event, time);
    return event.capacityMode === "manual"
      ? `${time}: ${metrics.remainingSeats}/${metrics.totalSeats} posti liberi`
      : `${time}: ${metrics.remainingTables}/${metrics.totalTables} tavoli liberi`;
  }).join(" • ");

  return {
    reservations: reservations.length,
    description
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

function normalizeTimes(value) {
  return [...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => /^\d{1,2}:\d{2}$/.test(item))
      .map((item) => item.padStart(5, "0"))
  )].sort();
}

function normalizePhone(value) {
  return value.trim();
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

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 3200);
}
