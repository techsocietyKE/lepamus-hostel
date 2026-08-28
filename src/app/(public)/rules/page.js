import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Hostel rules — Lepamus Residency',
  description: 'The rules that apply to every resident, readable before you book.',
};

export default async function RulesPage() {
  const rules = await prisma.hostelRules.findFirst({ where: { isCurrent: true } });

  if (!rules) {
    return (
      <>
        <h1 className="font-cond text-2xl font-semibold tracking-tight">Hostel rules</h1>
        <p className="mt-3 text-sm text-ink-soft">
          The rules have not been published yet. Please{' '}
          <Link href="/contact" className="underline">ask the office</Link> and they will
          go through them with you.
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

      <div className="card mt-6 p-6">
        {rules.content.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="whitespace-pre-line text-[15px] leading-relaxed [&:not(:first-child)]:mt-4">
            {para}
          </p>
        ))}
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        Residents agree to these in the student portal, and the agreement is
        recorded with the date. Publishing a revised version asks everyone to
        agree again.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/availability" className="btn btn-primary">Check availability</Link>
        <Link href="/contact" className="btn btn-quiet">Ask a question</Link>
      </div>
    </>
  );
}
