import Link from 'next/link';
import { availability, GENDER_LABEL } from '@/lib/availability';
import { ksh } from '@/lib/money';

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

  return (
    <>
      <h1 className="font-cond text-2xl font-semibold tracking-tight">What is free</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Only rooms with a bed free are listed. The price shown is per student —
        what you would pay at the room&rsquo;s current occupancy, and what it becomes
        once the room fills up.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map(({ v, l }) => (
          <Link
            key={l}
            href={v ? `/availability?gender=${v}` : '/availability'}
            className={`btn px-3 py-1.5 text-sm ${
              (gender ?? '') === v ? 'btn-primary' : 'btn-quiet'
            }`}
          >
            {l}
          </Link>
        ))}
      </div>
      {gender ? (
        <p className="hint mt-2">
          Mixed rooms are open to everyone, so they appear under every filter.
        </p>
      ) : null}

      {categories.length === 0 ? (
        <div className="card mt-6 px-6 py-12 text-center">
          <p className="font-cond text-lg font-semibold">Nothing listed yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Please <Link href="/contact" className="underline">get in touch</Link> and we will
            tell you what is coming free.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {categories.map((c) => (
            <section key={c.id} id={c.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-2">
                <h2 className="font-cond text-xl font-semibold">{c.name}</h2>
                <p className="text-sm text-ink-soft">
                  {c.isFull
                    ? 'Full at the moment'
                    : `${c.bedsFree} bed${c.bedsFree === 1 ? '' : 's'} free in ${c.totalWithSpace} room${c.totalWithSpace === 1 ? '' : 's'}`}
                </p>
              </div>

              {c.description ? (
                <p className="mt-2 text-sm text-ink-soft">{c.description}</p>
              ) : null}

              {c.isFull ? (
                <p className="mt-3 text-sm text-ink-soft">
                  Every {c.name.toLowerCase()} room is taken. Enquire anyway — rooms
                  come free through the year, and an enquiry puts you on the list.
                </p>
              ) : (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {c.rooms.map((room) => (
                      <article key={room.id} className="card overflow-hidden">
                        {room.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={room.image}
                            alt={`Room ${room.code}`}
                            className="h-40 w-full object-cover"
                          />
                        ) : null}
                        <div className="p-4">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="font-cond text-lg font-semibold">Room {room.code}</p>
                            <span className="pill pill-part">{GENDER_LABEL[room.gender]}</span>
                          </div>
                          <p className="mt-1 text-sm text-ink-soft">
                            {room.spacesFree} space{room.spacesFree === 1 ? '' : 's'} free
                            {' '}of {room.capacity}
                          </p>
                          {room.description ? (
                            <p className="mt-2 text-sm text-ink-soft">{room.description}</p>
                          ) : null}
                          <dl className="mt-3 border-t border-rule pt-3 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-ink-soft">If you join now</dt>
                              <dd className="num font-medium">{ksh(room.ifYouJoinNow)}</dd>
                            </div>
                            <div className="mt-1 flex justify-between">
                              <dt className="text-ink-soft">Once the room is full</dt>
                              <dd className="num">{ksh(room.whenFull)}</dd>
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
                    <p className="mt-3 text-sm text-ink-soft">
                      …and {c.moreThanShown} more {c.name.toLowerCase()} room
                      {c.moreThanShown === 1 ? '' : 's'} available —{' '}
                      <Link href={`/book?category=${c.id}`} className="underline">enquire</Link>.
                    </p>
                  ) : null}
                </>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="mt-10 text-sm text-ink-soft">
        Rent includes water and electricity. No deposit on hostel rooms, and no
        late fee. Please <Link href="/rules" className="underline">read the rules</Link> before
        booking.
      </p>
    </>
  );
}
