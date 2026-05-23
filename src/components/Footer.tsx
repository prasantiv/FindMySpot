export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="mt-16 border-t border-slate-200 bg-white"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center">
        <p>
          Parking data &copy; OpenStreetMap contributors, licensed under{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-brand-700 hover:underline"
          >
            ODbL
          </a>
          . Street imagery &copy; Mapillary contributors.
        </p>
        <p className="font-medium text-slate-700">
          <span aria-hidden="true">© </span>
          <span className="sr-only">Copyright </span>
          2026 Uplift Sols&trade;
        </p>
      </div>
    </footer>
  );
}
