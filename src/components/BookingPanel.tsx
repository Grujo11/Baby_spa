"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, formatDateLabel, parseDateOnly, startOfDay } from "@/lib/booking";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
};

type UserProfile = {
  email: string;
  emailVerifiedAt?: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function BookingPanel() {
  const today = useMemo(() => new Date(), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(today));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsMessage, setSlotsMessage] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    notes: "",
  });
  const [reservationMessage, setReservationMessage] = useState("");
  const canReserve = Boolean(profile?.email);

  useEffect(() => {
    fetch("/api/me")
      .then(async (res) => {
        if (res.ok) return res.json();
        if (res.status === 401) {
          setAuthMessage("Prijavi se preko email linka.");
        }
        return null;
      })
      .then((data) => {
        if (!data) return;
        setProfile(data);
        setFormData((prev) => ({
          ...prev,
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          phone: data.phone ?? "",
        }));
      })
      .catch(() => setAuthMessage("Ne mogu da ucitam profil."));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSlotsMessage("Ucitavanje termina...");
    setSlots([]);
    setSelectedSlot(null);

    fetch(`/api/slots?date=${selectedDate}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setSlotsMessage(data.slots?.length ? "" : "Nema slobodnih termina.");
      })
      .catch(() => {
        setSlotsMessage("Nije moguce ucitati termine.");
      });

    return () => controller.abort();
  }, [selectedDate]);

  async function handleReservation() {
    setReservationMessage("");
    if (!selectedSlot) {
      setReservationMessage("Izaberi termin.");
      return;
    }

    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotId: selectedSlot.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        notes: formData.notes,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setReservationMessage(data.error ?? "Neuspela rezervacija.");
      return;
    }

    setReservationMessage("Termin je rezervisan. Proveri mejl za potvrdu.");
    setSelectedSlot(null);
    fetch(`/api/slots?date=${selectedDate}`)
      .then((res) => res.json())
      .then((updated) => setSlots(updated.slots ?? []))
      .catch(() => undefined);
  }

  const selectedDateLabel = useMemo(() => {
    return formatDateLabel(parseDateOnly(selectedDate));
  }, [selectedDate]);

  const dateOptions = useMemo(() => {
    const base = startOfDay(new Date());
    const weekdayFormatter = new Intl.DateTimeFormat("sr-RS", { weekday: "long" });
    const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(base, index);
      return {
        value: toDateInputValue(date),
        label: index === 0 ? "Danas" : cap(weekdayFormatter.format(date)),
      };
    });
  }, []);

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[#cbd3dd]">
            Rezervacije za dan
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-xs">
              <select
                className="w-full appearance-none rounded-xl border border-white/10 bg-[#0e141b] px-4 py-3 text-sm text-[#f5f1e8] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/60"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              >
                {dateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#b9a89a]">
                ▼
              </span>
            </div>
            <span className="text-sm text-[#b9a89a]">{selectedDateLabel}</span>
          </div>
          <p className="text-xs text-[#9aa2ad]">
            Termini su dostupni za sledecih 7 dana.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="font-[var(--font-display)] text-2xl uppercase tracking-[0.2em]">
            Slobodni termini
          </h3>
          {selectedSlot && (
            <span className="text-sm text-[var(--accent)]">
              Izabran: {selectedSlot.startTime}
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {slots.map((slot) => (
            <button
              key={slot.id}
              className={`rounded-xl border px-4 py-3 text-sm transition ${
                selectedSlot?.id === slot.id
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[#2b1c12]"
                  : "border-white/10 bg-[#0e141b] text-[#f5f1e8] hover:border-[var(--accent)]/60"
              }`}
              onClick={() => setSelectedSlot(slot)}
              type="button"
            >
              {slot.startTime}
            </button>
          ))}
        </div>
        {slotsMessage && <p className="text-sm text-[#9aa2ad]">{slotsMessage}</p>}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {selectedSlot ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-[var(--font-display)] text-2xl uppercase tracking-[0.2em]">
                  Podaci za rezervaciju
                </h3>
                <span className="text-sm text-[var(--accent)]">
                  Termin: {selectedSlot.startTime}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-xl border border-white/10 bg-[#0e141b] px-4 py-3 text-sm text-white"
                  placeholder="Ime"
                  value={formData.firstName}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, firstName: event.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-white/10 bg-[#0e141b] px-4 py-3 text-sm text-white"
                  placeholder="Prezime"
                  value={formData.lastName}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, lastName: event.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-white/10 bg-[#0e141b] px-4 py-3 text-sm text-white"
                  placeholder="Telefon"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, phone: event.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-white/10 bg-[#0e141b] px-4 py-3 text-sm text-white"
                  placeholder="Napomena (opciono)"
                  value={formData.notes}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </div>
              <button
                className={`w-full rounded-xl px-6 py-3 text-sm font-semibold transition ${
                  canReserve
                    ? "bg-[var(--accent)] text-[#2b1c12] hover:brightness-110"
                    : "cursor-not-allowed bg-[#2a2f36] text-[#9aa2ad]"
                }`}
                onClick={handleReservation}
                type="button"
                disabled={!canReserve}
              >
                Rezervisi termin
              </button>
              {reservationMessage && (
                <p className="text-sm text-[var(--accent)]">{reservationMessage}</p>
              )}
              {!canReserve && (
                <p className="text-xs text-[#9aa2ad]">
                  Prijavi se preko mejla da bi mogao da rezervises.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0c1218] p-5">
              <h3 className="font-[var(--font-display)] text-xl uppercase tracking-[0.2em]">
                Izaberi termin
              </h3>
              <p className="text-sm text-[#9aa2ad]">
                Klikni na termin da se pojavi forma za rezervaciju.
              </p>
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1218] p-5">
            <h3 className="font-[var(--font-display)] text-xl uppercase tracking-[0.2em]">
              Nalog
            </h3>
            {profile?.email ? (
              <div className="space-y-2 text-sm text-[#b9a89a]">
                <p>Ulogovan si kao:</p>
                <p className="text-base text-white">{profile.email}</p>
                <p className="text-xs text-[#9aa2ad]">Profil se cuva automatski.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#9aa2ad]">
                  Prijavi se preko mejla da bi rezervisao termin.
                </p>
                <Link
                  className="block rounded-xl border border-[var(--accent)] px-6 py-3 text-center text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[#2b1c12]"
                  href="/login"
                >
                  Idi na prijavu
                </Link>
              </div>
            )}
            {authMessage && <p className="text-xs text-[#9aa2ad]">{authMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
