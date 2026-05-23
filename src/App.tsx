import { useCallback, useRef, useState } from 'react';
import type { SearchResponse } from '@shared/types';
import { AddressForm } from './components/AddressForm';
import { Footer } from './components/Footer';
import { ResultsGrid, ResultsGridSkeleton } from './components/ResultsGrid';
import { StatusBanner } from './components/StatusBanner';
import { search, ApiError } from './lib/api';
import { logger } from './lib/logger';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: SearchResponse }
  | { kind: 'error'; message: string };

export default function App() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const handleSearch = useCallback(async (address: string) => {
    setStatus({ kind: 'loading' });
    try {
      const data = await search(address);
      setStatus({ kind: 'ready', data });
      // Move keyboard focus to the results region for screen-reader users.
      requestAnimationFrame(() => resultsRef.current?.focus());
    } catch (err) {
      logger.error('search_failed', { err: (err as Error).message });
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Something went wrong while searching. Please try again.';
      setStatus({ kind: 'error', message: msg });
    }
  }, []);

  const isLoading = status.kind === 'loading';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-600 text-lg font-bold text-white"
            >
              ♿
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">FindMySpot</h1>
              <p className="text-xs text-slate-500">ADA parking · Portland, OR</p>
            </div>
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12"
      >
        <section aria-labelledby="search-heading" className="rounded-lg bg-white p-5 shadow-sm sm:p-8">
          <h2 id="search-heading" className="sr-only">
            Search for ADA parking
          </h2>
          <AddressForm onSubmit={handleSearch} disabled={isLoading} />
        </section>

        <section
          aria-labelledby="results-heading"
          className="mt-8 scroll-mt-8 focus:outline-none"
          ref={resultsRef}
          tabIndex={-1}
        >
          <h2 id="results-heading" className="sr-only">
            Search results
          </h2>

          {status.kind === 'idle' && (
            <p className="text-sm text-slate-500">
              Enter an address above to see the 5 closest ADA-accessible parking spots.
            </p>
          )}

          {status.kind === 'loading' && (
            <>
              <StatusBanner variant="info" title="Searching OpenStreetMap and verifying signage…">
                This can take a few seconds while we query nearby spots and run sign detection.
              </StatusBanner>
              <div className="mt-4">
                <ResultsGridSkeleton />
              </div>
            </>
          )}

          {status.kind === 'error' && (
            <StatusBanner variant="error" title="We couldn't complete that search">
              {status.message}
            </StatusBanner>
          )}

          {status.kind === 'ready' && (
            <>
              <StatusBanner
                variant="info"
                title={`Closest ADA spots near ${status.data.geocoded.displayName}`}
              >
                {status.data.spots.length} result{status.data.spots.length === 1 ? '' : 's'} ·{' '}
                {status.data.detectionAttempted
                  ? 'street-imagery verification attempted'
                  : 'OSM tags only (no detection keys configured)'}
              </StatusBanner>
              {status.data.geocoded.confidence === 'approximate' && (
                <div className="mt-3">
                  <StatusBanner
                    variant="warn"
                    title="Address only resolved approximately"
                  >
                    Google matched your query to a neighbourhood or block, not a specific building.
                    Distances are calculated from that point and may be off by 100&nbsp;m or more.
                    Try a more specific address for a tighter match.
                  </StatusBanner>
                </div>
              )}
              <div className="mt-4">
                <ResultsGrid spots={status.data.spots} origin={status.data.geocoded.location} />
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
