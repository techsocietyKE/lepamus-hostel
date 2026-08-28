import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ksh, splitRent } from '@/lib/money';
import { formatDate, nairobiToday, rotationFor, isoDate } from '@/lib/dates';
import { displayPhone } from '@/lib/validation';
import PageHeader from '@/components/PageHeader';
import Allocation from './Allocation';
import PasswordReset from './PasswordReset';

export const dynamic = 'force-dynamic';

const STATUS_LABEL = {
  ACTIVE: 'Active', NOTICE_GIVEN: 'Notice given', VACATED: 'Vacated', BLACKLISTED: 'Blacklisted',
};

export default async function StudentDetail({ params }) {
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      occupancies: {
        include: { room: { include: { block: true } } },
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      },
    },
  });
  if (!student) notFound();

  const current = student.occupancies.find((o) => o.status === 'ACTIVE') ?? null;
  const past = student.occupancies.filter((o) => o.status !== 'ACTIVE');

  // Rooms this student could actually be put in, so the picker never offers a refusal.
  const candidateRooms = current
    ? []
    : await prisma.room.findMany({
        where: {
          status: 'ACTIVE',
          OR: [{ gender: 'ANY' }, { gender: student.gender }],
        },
        include: {
          block: true,
          _count: { select: { occupancies: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: [{ block: { sortOrder: 'asc' } }, { code: 'asc' }],
      });

  const withSpace = candidateRooms.filter((r) => r._count.occupancies < r.capacity);

  let shareNow = null;
  if (current) {
    const { year, month } = nairobiToday();
    const occupants = await prisma.occupancy.count({
      where: { roomId: current.roomId, status: 'ACTIVE' },
    });
    const index = await prisma.occupancy.count({
      where: { roomId: current.roomId, status: 'ACTIVE', startDate: { lt: current.startDate } },
    });
    const shares = splitRent(current.room.monthlyRent, occupants, rotationFor(year, month));
    shareNow = { amount: shares[Math.min(index, shares.length - 1)] ?? 0, occupants };
  }

  return (
    <>
      <PageHeader eyebrow={STATUS_LABEL[student.status]} title={student.fullName}>
        <Link href={`/admin/students/${id}/statement`} className="btn btn-primary">
          Statement
        </Link>
        <Link href="/admin/students" className="btn btn-quiet">All students</Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <dl className="card grid grid-cols-2 gap-x-5 gap-y-4 p-5 sm:grid-cols-3">
            {[
              ['Phone', displayPhone(student.phone), true],
              ['Email', student.email || '—', false],
              ['Gender', student.gender === 'MALE' ? 'Male' : 'Female', false],
              ['ID number', student.idNumber || '—', true],
              ['Institution', student.institution || '—', false],
              ['Course', student.course || '—', false],
              ['Admitted', formatDate(student.admittedAt), false],
              ['Next of kin', student.nextOfKinName || '—', false],
              ['Their phone', student.nextOfKinPhone ? displayPhone(student.nextOfKinPhone) : '—', true],
            ].map(([label, value, mono]) => (
              <div key={label}>
                <dt className="eyebrow">{label}</dt>
                <dd className={`mt-0.5 text-sm ${mono ? 'num' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="card overflow-hidden">
            <div className="border-b border-rule px-4 py-3">
              <h2 className="font-cond text-base font-semibold">Room history</h2>
            </div>
            {student.occupancies.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-soft">
                Not yet allocated to a room.
              </p>
            ) : (
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Block</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Ended</th>
                  </tr>
                </thead>
                <tbody>
                  {[current, ...past].filter(Boolean).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/rooms/${o.room.id}`} className="num font-medium text-enamel hover:underline">
                          {o.room.code}
                        </Link>
                      </td>
                      <td className="num text-ink-soft">{o.room.block.name}</td>
                      <td className="text-ink-soft">{formatDate(o.startDate)}</td>
                      <td className="text-ink-soft">
                        {o.endDate ? formatDate(o.endDate) : <span className="pill pill-paid">Current</span>}
                      </td>
                      <td className="text-ink-soft">
                        {o.endReason
                          ? { VACATED: 'Vacated', TRANSFERRED: 'Moved room', REMOVED: 'Removed' }[o.endReason]
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <Allocation
          student={{ id: student.id, fullName: student.fullName, status: student.status }}
          current={
            current
              ? {
                  occupancyId: current.id,
                  roomId: current.room.id,
                  code: current.room.code,
                  block: current.room.block.name,
                  capacity: current.room.capacity,
                  monthlyRent: current.room.monthlyRent,
                  startDate: formatDate(current.startDate),
                  share: shareNow?.amount ?? 0,
                  occupants: shareNow?.occupants ?? 1,
                }
              : null
          }
          rooms={withSpace.map((r) => ({
            id: r.id,
            code: r.code,
            block: r.block.name,
            capacity: r.capacity,
            occupied: r._count.occupancies,
            monthlyRent: r.monthlyRent,
            gender: r.gender,
          }))}
          today={isoDate()}
        />

        <div className="card space-y-2 p-5">
          <p className="eyebrow">Portal access</p>
          <p className="text-sm text-ink-soft">
            {student.passwordHash
              ? 'They can sign in with their phone number. Reset it if they have forgotten it — the old one cannot be looked up.'
              : 'No sign-in has been set up yet. Generate one so they can use the portal.'}
          </p>
          <PasswordReset studentId={student.id} />
        </div>
      </div>
    </>
  );
}
