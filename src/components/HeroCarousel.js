'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { ksh } from '@/lib/money';

// Swap these for real photos when you have them: drop the files in
// /public/images and point each entry at e.g. '/images/hero-1.jpg'.
// Using placeholder photos for now, as agreed.
const HERO_IMAGES = [
  'https://picsum.photos/seed/lepamus-hero-1/1600/1000',
  'https://picsum.photos/seed/lepamus-hero-2/1600/1000',
  'https://picsum.photos/seed/lepamus-hero-3/1600/1000',
  'https://picsum.photos/seed/lepamus-hero-4/1600/1000',
];

const SLIDE_MS = 6000;

export default function HeroCarousel({ hostelName, tagline, bookingUrl, rulesUrl, bedsFree, cheapest }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || HERO_IMAGES.length < 2) return;

    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, SLIDE_MS);

    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <section className="relative overflow-hidden border-b border-rule">
      {/* Background carousel */}
      <div className="absolute inset-0">
        {HERO_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-in-out motion-reduce:transition-none"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-ink/55" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center pt-20 pb-14 md:pt-28 md:pb-20 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper/95 text-enamel-dark text-xs font-medium mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-enamel opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-enamel" />
          </span>
          Student accommodation
        </div>

        <h1 className="font-cond text-4xl md:text-6xl font-bold tracking-tight text-paper max-w-3xl mx-auto leading-tight">
          {hostelName}
        </h1>

        <p className="mt-5 max-w-2xl mx-auto text-lg md:text-xl text-paper/85">
          {tagline}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href={bookingUrl} className="btn btn-primary text-base px-8 py-3 w-full sm:w-auto">
            Check availability
          </Link>
          <Link href={rulesUrl} className="btn btn-quiet text-base px-8 py-3 w-full sm:w-auto bg-paper/90">
            Read the rules
          </Link>
        </div>

        <div className="mt-10 flex justify-center">
          {bedsFree > 0 ? (
            <div className="flex items-center gap-2 text-sm text-ink bg-paper px-5 py-2.5 rounded-sm">
              <CheckCircle2 className="w-4 h-4 text-paid" />
              <span>
                <span className="num font-medium text-ink">{bedsFree}</span> bed{bedsFree === 1 ? '' : 's'} free right now
                {cheapest ? <> &mdash; from <span className="num font-medium text-ink">{ksh(cheapest)}</span> a month</> : null}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-part bg-paper px-5 py-2.5 rounded-sm">
              <span className="font-medium">Every room is currently taken. An enquiry still puts you on the list.</span>
            </div>
          )}
        </div>

        {/* Slide indicators */}
        {HERO_IMAGES.length > 1 && (
          <div className="mt-9 flex justify-center gap-2">
            {HERO_IMAGES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${HERO_IMAGES.length}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-6 bg-paper' : 'w-1.5 bg-paper/40 hover:bg-paper/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}