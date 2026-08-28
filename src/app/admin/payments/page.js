import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { studentBalances } from '@/lib/payments';
import { fmt } from '@/lib/money';
import { formatDate, nairobiToday } from '@/lib/dates';
import { displayPhone } from '@/lib/validation';
import PageHeader from '@/components/PageHeader';
import Empty from '@/components/Empty';
import VerifyQueue from './VerifyQueue';
import RecordPaymentForm from './RecordPaymentForm';
import ReverseButton from './ReverseButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payments — Lepamus Residency' };

const METHOD_LABEL = { CASH: 'Cash', MPESA_TILL: 'M-Pesa Till', BANK: 'Bank' };
const STATUS_LABEL = {
  SUBMITTED: 'Awaiting check',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVERSED: 'Reversed',
};

export default async function PaymentsPage() {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN';

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const staleAfterDays = settings?.staleClaimDays ?? 2;

  const [submitted, recent, students] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'SUBMITTED' },
      include: {
        student: {
          select: {
            id: true, fullName: true,
            occupancies: {
              where: { status: 'ACTIVE' },
              select: { room: { select: { code: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    }),
    prisma.payment.findMany({
      where: { status: { not: 'SUBMITTED' } },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.student.findMany({
      where: { status: { in: ['ACTIVE', 'NOTICE_GIVEN'] } },
      select: {
        id: true, fullName: true, phone: true,
        occupancies: {
          where: { status: 'ACTIVE' },
          select: { room: { select: { code: true, block: { select: { name: true } } } } },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  const balances = await studentBalances(
    [...new Set([...submitted.map((p) => p.studentId), ...students.map((s) => s.id)])],
  );

  const today = nairobiToday();
  const queue = submitted.map((p) => {
    const balance = balances.get(p.studentId) ?? 0;
    const claimed = p.amountClaimed ?? p.amount;
    const waitingSince = p.submittedAt ?? p.createdAt;
    const ageDays = Math.floor((Date.now() - waitingSince.getTime()) / 86400000);
    return {
      id: p.id,
      studentName: p.student.fullName,
      roomCode: p.student.occupancies[0]?.room.code ?? '—',
      claimed,
      transactionCode: p.transactionCode,
      payerPhone: p.payerPhone ? displayPhone(p.payerPhone) : null,
      paidAt: formatDate(p.paidAt),
      balance,
      wouldBecome: balance - claimed,
      ageDays,
      stale: ageDays >= staleAfterDays,
    };
  });

  const studentOptions = students.map((s) => {
    const room = s.occupancies[0]?.room;
    const spaced = displayPhone(s.phone);
    return {
      id: s.id,
      name: s.fullName,
      roomCode: room?.code ?? null,
      blockName: room?.block.name ?? null,
      phone: spaced,
      balance: balances.get(s.id) ?? 0,
      // Everything worth typing, flattened once here rather than per keystroke.
      // Both phone forms are included so 0712… and 254712… both match.
      haystack: [s.fullName, room?.code, room?.block.name, s.phone, spaced.replace(/\s/g, '')]
        .filter(Boolean).join(' ').toLowerCase(),
    };
  });

  return (
    <>
      <PageHeader eyebrow="Money" title="Payments" count={queue.length} />
      <p className="-mt-2 mb-6 max-w-2xl text-sm text-ink-soft">
        A submitted payment is a claim and changes nothing. Only approving it
        moves money — that is what stops a student clearing their own account by
        typing a number.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section>
            <h2 className="font-cond text-lg font-semibold">
              To verify
              {queue.length > 0 ? (
                <span className="num ml-2 text-base font-normal text-ink-faint">{queue.length}</span>
              ) : null}
            </h2>
            <p className="hint mb-3">
              Check each against the Till&rsquo;s own record of the day&rsquo;s takings, then
              approve. Where two students paid the same amount on the same day,
              the code is what tells them apart.
            </p>
            {queue.length === 0 ? (
              <Empty
                title="Nothing to check"
                body="Record what you have seen arrive using the form alongside, or take cash straight from the monthly sheet. Both are approved as you enter them, because you are looking at the money or the Till record. This queue fills up later, once students can submit their own payments from the portal."
              />
            ) : (
              <VerifyQueue rows={queue} staleAfterDays={staleAfterDays} />
            )}
          </section>

          <section>
            <h2 className="font-cond text-lg font-semibold">Recent payments</h2>
            <p className="hint mb-3">
              A payment is never edited. A wrong one is reversed and re-entered,
              and both entries stay on the record.
            </p>
            {recent.length === 0 ? (
              <Empty title="No payments yet" body="Cash taken on the monthly sheet and Till payments recorded here will appear in this list." />
            ) : (
              <div className="card overflow-x-auto">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Student</th>
                      <th>Method</th>
                      <th>Code</th>
                      <th className="right">Amount</th>
                      <th>Paid</th>
                      <th>Status</th>
                      {isSuperAdmin ? <th></th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((p) => (
                      <tr key={p.id} className={p.status === 'REVERSED' ? 'text-ink-faint line-through' : undefined}>
                        <td className="num">{p.receiptNo ?? '—'}</td>
                        <td>{p.student.fullName}</td>
                        <td className="text-sm">{METHOD_LABEL[p.method] ?? p.method}</td>
                        <td className="num text-sm">{p.transactionCode ?? '—'}</td>
                        <td className="right num">{fmt(p.amount)}</td>
                        <td className="text-sm">{formatDate(p.paidAt)}</td>
                        <td className="text-sm">
                          {STATUS_LABEL[p.status] ?? p.status}
                          {p.rejectionReason ? (
                            <span className="block text-xs text-ink-faint">{p.rejectionReason}</span>
                          ) : null}
                        </td>
                        {isSuperAdmin ? (
                          <td className="right">
                            {p.status === 'APPROVED' ? (
                              <ReverseButton
                                paymentId={p.id}
                                studentName={p.student.fullName}
                                amount={fmt(p.amount)}
                              />
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <RecordPaymentForm
          students={studentOptions}
          tillNumber={settings?.tillNumber ?? ''}
          today={`${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`}
        />
      </div>
    </>
  );
}
