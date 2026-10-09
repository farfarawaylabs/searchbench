import { Link, Outlet } from "@tanstack/react-router";

export function Shell() {
  return (
    <div className="min-h-screen bg-white text-ink">
      {/* backdrop washes from the design system */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-orange-100/30 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent to-cream/60" />
      </div>
      <header className="sticky top-0 z-10 border-b border-white glass">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
              S
            </span>
            <span className="text-[15px] font-semibold tracking-tight">SearchBench</span>
          </Link>
          <nav className="ml-6 flex items-center gap-1 text-sm">
            <Link
              to="/"
              className="rounded-full px-3 py-1.5 text-muted-ink hover:bg-mist/60 hover:text-ink [&.active]:bg-ink [&.active]:text-white"
            >
              Compare
            </Link>
            <Link
              to="/history"
              className="rounded-full px-3 py-1.5 text-muted-ink hover:bg-mist/60 hover:text-ink [&.active]:bg-ink [&.active]:text-white"
            >
              History
            </Link>
            <Link
              to="/settings"
              className="rounded-full px-3 py-1.5 text-muted-ink hover:bg-mist/60 hover:text-ink [&.active]:bg-ink [&.active]:text-white"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="relative z-0 mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="relative mx-auto w-full max-w-6xl px-4 pb-10 text-xs font-light text-muted-ink">
        SearchBench · single-user tool · keys stay in Worker secrets
      </footer>
    </div>
  );
}
