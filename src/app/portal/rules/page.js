import { redirect } from 'next/navigation';
import { currentStudent } from '@/auth';
import { rulesState } from '@/lib/portal';
import { formatDateTime, formatDate } from '@/lib/dates';
import SignRules from './SignRules';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hostel rules — Lepamus Residency' };

export default async function PortalRules() {
  const me = await currentStudent();
  if (!me) redirect('/login');
  const { rules, signed, signedAt } = await rulesState(me.id);

  if (!rules) {
    return (
      <>
        <h1 className="font-cond text-2xl font-semibold tracking-tight">Hostel rules</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Nothing has been published yet. The office will go through the rules
          with you.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-cond text-2xl font-semibold tracking-tight">{rules.title}</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Version {rules.version} · published {formatDate(rules.publishedAt)}
      </p>

      <div className="card mt-5 p-6">
        {rules.content.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="whitespace-pre-line text-[15px] leading-relaxed [&:not(:first-child)]:mt-4">
            {para}
          </p>
        ))}
      </div>

      <div className="mt-5">
        {signed ? (
          <div className="card border-paid/40 bg-paid-tint p-5">
            <p className="text-[15px] text-paid">
              I have read and agreed to the {rules.title}, and signed on{' '}
              {formatDateTime(signedAt)}.
            </p>
          </div>
        ) : (
          <SignRules title={rules.title} version={rules.version} />
        )}
      </div>
    </>
  );
}
