const dateSelect = document.getElementById("dateSelect");
const dateLabel = document.getElementById("dateLabel");
const slotsGrid = document.getElementById("slotsGrid");
const slotsMessage = document.getElementById("slotsMessage");
const selectedSlotLabel = document.getElementById("selectedSlotLabel");
const formSlotLabel = document.getElementById("formSlotLabel");
const emptyState = document.getElementById("emptyState");
const reservationForm = document.getElementById("reservationForm");
const reserveButton = document.getElementById("reserveButton");
const reservationMessage = document.getElementById("reservationMessage");
const accountEmail = document.getElementById("accountEmail");
const accountMessage = document.getElementById("accountMessage");
const firstNameInput = document.getElementById("firstName");
const lastNameInput = document.getElementById("lastName");
const phoneInput = document.getElementById("phone");
const babyNameInput = document.getElementById("babyName");
const babyAgeMonthsInput = document.getElementById("babyAgeMonths");
const notesInput = document.getElementById("notes");
const logoutBtn = document.getElementById("logoutBtn");

const state = {
  selectedSlot: null,
  selectedDate: "",
  selectedButton: null,
};

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateOptions() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const weekdayFormatter = new Intl.DateTimeFormat("sr-RS", { weekday: "long" });
  const fullFormatter = new Intl.DateTimeFormat("sr-RS", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return {
      value: toDateInputValue(date),
      label: index === 0 ? "Danas" : capitalize(weekdayFormatter.format(date)),
      full: capitalize(fullFormatter.format(date)),
    };
  });
}

function showReservationForm(slot) {
  state.selectedSlot = slot;
  if (state.selectedButton) state.selectedButton.classList.remove("active");
  state.selectedButton = slot.button;
  state.selectedButton.classList.add("active");
  selectedSlotLabel.textContent = `Izabran: ${slot.startTime}`;
  formSlotLabel.textContent = `Termin: ${slot.startTime}`;
  emptyState.classList.add("hidden");
  reservationForm.classList.remove("hidden");
  reservationMessage.textContent = "";
}

function resetSelection() {
  state.selectedSlot = null;
  if (state.selectedButton) state.selectedButton.classList.remove("active");
  state.selectedButton = null;
  selectedSlotLabel.textContent = "";
  formSlotLabel.textContent = "";
  emptyState.classList.remove("hidden");
  reservationForm.classList.add("hidden");
}

async function loadProfile() {
  const response = await fetch("/api/me");
  if (response.status === 401) {
    window.location.href = "/login";
    return null;
  }

  const data = await response.json();
  if (String(data.role || "").toUpperCase() === "ADMIN") {
    window.location.href = "/admin";
    return null;
  }
  accountEmail.textContent = data.email;
  accountMessage.textContent = "Profil se cuva automatski.";
  firstNameInput.value = data.firstName || "";
  lastNameInput.value = data.lastName || "";
  phoneInput.value = data.phone || "";
  return data;
}

async function loadSlots(dateValue) {
  slotsMessage.textContent = "Ucitavanje termina...";
  slotsGrid.innerHTML = "";
  resetSelection();

  try {
    const response = await fetch(`/api/slots?date=${dateValue}`);
    const data = await response.json();
    if (!response.ok) {
      slotsMessage.textContent = data.error || "Ne mogu da ucitam termine.";
      return;
    }

    const slots = data.slots || [];
    if (!slots.length) {
      if (data.availability === "CLOSED") {
        slotsMessage.textContent = "Ovaj dan je neradan.";
      } else if (data.availability === "NOT_CONFIGURED") {
        slotsMessage.textContent = "Termini jos nisu dostupni za taj dan.";
      } else {
        slotsMessage.textContent = "Nema slobodnih termina.";
      }
      return;
    }

    slotsMessage.textContent = "";
    slots.forEach((slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-btn";
      button.textContent = slot.startTime;
      button.addEventListener("click", () => showReservationForm({ ...slot, button }));
      slotsGrid.appendChild(button);
    });
  } catch (error) {
    slotsMessage.textContent = "Ne mogu da ucitam termine.";
  }
}

async function handleReservation(event) {
  event.preventDefault();
  reservationMessage.textContent = "";

  if (!state.selectedSlot) {
    reservationMessage.textContent = "Izaberi termin.";
    return;
  }

  const payload = {
    slotId: state.selectedSlot.id,
    firstName: firstNameInput.value.trim(),
    lastName: lastNameInput.value.trim(),
    phone: phoneInput.value.trim(),
    babyName: babyNameInput.value.trim(),
    babyAgeMonths: babyAgeMonthsInput.value.trim(),
    notes: notesInput.value.trim(),
  };

  reserveButton.disabled = true;

  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      reservationMessage.textContent = data.error || "Neuspela rezervacija.";
      return;
    }

    reservationMessage.textContent = "Termin je rezervisan. Proveri mejl.";
    await loadSlots(state.selectedDate);
  } catch (error) {
    reservationMessage.textContent = "Neuspela rezervacija.";
  } finally {
    reserveButton.disabled = false;
  }
}

function initDates() {
  const options = buildDateOptions();
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    item.dataset.full = option.full;
    dateSelect.appendChild(item);
  });

  const first = options[0];
  if (first) {
    state.selectedDate = first.value;
    dateSelect.value = first.value;
    dateLabel.textContent = first.full;
  }

  dateSelect.addEventListener("change", (event) => {
    const value = event.target.value;
    const selectedOption = event.target.selectedOptions[0];
    state.selectedDate = value;
    dateLabel.textContent = selectedOption?.dataset.full || "";
    loadSlots(value);
  });

  if (state.selectedDate) {
    loadSlots(state.selectedDate);
  }
}

reservationForm.addEventListener("submit", handleReservation);

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  });
}

loadProfile().then(() => initDates());
