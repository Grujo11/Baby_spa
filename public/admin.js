const adminEmail = document.getElementById("adminEmail");
const workDayForm = document.getElementById("workDayForm");
const formMessage = document.getElementById("formMessage");
const daysList = document.getElementById("daysList");
const daysMessage = document.getElementById("daysMessage");
const refreshBtn = document.getElementById("refreshBtn");
const startTimeInput = document.getElementById("startTime");
const endTimeInput = document.getElementById("endTime");
const isClosedInput = document.getElementById("isClosed");

const reservationsDateInput = document.getElementById("reservationsDate");
const clearReservationsDateBtn = document.getElementById("clearReservationsDateBtn");
const refreshReservationsBtn = document.getElementById("refreshReservationsBtn");
const reservationsList = document.getElementById("reservationsList");
const reservationsMessage = document.getElementById("reservationsMessage");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

function formatDateLabel(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue || "");
  const formatter = new Intl.DateTimeFormat("sr-RS", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const value = formatter.format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTimeLabel(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatWorkTime(startTime, endTime, isClosed) {
  if (isClosed) return "Neradni dan";
  if (!startTime || !endTime) return "Radno vreme nije postavljeno";
  return `${String(startTime).slice(0, 5)} - ${String(endTime).slice(0, 5)}`;
}

function toMinutes(value) {
  if (!value) return null;
  const parts = String(value).split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function updateTimeInputsState() {
  const closed = isClosedInput.checked;
  startTimeInput.disabled = closed;
  endTimeInput.disabled = closed;
  if (closed) {
    startTimeInput.value = "";
    endTimeInput.value = "";
  }
}

async function loadProfile() {
  const response = await fetch("/api/me");
  if (response.status === 401) {
    window.location.href = "/login";
    return false;
  }

  const data = await response.json();
  if (String(data.role || "").toUpperCase() !== "ADMIN") {
    window.location.href = "/";
    return false;
  }

  adminEmail.textContent = data.email;
  return true;
}

async function requestGenerateSlots(dayId) {
  const response = await fetch(`/api/admin/work-days/${dayId}/generate-slots`, {
    method: "POST",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Greska pri generisanju termina.");
  }
  return data.created || 0;
}

function renderDays(workDays) {
  daysList.innerHTML = "";

  if (!workDays.length) {
    daysMessage.textContent = "Nema unetih radnih dana.";
    return;
  }

  daysMessage.textContent = "";

  for (const day of workDays) {
    const row = document.createElement("div");
    row.className = "card";

    const rowTop = document.createElement("div");
    rowTop.className = "row";
    rowTop.style.justifyContent = "space-between";

    const left = document.createElement("div");
    const title = document.createElement("p");
    title.style.margin = "0 0 6px 0";
    title.style.fontWeight = "600";
    title.textContent = formatDateLabel(day.work_date);

    const meta = document.createElement("p");
    meta.className = "muted";
    meta.style.margin = "0";
    meta.textContent = `${formatWorkTime(day.start_time, day.end_time, day.is_closed)} | Slotovi: ${Number(day.slot_count || 0)}`;

    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    const generateButton = document.createElement("button");
    generateButton.className = "button secondary";
    generateButton.type = "button";
    generateButton.textContent = "Generisi termine";
    generateButton.disabled = day.is_closed || !day.start_time || !day.end_time;

    generateButton.addEventListener("click", async () => {
      generateButton.disabled = true;
      const oldText = generateButton.textContent;
      generateButton.textContent = "Generisem...";

      try {
        const created = await requestGenerateSlots(day.id);
        alert(`Generisano: ${created} termina.`);
        await Promise.all([loadWorkDays(), loadReservations()]);
      } catch (error) {
        alert(error.message || "Greska pri generisanju.");
      } finally {
        generateButton.disabled = false;
        generateButton.textContent = oldText;
      }
    });

    right.appendChild(generateButton);
    rowTop.appendChild(left);
    rowTop.appendChild(right);
    row.appendChild(rowTop);
    daysList.appendChild(row);
  }
}

function renderReservations(reservations) {
  reservationsList.innerHTML = "";

  if (!reservations.length) {
    reservationsMessage.textContent = "Nema rezervacija za izabrani period.";
    return;
  }

  reservationsMessage.textContent = "";

  for (const reservation of reservations) {
    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("p");
    title.style.margin = "0 0 8px 0";
    title.style.fontWeight = "600";
    title.textContent = `${formatDateLabel(reservation.work_date)} u ${formatTimeLabel(reservation.start_time)}`;

    const status = document.createElement("p");
    status.className = "muted";
    status.style.margin = "0 0 6px 0";
    status.textContent = `Status: ${reservation.status}`;

    const nameLine = document.createElement("p");
    nameLine.className = "muted";
    nameLine.style.margin = "0 0 4px 0";
    nameLine.textContent = `Roditelj: ${reservation.first_name} ${reservation.last_name} | Tel: ${reservation.phone}`;

    const babyLine = document.createElement("p");
    babyLine.className = "muted";
    babyLine.style.margin = "0 0 4px 0";
    babyLine.textContent = `Beba: ${reservation.baby_name || "-"} | ${reservation.baby_age_months ?? "-"} meseci`;

    const emailLine = document.createElement("p");
    emailLine.className = "muted";
    emailLine.style.margin = "0 0 4px 0";
    emailLine.textContent = `Email: ${reservation.email}`;

    const notesLine = document.createElement("p");
    notesLine.className = "muted";
    notesLine.style.margin = "0";
    notesLine.textContent = `Napomena: ${reservation.notes || "-"}`;

    card.appendChild(title);
    card.appendChild(status);
    card.appendChild(nameLine);
    card.appendChild(babyLine);
    card.appendChild(emailLine);
    card.appendChild(notesLine);
    reservationsList.appendChild(card);
  }
}

async function loadWorkDays() {
  daysMessage.textContent = "Ucitavanje...";
  try {
    const response = await fetch("/api/admin/work-days");
    const data = await response.json();

    if (!response.ok) {
      daysMessage.textContent = data.error || "Ne mogu da ucitam dane.";
      return;
    }

    renderDays(data.workDays || []);
  } catch (error) {
    daysMessage.textContent = "Ne mogu da ucitam dane.";
  }
}

async function loadReservations() {
  reservationsMessage.textContent = "Ucitavanje rezervacija...";
  reservationsList.innerHTML = "";

  const date = reservationsDateInput.value;
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  try {
    const response = await fetch(`/api/admin/reservations${query}`);
    const data = await response.json();

    if (!response.ok) {
      reservationsMessage.textContent = data.error || "Ne mogu da ucitam rezervacije.";
      return;
    }

    renderReservations(data.reservations || []);
  } catch (error) {
    reservationsMessage.textContent = "Ne mogu da ucitam rezervacije.";
  }
}

workDayForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  const isClosed = isClosedInput.checked;
  const workDate = document.getElementById("workDate").value;
  const startTime = startTimeInput.value || null;
  const endTime = endTimeInput.value || null;

  if (!workDate) {
    formMessage.textContent = "Izaberi datum.";
    return;
  }

  if (!isClosed) {
    if (!startTime || !endTime) {
      formMessage.textContent = "Unesi pocetak i kraj radnog vremena.";
      return;
    }

    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      formMessage.textContent = "Kraj mora biti posle pocetka.";
      return;
    }
  }

  const payload = {
    workDate,
    startTime,
    endTime,
    isClosed,
  };

  try {
    const response = await fetch("/api/admin/work-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      formMessage.textContent = data.error || "Neuspesno cuvanje.";
      return;
    }

    let message = "Dan je sacuvan.";
    if (!isClosed && data.workDay?.id) {
      try {
        const created = await requestGenerateSlots(data.workDay.id);
        message += ` Generisano: ${created} termina.`;
      } catch (error) {
        message += ` ${error.message || "Generisanje termina nije uspelo."}`;
      }
    }

    formMessage.textContent = message;
    await Promise.all([loadWorkDays(), loadReservations()]);
  } catch (error) {
    formMessage.textContent = "Neuspesno cuvanje.";
  }
});

isClosedInput.addEventListener("change", updateTimeInputsState);
refreshBtn.addEventListener("click", () => {
  loadWorkDays();
});
refreshReservationsBtn.addEventListener("click", () => {
  loadReservations();
});
clearReservationsDateBtn.addEventListener("click", () => {
  reservationsDateInput.value = "";
  loadReservations();
});
reservationsDateInput.addEventListener("change", () => {
  loadReservations();
});

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  });
}

(async () => {
  const ok = await loadProfile();
  if (!ok) return;
  updateTimeInputsState();
  await Promise.all([loadWorkDays(), loadReservations()]);
})();
