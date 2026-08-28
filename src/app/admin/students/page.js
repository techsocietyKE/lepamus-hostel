import Link from 'next/link';
import { prisma } from '@/lib/db';
import { displayPhone } from '@/lib/validation';
import PageHeader from '@/components/PageHeader';
import Empty from '@/components/Empty';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Students — Lepamus Residency' };

const STATUS_TONE = {
  ACTIVE: 'pill-paid',
  NOTICE_GIVEN: 'pill-part',
  VACATED: 'pill-full',
  BLACKLISTED: 'pill-out',
};
const STATUS_LABEL = {
  ACTIVE: 'Active',
  NOTICE_GIVEN: 'Notice given',
  VACATED: 'Vacated',
  BLACKLISTED: 'Blacklisted',
};

export default async function StudentsPage({ searchParams }) {
  const params = (await searchParams) ?? {};
  const q = (params.q ?? '').trim();
  const status = params.status ?? 'ACTIVE';

  const students = await prisma.student.findMany({
    where: {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q.replace(/[^0-9]/g, '') } },
              { email: { contains: q, mode: 'insensitive' } },
              { idNumber: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      occupancies: { where: { status: 'ACTIVE' }, include: { room: true }, take: 1 },
    },
    orderBy: { fullName: 'asc' },
    take: 300,
  });

  const total = await prisma.student.count();

  if (total === 0) {
    return (
      <>
        <PageHeader eyebrow="People" title="Students" />
        <Empty
          title="No students on file"
          body="Add each student once, then put them in a room. Their record keeps its history even after they leave."
          actionHref="/admin/students/new"
          actionLabel="Add the first student"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="People" title="Students" count={students.length}>
        <Link href="/admin/students/new" className="btn btn-primary">Add student</Link>
      </PageHeader>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          className="field max-w-xs"
          placeholder="Search name, phone or ID"
          aria-label="Search students"
        />
        <select name="status" defaultValue={status} className="field w-auto" aria-label="Filter by status">
          <option value="ACTIVE">Active</option>
          <option value="NOTICE_GIVEN">Notice given</option>
          <option value="VACATED">Vacated</option>
          <option value="BLACKLISTED">Blacklisted</option>
          <option value="ALL">All</option>
        </select>
        <button type="submit" className="btn btn-quiet">Search</button>
        {q || status !== 'ACTIVE' ? (
          <Link href="/admin/students" className="text-sm text-enamel hover:underline">Clear</Link>
        ) : null}
      </form>

      {students.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-ink-soft">
          Nobody matches that search.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Room</th>
                <th>Institution</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const room = s.occupancies[0]?.room;
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/students/${s.id}`} className="font-medium text-enamel hover:underline">
                        {s.fullName}
                      </Link>
                    </td>
                    <td className="num text-ink-soft">{displayPhone(s.phone)}</td>
                    <td className="num">
                      {room ? (
                        <Link href={`/admin/rooms/${room.id}`} className="hover:underline">{room.code}</Link>
                      ) : (
                        <span className="text-ink-faint">Not housed</span>
                      )}
                    </td>
                    <td className="text-ink-soft">{s.institution || '—'}</td>
                    <td>
                      <span className={`pill ${STATUS_TONE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
