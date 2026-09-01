import Link from 'next/link';
import { availability, GENDER_LABEL } from '@/lib/availability';
import { ksh } from '@/lib/money';
import { CheckCircle2, Search, BedSingle, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Availability — Lepamus Residency',
  description: 'Rooms with space right now, by sharing type.',
};

const FILTERS = [
  { v: '', l: 'Everyone' },
  { v: 'MALE', l: 'Men' },
  { v: 'FEMALE', l: 'Women' },
];

export default async function AvailabilityPage({ searchParams }) {
  const params = await searchParams;
  const gender = params?.gender === 'MALE' || params?.gender === 'FEMALE' ? params.gender : null;
  const categories = await availability({ gender });
  const bedsFree = categories.reduce((sum, c) => sum + c.bedsFree, 0);

  return (
    <>
      {/* PAGE HEADER */}
      <div className="border-b border-rule pb-8">
        <h1 className="font-cond text-3xl md:text-4xl font-semibold tracking-tight text-ink">What is free</h1>
        <p className="mt-3 max-w-2xl text-sm md:text-base text-ink-soft">
          Only rooms with a bed free are listed. The price shown is per student &mdash;
          what you would pay at the room&rsquo;s current occupancy, and what it becomes
          once the room fills up.
        </p>

        {bedsFree > 0 ? (
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-ink bg-wall px-4 py-2 rounded-sm border border-rule">
            <CheckCircle2 className="w-4 h-4 text-paid" />
            <span>
              <span className="num font-medium text-ink">{bedsFree}</span> bed{bedsFree === 1 ? '' : 's'} free right now
            </span>
          </div>
        ) : null}

        {/* Filters */}
        <div className="mt-6 inline-flex flex-wrap gap-1 p-1 rounded-full bg-wall border border-rule">
          {FILTERS.map(({ v, l }) => (
            <Link
              key={l}
              href={v ? `/availability?gender=${v}` : '/availability'}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                (gender ?? '') === v
                  ? 'bg-enamel text-paper'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {l}
            </Link>
          ))}
        </div>
        {gender ? (
          <p className="hint mt-2 text-xs text-ink-faint">
            Mixed rooms are open to everyone, so they appear under every filter.
          </p>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <div className="card mt-10 px-6 py-14 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-wall border border-rule flex items-center justify-center text-enamel mb-4">
            <Search className="w-5 h-5" />
          </div>
          <p className="font-cond text-lg font-semibold text-ink">Nothing listed yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Please <Link href="/contact" className="underline text-enamel hover:text-enamel-dark">get in touch</Link> and we will
            tell you what is coming free.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {categories.map((c) => (
            <section key={c.id} id={c.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-3">
                <h2 className="font-cond text-xl md:text-2xl font-semibold text-ink">{c.name}</h2>
                <span className={`pill ${c.isFull ? 'pill-full' : 'pill-vacant'}`}>
                  {c.isFull
                    ? 'Full at the moment'
                    : `${c.bedsFree} bed${c.bedsFree === 1 ? '' : 's'} free`}
                </span>
              </div>

              {c.description ? (
                <p className="mt-3 text-sm text-ink-soft max-w-2xl">{c.description}</p>
              ) : null}

              {c.isFull ? (
                <p className="mt-4 text-sm text-ink-soft">
                  Every {c.name.toLowerCase()} room is taken. Enquire anyway &mdash; rooms
                  come free through the year, and an enquiry puts you on the list.
                </p>
              ) : (
                <>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {c.rooms.map((room) => (
                      <article key={room.id} className="card overflow-hidden flex flex-col">
                        <div className="aspect-[4/3] w-full bg-wall relative overflow-hidden border-b border-rule">
                          {room.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={room.image}
                              alt={`Room ${room.code}`}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-ink-faint/40">
                              <BedSingle size={48} strokeWidth={1} />
                            </div>
                          )}
                        </div>

                        <div className="p-4 flex flex-col flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="font-cond text-lg font-semibold text-ink">Room {room.code}</p>
                            <span className="pill pill-part">{GENDER_LABEL[room.gender]}</span>
                          </div>

                          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            {room.spacesFree} space{room.spacesFree === 1 ? '' : 's'} free of {room.capacity}
                          </p>

                          {room.description ? (
                            <p className="mt-2 text-sm text-ink-soft">{room.description}</p>
                          ) : null}

                          <dl className="mt-3 border-t border-rule pt-3 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-ink-soft">If you join now</dt>
                              <dd className="num font-medium text-ink">{ksh(room.ifYouJoinNow)}</dd>
                            </div>
                            <div className="mt-1 flex justify-between">
                              <dt className="text-ink-soft">Once the room is full</dt>
                              <dd className="num text-ink-soft">{ksh(room.whenFull)}</dd>
                            </div>
                          </dl>

                          <Link
                            href={`/book?category=${c.id}&room=${room.code}`}
                            className="btn btn-primary mt-4 w-full"
                          >
                            Enquire about {room.code}
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>

                  {c.moreThanShown > 0 ? (
                    <p className="mt-4 text-sm text-ink-soft">
                      &hellip;and {c.moreThanShown} more {c.name.toLowerCase()} room
                      {c.moreThanShown === 1 ? '' : 's'} available &mdash;{' '}
                      <Link href={`/book?category=${c.id}`} className="underline text-enamel hover:text-enamel-dark">enquire</Link>.
                    </p>
                  ) : null}
                </>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="mt-14 pt-6 border-t border-rule text-sm text-ink-soft">
        <span className="font-medium text-ink">Note:</span> Rent includes water and electricity.
        There is no deposit on hostel rooms and no late fee. Please{' '}
        <Link href="/rules" className="underline text-enamel hover:text-enamel-dark">read the rules</Link> before
        booking.
      </p>
    </>
  );
}