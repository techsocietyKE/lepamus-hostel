import { redirect } from 'next/navigation';
import { currentStudent } from '@/auth';
import Link from 'next/link';
import ChangePasswordForm from './ChangePasswordForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Change your password — Lepamus Residency' };

/**
 * A one-time stop for a password issued by the office. The portal layout
 * redirects every student with mustChangePassword set to here, and this page
 * bounces them on to the portal as soon as they no longer need to change it.
 */
export default async function ForcePasswordChangePage() {
  const me = await currentStudent();
  if (!me) redirect('/login');
  if (!me.mustChangePassword) redirect('/portal');

  return (
    <div className="card mx-auto max-w-md p-6">
      <h1 className="font-cond text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Your sign-in password was issued by the office. Set your own before you
        continue — it is the only time this screen appears.
      </p>
      <ChangePasswordForm />
      <p className="mt-4 text-sm text-ink-soft">
        <Link href="/portal" className="text-enamel hover:underline">Back to your account</Link>
      </p>
    </div>
  );
}
