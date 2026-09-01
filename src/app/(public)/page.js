import Link from 'next/link';
import { prisma } from '@/lib/db';
import { availability } from '@/lib/availability';
import HeroCarousel from '@/components/HeroCarousel';
import {
  CheckCircle2,
  Search,
  BedSingle,
  CalendarCheck,
  Wifi,
  Droplet,
  Tv,
  Armchair,
  ShieldCheck,
  Eye,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const name = settings?.hostelName ?? 'Lepamus Residency';
  return {
    title: `${name} — student accommodation`,
    description: 'Single, two-sharing and three-sharing rooms. Check what is free and enquire.',
  };
}

const FACILITIES = [
  {
    icon: Wifi,
    title: 'Free WiFi',
    desc: 'Fast internet included in every room, no extra charge and no data cap.',
  },
  {
    icon: Droplet,
    title: 'In-house water system',
    desc: 'Our own water supply, so a mains outage in the area does not mean a dry tap.',
  },
  {
    icon: Tv,
    title: 'DSTV for football',
    desc: 'Every match, live, on the communal screen — no need to hunt for a viewing spot in town.',
  },
  {
    icon: Armchair,
    title: 'Ample relaxing space',
    desc: 'Common areas built for reading, unwinding or catching up with the rest of the compound.',
  },
  {
    icon: ShieldCheck,
    title: 'Perimeter fence',
    desc: 'The whole compound is fenced, so the property is closed off from the street.',
  },
  {
    icon: Eye,
    title: 'Day and night watchmen',
    desc: 'Security on site around the clock, not just during visiting hours.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'I never have to think about the water — even when the estate has an outage, ours keeps running.',
    name: 'Faith W.',
    detail: 'Third year, two-sharing room',
  },
  {
    quote:
      'The watchmen know all of us by name at this point. My parents worry a lot less with me here than they did in town.',
    name: 'Brian K.',
    detail: 'First year, single room',
  },
  {
    quote:
      'WiFi is solid enough for lecture recordings and video calls, and there is always somewhere quiet to sit between classes.',
    name: 'Njeri M.',
    detail: 'Second year, three-sharing room',
  },
];

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
    <div className="space-y-16 pb-8">
      {/* HERO SECTION — photo carousel */}
      <HeroCarousel
        hostelName={settings?.hostelName ?? 'Lepamus Residency'}
        tagline={
          settings?.location ??
          'Comfortable, secure student accommodation with single, two-sharing and three-sharing rooms.'
        }
        bookingUrl="/availability"
        rulesUrl="/rules"
        bedsFree={bedsFree}
        cheapest={cheapest}
      />

      {/* CATEGORIES SECTION */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-cond text-2xl md:text-3xl font-semibold">What is on offer</h2>
            <p className="mt-2 text-ink-soft">Choose the space that fits your needs and budget.</p>
          </div>
          <Link href="/availability" className="text-sm font-medium text-enamel hover:text-enamel-dark hover:underline">
            View all available rooms &rarr;
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/availability#${c.id}`}
              className="card group flex flex-col overflow-hidden hover:border-enamel transition-colors"
            >
              <div className="aspect-[4/3] w-full bg-wall relative overflow-hidden border-b border-rule">
                {c.images && c.images.length > 0 ? (
                  <img
                    src={c.images[0]}
                    alt={c.name}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-ink-faint/40 group-hover:text-enamel/20 transition-colors">
                    <BedSingle size={64} strokeWidth={1} />
                  </div>
                )}
              </div>

              <div className="p-5 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-cond text-xl font-semibold">{c.name}</p>
                  <span className={`pill ${c.isFull ? 'pill-full' : 'pill-vacant'}`}>
                    {c.isFull ? 'Full' : `${c.bedsFree} free`}
                  </span>
                </div>

                <p className="eyebrow mb-3">{c.capacity} bed{c.capacity === 1 ? '' : 's'}</p>

                <p className="text-sm text-ink-soft flex-1">
                  {c.description ?? 'A comfortable space for your studies.'}
                </p>

                <div className="mt-5 pt-4 border-t border-rule text-sm font-medium text-enamel flex items-center gap-1 group-hover:gap-2 transition-all">
                  Check rooms <span>&rarr;</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FACILITIES SECTION */}
      <section>
        <div className="text-center mb-10">
          <h2 className="font-cond text-2xl md:text-3xl font-semibold">What is included</h2>
          <p className="mt-2 text-ink-soft">Every room comes with the same set of essentials.</p>
        </div>

        <div className="grid gap-5 grid-cols-2 lg:grid-cols-3">
          {FACILITIES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-5 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-full bg-wall border border-rule flex items-center justify-center text-enamel shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-cond text-base md:text-lg font-semibold text-ink">{title}</p>
                <p className="mt-1 text-sm text-ink-soft">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW BOOKING WORKS SECTION */}
      <section className="card p-6 md:p-10 bg-wall/50">
        <div className="text-center mb-10">
          <h2 className="font-cond text-2xl md:text-3xl font-semibold">How booking works</h2>
          <p className="mt-2 text-ink-soft">A simple, transparent process to secure your room.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 relative">
          {/* Decorative line connecting steps on desktop */}
          <div className="hidden md:block absolute top-6 left-1/6 right-1/6 h-px bg-rule-strong z-0" aria-hidden="true" />

          {/* Step 1 */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-paper border-2 border-enamel flex items-center justify-center text-enamel mb-4 shadow-sm">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="font-cond text-lg font-semibold text-ink mb-2">1. Send an enquiry</h3>
            <p className="text-sm text-ink-soft max-w-xs">
              Find a room you like and send us an enquiry. No account and no payment are needed yet.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-paper border-2 border-enamel flex items-center justify-center text-enamel mb-4 shadow-sm">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-cond text-lg font-semibold text-ink mb-2">2. We check availability</h3>
            <p className="text-sm text-ink-soft max-w-xs">
              The office checks what is free and replies with a specific room allocation just for you.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-paper border-2 border-enamel flex items-center justify-center text-enamel mb-4 shadow-sm">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h3 className="font-cond text-lg font-semibold text-ink mb-2">3. Room is held</h3>
            <p className="text-sm text-ink-soft max-w-xs">
              The room is held for <span className="font-medium text-ink">{settings?.bookingHoldDays ?? 5} days</span> while you make arrangements to move in or pay.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-rule text-center">
          <p className="text-sm text-ink-soft">
            <span className="font-medium text-ink">Note:</span> Rent includes water and electricity. There is no deposit on hostel rooms and no late fee.
          </p>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section>
        <div className="text-center mb-10">
          <h2 className="font-cond text-2xl md:text-3xl font-semibold">What students say</h2>
          <p className="mt-2 text-ink-soft">A few words from people already staying here.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="border-l-2 border-enamel pl-5 py-1">
              <blockquote className="text-ink leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-medium text-ink">{t.name}</span>
                <span className="text-ink-soft"> &mdash; {t.detail}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}