import { redirect } from 'next/navigation';
import { currentStudent } from '@/auth';
import ChangePasswordForm from '../ForcePasswordChange/ChangePasswordForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Change Password - Lepamus Residency' };

export default async function PasswordPage() {
  const me = await currentStudent();
  if (!me) redirect('/login');

  return (
    <>
      <h1 className="font-cond text-2xl font-semibold tracking-tight">Change your password</h1>
      <div className="card mt-5 max-w-md p-6">
        <p className="text-sm text-ink-soft">
          Update the password you use to sign in to your portal.
        </p>
        
        {/* We are reusing the exact same form from the forced-change screen! */}
        <ChangePasswordForm />
        
      </div>
    </>
  );
}