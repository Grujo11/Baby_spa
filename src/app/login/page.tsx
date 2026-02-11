import Link from "next/link";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { sent?: string; error?: string };
}) {
  const statusMessage = searchParams.sent
    ? "Link je poslat. Proveri mejl."
    : searchParams.error
      ? "Neispravan email. Pokusaj ponovo."
      : "";

  return (
    <div className="hero-shell min-h-screen">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-5 py-12 md:px-10">
        <div className="glass-panel rounded-3xl p-8 md:p-12">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-[#9aa2ad]">
                Baby Spa
              </p>
              <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-[0.2em] text-white">
                Prijava
              </h1>
            </div>
            <p className="text-sm text-[#b9a89a]">
              Unesi mejl. Stize link za potvrdu naloga ili prijavu. Nakon toga
              ostajes ulogovan i vracas se na pocetnu stranu.
            </p>
            <LoginForm />
            {statusMessage && (
              <p className="text-sm text-[var(--accent)]">{statusMessage}</p>
            )}
            <Link
              className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]"
              href="/"
            >
              Nazad na rezervacije
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function LoginForm() {
  return (
    <form
      className="space-y-4"
      action="/api/auth/request-access"
      method="POST"
    >
      <input
        type="email"
        name="email"
        required
        className="w-full rounded-xl border border-white/10 bg-[#0e141b] px-4 py-3 text-sm text-white"
        placeholder="mejl@primer.com"
      />
      <button
        className="w-full rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[#2b1c12] transition hover:brightness-110"
        type="submit"
      >
        Posalji link
      </button>
    </form>
  );
}
