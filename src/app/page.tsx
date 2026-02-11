"use client";

import { useEffect, useState } from "react";
import BookingPanel from "@/components/BookingPanel";

export default function Home() {
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (res.ok) return res.json();
        if (res.status === 401) {
          window.location.href = "/login";
        }
        return null;
      })
      .then(() => setStatus("ready"))
      .catch(() => setStatus("ready"));
  }, []);

  if (status === "loading") {
    return (
      <div className="hero-shell min-h-screen">
        <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-5 py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-[#b9a89a]">
            Ucitavanje...
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="hero-shell min-h-screen">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-5 py-10 md:px-10 md:py-16">
        <header className="flex flex-col gap-6 text-center md:text-left">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.5em] text-[#9aa2ad]">
              Baby Spa
            </p>
            <h1 className="font-[var(--font-display)] text-5xl uppercase tracking-[0.2em] text-white md:text-6xl">
              Rezervacije
              <span className="accent-text"> Termina</span>
            </h1>
          </div>
          <p className="max-w-2xl text-base text-[#e6d7c9] md:text-lg">
            Izaberi dan i termin. Email potvrda stize odmah, a podsetnik stize 2
            sata pre zakazanog termina.
          </p>
        </header>

        <BookingPanel />
      </main>
    </div>
  );
}
