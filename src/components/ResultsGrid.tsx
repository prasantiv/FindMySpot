import type { ParkingSpot } from '@shared/types';
import { ParkingCard } from './ParkingCard';

interface ResultsGridProps {
  spots: ParkingSpot[];
  origin: { lat: number; lng: number };
}

export function ResultsGrid({ spots, origin }: ResultsGridProps) {
  if (spots.length === 0) {
    return (
      <div
        role="status"
        className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900"
      >
        <p className="font-medium">No ADA parking found nearby.</p>
        <p className="mt-1 text-sm">
          OpenStreetMap doesn&rsquo;t list any accessible parking near this address. Try a different
          starting point or contribute the data at{' '}
          <a
            href="https://www.openstreetmap.org/"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline"
          >
            openstreetmap.org
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <ul
      role="list"
      aria-label={`${spots.length} closest ADA accessible parking spots`}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {spots.map((spot, idx) => (
        <li key={spot.id}>
          <ParkingCard
            spot={spot}
            rank={idx + 1}
            originLat={origin.lat}
            originLng={origin.lng}
          />
        </li>
      ))}
    </ul>
  );
}

export function ResultsGridSkeleton() {
  return (
    <ul
      role="status"
      aria-label="Loading parking spots"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          aria-hidden="true"
          className="h-48 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="shimmer mb-3 h-4 w-24 rounded" />
          <div className="shimmer mb-2 h-6 w-3/4 rounded" />
          <div className="shimmer mb-2 h-4 w-1/2 rounded" />
          <div className="shimmer h-4 w-2/3 rounded" />
        </li>
      ))}
      <li className="sr-only">Loading. Please wait.</li>
    </ul>
  );
}
