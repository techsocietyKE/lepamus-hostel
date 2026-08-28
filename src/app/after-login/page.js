import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

/** Staff and students share one sign-in box; this sends each to their own side. */
export default async function AfterLogin() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === 'STUDENT') redirect('/portal');
  if (role === 'SUPER_ADMIN' || role === 'CLERK') redirect('/admin');
  redirect('/login');
}
