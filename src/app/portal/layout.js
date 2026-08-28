import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const nav = [
  { href: '/portal', label: 'My account' },
  { href: '/portal/pay', label: 'Pay' },
  { href: '/portal/statement', label: 'Statement' },
  { href: '/portal/rules', label: 'Rules' },
];

export default async function PortalLayout({ children }) {
  const session = await auth();
  if (session?.user?.role !== 'STUDENT') redirect('/login');

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="leading-tight">
            <p className="eyebrow">{settings?.hostelName ?? 'Lepamus Residency'}</p>
            <p className="font-cond text-lg font-semibold">{session.user.name}</p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="btn btn-quiet">Sign out</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-sm px-3 py-1.5 text-sm text-ink-soft hover:bg-wall hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}
