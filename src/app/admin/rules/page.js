import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { formatDateTime } from '@/lib/dates';
import PageHeader from '@/components/PageHeader';
import RulesEditor from './RulesEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hostel rules — Lepamus Residency' };

export default async function RulesPage() {
  const session = await auth();
  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/admin');

  const [current, versions, signedCount, residents] = await Promise.all([
    prisma.hostelRules.findFirst({ where: { isCurrent: true } }),
    prisma.hostelRules.findMany({
      orderBy: { version: 'desc' },
      include: { _count: { select: { acknowledgements: true } } },
      take: 10,
    }),
    prisma.ruleAcknowledgement.count(),
    prisma.student.count({ where: { status: 'ACTIVE' } }),
  ]);

  const signedCurrent = current
    ? await prisma.ruleAcknowledgement.count({ where: { rulesId: current.id } })
    : 0;

  const unsigned = current
    ? await prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        NOT: { ruleAcks: { some: { rulesId: current.id } } },
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
      take: 20,
    })
    : [];

  return (
    <>
      <PageHeader eyebrow="Administration" title="Hostel rules" />
      <p className="-mt-2 mb-6 max-w-2xl text-sm text-ink-soft">
        The rules are public, so a prospective student reads them before
        committing, and signed inside the portal by residents. The text lives
        here rather than in code, so changing it never needs a developer.
      </p>

      {current ? (
        <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="eyebrow">Current version</p>
            <p className="num text-lg">{current.version}</p>
            <p className="hint">Published {formatDateTime(current.publishedAt)}</p>
          </div>
          <div>
            <p className="eyebrow">Signed this version</p>
            <p className="num text-lg">{signedCurrent} <span className="text-ink-faint">of {residents}</span></p>
            <p className="hint">{residents - signedCurrent} still to sign</p>
          </div>
          <div>
            <p className="eyebrow">Acknowledgements on record</p>
            <p className="num text-lg">{signedCount}</p>
            <p className="hint">Across all versions</p>
          </div>
        </div>
      ) : null}

      {unsigned.length > 0 ? (
        <div className="card mb-6 p-5">
          <h2 className="font-cond text-lg font-semibold">Not yet signed</h2>
          <p className="hint mb-2">
            They are prompted at each login until they do. Nothing stops them
            using the portal in the meantime.
          </p>
          <p className="text-sm">{unsigned.map((s) => s.fullName).join(' · ')}</p>
        </div>
      ) : null}

      <RulesEditor current={current} />

      {versions.length > 1 ? (
        <>
          <h2 className="mt-8 font-cond text-lg font-semibold">Earlier versions</h2>
          <p className="hint mb-2">
            Kept because acknowledgements point at them — a student agreed to a
            particular text on a particular day.
          </p>
          <div className="card overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Title</th>
                  <th>Published</th>
                  <th>By</th>
                  <th className="right">Signed by</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className={v.isCurrent ? 'font-medium' : undefined}>
                    <td className="num">{v.version}{v.isCurrent ? ' — current' : ''}</td>
                    <td>{v.title}</td>
                    <td className="text-sm">{formatDateTime(v.publishedAt)}</td>
                    <td className="text-sm">{v.publishedBy ?? '—'}</td>
                    <td className="right num">{v._count.acknowledgements}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
