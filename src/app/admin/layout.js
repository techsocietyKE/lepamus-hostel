import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { LayoutGrid, DoorClosed, Users, Layers, Images, Sliders, BookOpen, Banknote, ScrollText, History, Inbox, UserMinus, LogOut, Megaphone } from 'lucide-react';

const nav = [
  { href: '/admin', label: 'Overview', icon: LayoutGrid },
  { href: '/admin/ledger', label: 'Monthly sheet', icon: BookOpen },
  { href: '/admin/payments', label: 'Payments', icon: Banknote },
  { href: '/admin/rooms', label: 'Rooms', icon: DoorClosed },
  { href: '/admin/blocks', label: 'Blocks', icon: Layers },
  { href: '/admin/categories', label: 'Categories', icon: Images },
  { href: '/admin/students', label: 'Students', icon: Users },
  { href: '/admin/bookings', label: 'Bookings', icon: Inbox },
  { href: '/admin/vacate', label: 'Vacate requests', icon: UserMinus },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/rules', label: 'Rules', icon: ScrollText, superAdminOnly: true },
  { href: '/admin/settings', label: 'Settings', icon: Sliders, superAdminOnly: true },
  { href: '/admin/audit', label: 'Audit log', icon: History, superAdminOnly: true },
  
];

export default async function AdminLayout({ children }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const user = session.user;

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-rule bg-paper md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 md:block md:px-5 md:py-5">
          <div>
            <p className="eyebrow">Hostel &amp; rentals</p>
            <p className="font-cond text-lg font-semibold leading-tight">Lepamus Residency</p>
          </div>
          <form action={signOutAction} className="md:hidden">
            <button type="submit" className="btn btn-quiet px-2.5 py-1.5" aria-label="Sign out">
              <LogOut size={15} aria-hidden />
            </button>
          </form>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5 md:mt-2 md:flex-col md:px-3 md:pb-0">
          {nav
            .filter((item) => !item.superAdminOnly || user.role === 'SUPER_ADMIN')
            .map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-ink-soft hover:bg-wall hover:text-ink"
              >
                <Icon size={16} aria-hidden />
                {label}
              </Link>
            ))}
        </nav>

        <div className="hidden border-t border-rule px-5 py-4 md:block md:mt-auto">
          <p className="text-sm font-medium leading-tight">{user.name}</p>
          <p className="eyebrow mt-0.5">
            {user.role === 'SUPER_ADMIN' ? 'Proprietor' : 'Clerk'}
          </p>
          <form action={signOutAction}>
            <button type="submit" className="btn btn-quiet mt-3 w-full">
              <LogOut size={15} aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
