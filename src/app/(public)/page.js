import Link from 'next/link';
import { prisma } from '@/lib/db';
import { availability } from '@/lib/availability';
import { ksh } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const name = settings?.hostelName ?? 'Lepamus Residency';
  return {
    title: `${name} — student accommodation`,
    description: 'Single, two-sharing and three-sharing rooms. Check what is free and enquire.',
  };
}

export default async function Home() {
  const [settings, categories] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 'singleton' } }),
    availability(),
  ]);

  const bedsFree = categories.reduce((sum, c) => sum + c.bedsFree, 0);
  const cheapest = categories
    .flatMap((c) => c.rooms.map((r) => r.whenFull))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)[0];

  return (
    <>
      <section className="border-b border-rule pb-8">
        <h1 className="font-cond text-3xl font-semibold tracking-tight">
          {settings?.hostelName ?? 'Lepamus Residency'}
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {settings?.location
            ?? 'Student accommodation with single, two-sharing and three-sharing rooms.'}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/availability" className="btn btn-primary">Check availability</Link>
          <Link href="/rules" className="btn btn-quiet">Read the rules</Link>
        </div>

        {bedsFree > 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            <span className="num font-medium text-ink">{bedsFree}</span> bed
            {bedsFree === 1 ? '' : 's'} free right now
            {cheapest ? <> · from <span className="num font-medium text-ink">{ksh(cheapest)}</span> a month</> : null}
          </p>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">
            Every room is taken at the moment. An enquiry still puts you on the list.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-cond text-xl font-semibold">What is on offer</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/availability#${c.id}`}
              className="card p-5 hover:border-enamel"
            >
              <p className="eyebrow">{c.capacity} bed{c.capacity === 1 ? '' : 's'}</p>
              <p className="font-cond text-lg font-semibold">{c.name}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {c.isFull
                  ? 'Full at the moment'
                  : `${c.bedsFree} bed${c.bedsFree === 1 ? '' : 's'} free`}
              </p>
              {c.description ? (
                <p className="mt-2 text-sm text-ink-soft">{c.description}</p>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="card mt-8 p-5">
        <h2 className="font-cond text-lg font-semibold">How booking works</h2>
        <ol className="mt-3 space-y-2 text-sm text-ink-soft">
          <li>
            <span className="font-medium text-ink">1.</span> Send an enquiry. No
            account and no payment are needed.
          </li>
          <li>
            <span className="font-medium text-ink">2.</span> The office checks
            what is free and replies with a room.
          </li>
          <li>
            <span className="font-medium text-ink">3.</span> The room is held for{' '}
            {settings?.bookingHoldDays ?? 5} days while you move in or pay.
          </li>
        </ol>
        <p className="hint mt-3">
          Rent includes water and electricity. There is no deposit on hostel
          rooms and no late fee.
        </p>
      </section>
    </>
  );
}
