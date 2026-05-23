import type { ParkingSpot } from '@shared/types';
import { formatDistance } from '@shared/geo';

interface ParkingCardProps {
  spot: ParkingSpot;
  rank: number;
  originLat: number;
  originLng: number;
}

function fallbackSpotImageUrl(lat: number, lng: number): string {
  const center = `${lat},${lng}`;
  const marker = `${lat},${lng},red-pushpin`;
  return (
    'https://staticmap.openstreetmap.de/staticmap.php' +
    `?center=${encodeURIComponent(center)}` +
    '&zoom=18&size=900x360' +
    `&markers=${encodeURIComponent(marker)}`
  );
}

function signalLabel(spot: ParkingSpot): string {
  const cap = spot.signals.find((s) => s.kind === 'osm:capacity_disabled');
  if (cap && cap.kind === 'osm:capacity_disabled') {
    return `${cap.value} ADA space${cap.value === 1 ? '' : 's'} marked in OSM`;
  }
  const wc = spot.signals.find((s) => s.kind === 'osm:wheelchair');
  if (wc && wc.kind === 'osm:wheelchair') {
    return `Wheelchair access: ${wc.value}`;
  }
  return 'Accessible parking';
}

export function ParkingCard({ spot, rank, originLat, originLng }: ParkingCardProps) {
  const detection = spot.signals.find((s) => s.kind === 'image:grounding_dino');
  const hasStreetImage = Boolean(spot.streetImageUrl);
  const imageUrl =
    detection && detection.kind === 'image:grounding_dino'
      ? detection.imageUrl
      : spot.streetImageUrl ?? fallbackSpotImageUrl(spot.location.lat, spot.location.lng);
  // Google Maps Platform ToS require results from the Geocoding API to be
  // displayed on a Google Map — see ADR-0004. We honour that by routing the
  // user's directions request to google.com/maps.
  const directionsUrl =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${originLat}%2C${originLng}` +
    `&destination=${spot.location.lat}%2C${spot.location.lng}` +
    `&travelmode=driving`;

  const fee = spot.tags['fee'];
  const surface = spot.tags['surface'];

  return (
    <article
      aria-labelledby={`spot-${spot.id}-name`}
      className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition focus-within:shadow-md hover:shadow-md"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            #{rank} closest
          </p>
          <h3
            id={`spot-${spot.id}-name`}
            className="mt-1 text-lg font-semibold leading-tight text-slate-900"
          >
            {spot.name}
          </h3>
        </div>
        <span
          aria-label={`${formatDistance(spot.distanceMeters)} away`}
          className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700"
        >
          {formatDistance(spot.distanceMeters)}
        </span>
      </header>

      <dl className="mt-3 space-y-2 text-sm text-slate-700">
        <div>
          <dt className="sr-only">Accessibility</dt>
          <dd className="font-medium text-accent-600">{signalLabel(spot)}</dd>
        </div>
        {fee && (
          <div className="flex gap-2">
            <dt className="text-slate-500">Fee:</dt>
            <dd>{fee === 'no' ? 'Free' : fee === 'yes' ? 'Paid' : fee}</dd>
          </div>
        )}
        {surface && (
          <div className="flex gap-2">
            <dt className="text-slate-500">Surface:</dt>
            <dd className="capitalize">{surface.replace(/_/g, ' ')}</dd>
          </div>
        )}
      </dl>

      {imageUrl && (
        <figure className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <img
            src={imageUrl}
            alt={`Image preview near ${spot.name}`}
            loading="lazy"
            className="h-40 w-full object-cover"
          />
          <figcaption className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {detection && detection.kind === 'image:grounding_dino' ? (
              <>
                <span className="font-medium text-slate-800">groundingDino:</span>{' '}
                &ldquo;{detection.label}&rdquo; ({Math.round(detection.confidence * 100)}% confidence)
              </>
            ) : hasStreetImage ? (
              'Street-level reference image (no high-confidence ADA sign detection).'
            ) : (
              'Map preview centered on this parking spot.'
            )}
          </figcaption>
        </figure>
      )}

      <footer className="mt-auto flex flex-wrap gap-3 pt-4">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center text-sm font-semibold text-brand-700 hover:underline"
        >
          Directions
          <span className="sr-only"> (opens in a new tab)</span>
          <span aria-hidden="true" className="ml-1">→</span>
        </a>
        <a
          href={spot.osmUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center text-sm text-slate-600 hover:underline"
        >
          View on OpenStreetMap
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </footer>
    </article>
  );
}
