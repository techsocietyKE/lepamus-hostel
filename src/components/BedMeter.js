/**
 * One segment per bed, filled for each occupant. "2/3" as a thing you can see
 * rather than read, so a whole block can be scanned at a glance.
 */
export default function BedMeter({ occupied, capacity, out = false, size = 'md' }) {
  const beds = Array.from({ length: Math.max(capacity, 1) });
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const width = size === 'sm' ? 'w-4' : 'w-5';

  return (
    <div
      className="flex flex-col gap-[3px]"
      role="img"
      aria-label={out ? 'Room out of use' : `${occupied} of ${capacity} beds taken`}
    >
      {beds.map((_, i) => {
        const filled = i < occupied;
        return (
          <span
            key={i}
            className={[
              width,
              height,
              'rounded-[1px] border',
              out
                ? 'border-rule-strong bg-transparent opacity-40'
                : filled
                  ? 'border-enamel bg-enamel'
                  : 'border-rule-strong bg-transparent',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}

/** The same information as text, for tables where a graphic would be noise. */
export function OccupancyFraction({ occupied, capacity }) {
  return (
    <span className="num text-sm">
      {occupied}<span className="text-ink-faint">/{capacity}</span>
    </span>
  );
}
