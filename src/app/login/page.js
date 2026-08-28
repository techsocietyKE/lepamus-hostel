import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

export const metadata = { title: 'Sign in — Lepamus Residency' };

export default async function LoginPage({ searchParams }) {
  const session = await auth();
  if (session?.user) redirect(session.user.role === 'STUDENT' ? '/portal' : '/admin');
  const params = await searchParams;
  const failed = params?.error;

  async function signInAction(formData) {
    'use server';
    const identifier = String(formData.get('identifier') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    try {
      // Staff and students share this box, and which one it is is only known
      // once the credentials check has run — so land somewhere neutral and let
      // that page send them on.
      await signIn('credentials', { identifier, password, redirectTo: '/after-login' });
    } catch (err) {
      // next-auth signals a successful redirect by throwing; let that through.
      if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
      redirect('/login?error=1');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <p className="eyebrow">Hostel &amp; rentals</p>
          <h1 className="font-cond text-3xl font-semibold tracking-tight">Lepamus Residency</h1>
        </div>

        <form action={signInAction} className="card space-y-4 p-6">
          {failed ? (
            <Notice tone="error">
              That phone number, email or password did not match. Check and try again.
            </Notice>
          ) : null}

          <div>
            <label className="label" htmlFor="identifier">Phone number or email</label>
            <input
              id="identifier"
              name="identifier"
              className="field"
              autoComplete="username"
              placeholder="0712 345 678"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="field"
              autoComplete="current-password"
              required
            />
          </div>

          <SubmitButton className="btn btn-primary w-full" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </form>

        <p className="mt-4 text-center text-xs text-ink-faint">
          Forgotten your password? Ask the proprietor to reset it.
        </p>
      </div>
    </main>
  );
}
