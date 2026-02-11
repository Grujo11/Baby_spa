"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, formatDateLabel, parseDateOnly } from "@/lib/booking";

type WorkDay = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isClosed: boolean;
  counts: {
    available: number;
    booked: number;
    blocked: number;
  };
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminPanel() {
  const today = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => addDays(today, 6), [today]);
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [formData, setFormData] = useState({
    date: toDateInputValue(today),
    startTime: "09:00",
    endTime: "17:00",
    isClosed: false,
  });
  const [selectedWorkDayId, setSelectedWorkDayId] = useState<string | null>(null);

  async function loadWorkDays() {
    setStatusMessage("");
    const response = await fetch("/api/admin/work-days");
    if (!response.ok) {
      setStatusMessage("Niste autorizovani ili nema pristupa.");
      return;
    }
    const data = await response.json();
    setWorkDays(data.workDays ?? []);
  }

  useEffect(() => {
    loadWorkDays();
  }, []);

  function selectWorkDay(day: WorkDay) {
    setSelectedWorkDayId(day.id);
    setFormData({
      date: day.date,
      startTime: day.startTime ?? "09:00",
      endTime: day.endTime ?? "17:00",
      isClosed: day.isClosed,
    });
  }

  async function handleSaveWorkDay() {
    setStatusMessage("");
    const payload: {
      date: string;
      startTime?: string;
      endTime?: string;
      isClosed: boolean;
    } = {
      date: formData.date,
      isClosed: formData.isClosed,
    };

    if (!formData.isClosed) {
      payload.startTime = formData.startTime;
      payload.endTime = formData.endTime;
    }

    const response = await fetch("/api/admin/work-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setStatusMessage(data.error ?? "Neuspesno cuvanje.");
      return;
    }

    setSelectedWorkDayId(data.id);
    setStatusMessage("Radno vreme sacuvano.");
    await loadWorkDays();
  }

  async function handleGenerateSlots() {
    if (!selectedWorkDayId) {
      setStatusMessage("Prvo sacuvaj radni dan.");
      return;
    }
    setStatusMessage("");
    const response = await fetch(
      `/api/admin/work-days/${selectedWorkDayId}/generate-slots`,
      { method: "POST" }
    );
    const data = await response.json();
    if (!response.ok) {
      setStatusMessage(data.error ?? "Neuspesno generisanje.");
      return;
    }
    setStatusMessage(`Kreirano termina: ${data.createdCount ?? 0}.`);
    await loadWorkDays();
  }

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-10">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <div>
            <h2 className="font-[var(--font-display)] text-3xl uppercase tracking-[0.2em]">
              Admin podesavanja
            </h2>
            <p className="text-sm text-[#9aa2ad]">
              Podesi radno vreme za narednih 7 dana i generisi termine po satu.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1218] p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#9aa2ad]">
                Datum
                <input
                  type="date"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0e141b] px-4 py-3 text-sm text-white"
                  min={toDateInputValue(today)}
                  max={toDateInputValue(maxDate)}
                  value={formData.date}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, date: event.target.value }))
                  }
                />
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-[#9aa2ad]">
                Start
                <input
                  type="time"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0e141b] px-4 py-3 text-sm text-white"
                  value={formData.startTime}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                  disabled={formData.isClosed}
                />
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-[#9aa2ad]">
                End
                <input
                  type="time"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0e141b] px-4 py-3 text-sm text-white"
                  value={formData.endTime}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                  disabled={formData.isClosed}
                />
              </label>
            </div>
            <label className="flex items-center gap-3 text-sm text-[#9aa2ad]">
              <input
                type="checkbox"
                checked={formData.isClosed}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, isClosed: event.target.checked }))
                }
              />
              Neradni dan
            </label>
            <div className="flex flex-col gap-3 md:flex-row">
              <button
                className="flex-1 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[#2b1c12] transition hover:brightness-110"
                onClick={handleSaveWorkDay}
                type="button"
              >
                Sacuvaj
              </button>
              <button
                className="flex-1 rounded-xl border border-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[#2b1c12]"
                onClick={handleGenerateSlots}
                type="button"
              >
                Generisi termine
              </button>
            </div>
            {statusMessage && (
              <p className="text-sm text-[var(--accent)]">{statusMessage}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-[var(--font-display)] text-xl uppercase tracking-[0.2em]">
              Pregled dana
            </h3>
            <button
              className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#9aa2ad]"
              onClick={loadWorkDays}
              type="button"
            >
              Osvezi
            </button>
          </div>
          <div className="space-y-3">
            {workDays.map((day) => {
              const label = formatDateLabel(parseDateOnly(day.date));
              return (
                <button
                  key={day.id}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedWorkDayId === day.id
                      ? "border-[var(--accent)] bg-[#151c24]"
                      : "border-white/10 bg-[#0c1218] hover:border-[var(--accent)]/40"
                  }`}
                  type="button"
                  onClick={() => selectWorkDay(day)}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <span className="text-xs uppercase tracking-[0.2em] text-[#9aa2ad]">
                        {day.isClosed
                          ? "Neradan"
                          : `${day.startTime ?? "--:--"} - ${day.endTime ?? "--:--"}`}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-[#9aa2ad]">
                      <span>Slobodno: {day.counts.available}</span>
                      <span>Rezervisano: {day.counts.booked}</span>
                      <span>Blokirano: {day.counts.blocked}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {!workDays.length && (
              <p className="text-sm text-[#9aa2ad]">Nema podataka za sledecih 7 dana.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
