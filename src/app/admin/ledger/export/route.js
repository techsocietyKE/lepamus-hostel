import { prisma } from '@/lib/db';
import { requireStaff } from '@/auth';
import { ledgerFor } from '@/lib/billing';
import { csvMoney, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

/**
 * The monthly sheet as a spreadsheet — §5.7. Read-only, so GET is right; every
 * route that changes data is a POST.
 */
export async function GET(request) {
  try {
    await requireStaff();
  } catch {
    return new Response('Sign in first.', { status: 401 });
  }

  const periodId = new URL(request.url).searchParams.get('period');
  const period = periodId
    ? await prisma.billingPeriod.findUnique({ where: { id: periodId } })
    : await prisma.billingPeriod.findFirst({ orderBy: [{ year: 'desc' }, { month: 'desc' }] });

  if (!period) return new Response('No billing month to export.', { status: 404 });

  const { rooms, totals } = await ledgerFor(period.id);

  const rows = [
    [`Lepamus Residency — monthly sheet`],
    [period.label],
    [],
    ['Block', 'Room', 'Student', 'Opening', 'Rent share', 'Charges', 'Discount', 'Payable', 'Paid', 'Balance', 'Status'],
  ];

  for (const room of rooms) {
    for (const inv of room.rows) {
      rows.push([
        room.blockName,
        room.roomCode,
        inv.student.fullName,
        csvMoney(inv.openingBalance),
        csvMoney(inv.rentShare),
        csvMoney(inv.chargesTotal),
        csvMoney(inv.discount),
        csvMoney(inv.totalPayable),
        csvMoney(inv.amountPaid),
        csvMoney(inv.closingBalance),
        inv.status,
      ]);
    }
  }

  rows.push([]);
  rows.push([
    '', '', 'Hostel total',
    csvMoney(totals.opening),
    csvMoney(totals.rent),
    csvMoney(totals.charges),
    '',
    '',
    csvMoney(totals.paid),
    csvMoney(totals.balance),
    '',
  ]);

  const slug = `${period.year}-${String(period.month).padStart(2, '0')}`;
  return csvResponse(rows, `lepamus-sheet-${slug}.csv`);
}
