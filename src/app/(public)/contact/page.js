import Link from 'next/link';
import { prisma } from '@/lib/db';
import { displayPhone } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contact — Lepamus Residency' };

export default async function ContactPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const phone = settings?.contactPhone ? displayPhone(settings.contactPhone) : null;

  return (
    <>
      <h1 className="font-cond text-2xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        For a room, the quickest route is an enquiry — the office replies with
        what is actually free.
      </p>

      <div className="card mt-6 divide-y divide-rule">
        {phone ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2 p-5">
            <div>
              <p className="eyebrow">Phone</p>
              <p className="num text-lg">{phone}</p>
            </div>
            <div className="flex gap-2">
              <a href={`tel:+${settings.contactPhone}`} className="btn btn-quiet">Call</a>
              <a
                href={`https://wa.me/${settings.contactPhone}`}
                className="btn btn-quiet"
                rel="noopener noreferrer"
                target="_blank"
              >
                WhatsApp
              </a>
            </div>
          </div>
        ) : null}

        {settings?.contactEmail ? (
          <div className="p-5">
            <p className="eyebrow">Email</p>
            <a href={`mailto:${settings.contactEmail}`} className="text-lg hover:underline">
              {settings.contactEmail}
            </a>
          </div>
        ) : null}

        {settings?.location ? (
          <div className="p-5">
            <p className="eyebrow">Where we are</p>
            <p className="text-[15px]">{settings.location}</p>
          </div>
        ) : null}

        <div className="p-5">
          <p className="eyebrow">Paying</p>
          <p className="text-[15px]">
            M-Pesa Buy Goods, Till{' '}
            <span className="num font-medium">{settings?.tillNumber ?? '—'}</span>
            {settings?.tillBusinessName ? (
              <> — the confirmation reads {settings.tillBusinessName}.</>
            ) : null}
          </p>
          <p className="hint mt-1">
            Residents can also submit a payment in the portal so the office can
            confirm it against the Till.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/book" className="btn btn-primary">Send an enquiry</Link>
        <Link href="/availability" className="btn btn-quiet">See what is free</Link>
      </div>
    </>
  );
}
