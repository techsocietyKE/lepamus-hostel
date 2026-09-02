import Link from 'next/link';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { CircleUserRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * The visitor's shell. Deliberately nothing like the admin side: no sidebar,
 * no density — someone deciding where to live for a year is reading, not
 * working a ledger.
 */
export default async function PublicLayout({ children }) {
  const [settings, session] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 'singleton' } }),
    auth(),
  ]);
  const name = settings?.hostelName ?? 'Lepamus Residency';
  const role = session?.user?.role;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="leading-tight">
            <p className="eyebrow">Hostel & rentals</p>
            <p className="font-cond text-lg font-semibold">{name}</p>
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/availability" className="hover:underline">Availability</Link>
            <Link href="/rules" className="hover:underline">Rules</Link>
            <Link href="/contact" className="hover:underline">Contact</Link>
            {role === 'SUPER_ADMIN' || role === 'CLERK' ? (
              <Link href="/admin" className="btn btn-quiet">Dashboard</Link>
            ) : role === 'STUDENT' ? (
              <Link href="/portal" className="inline-flex items-center gap-1.5 text-ink hover:text-enamel hover:underline">
                <CircleUserRound size={18} aria-hidden />
                My account
              </Link>
            ) : (
              <Link href="/login" className="btn btn-quiet">Sign in</Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">{children}</main>

      <footer className="mt-12 border-t border-rule">
        <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-3 px-5 py-6 text-sm text-ink-soft">
          <p>{name}{settings?.location ? ` · ${settings.location}` : ''}</p>
          <p>
            {settings?.contactPhone ? `${settings.contactPhone} · ` : ''}
            Pay by M-Pesa to Till{' '}
            <span className="num font-medium">{settings?.tillNumber ?? '—'}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
