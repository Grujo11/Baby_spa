import AdminPanel from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <div className="hero-shell min-h-screen">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-5 py-10 md:px-10 md:py-16">
        <header className="flex flex-col gap-6 text-center md:text-left">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.5em] text-[#9aa2ad]">
              Baby Spa
            </p>
            <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-[0.2em] text-white md:text-5xl">
              Admin <span className="accent-text">Panel</span>
            </h1>
          </div>
          <p className="max-w-2xl text-base text-[#cbd3dd] md:text-lg">
            Postavi radno vreme i generisi termine po satu.
          </p>
        </header>

        <AdminPanel />
      </main>
    </div>
  );
}
