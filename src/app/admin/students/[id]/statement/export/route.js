import { prisma } from '@/lib/db';
import { requireStaff } from '@/auth';
import { csvMoney, csvResponse } from '@/lib/csv';
import { isoDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';

const METHOD_LABEL = { CASH: 'Cash', MPESA_TILL: 'M-Pesa Till', BANK: 'Bank' };

export async function GET(request, { params }) {
  try {
    await requireStaff();
  } catch {
    return new Response('Sign in first.', { status: 401 });
  }

  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      occupancies: {
        where: { status: 'ACTIVE' },
        include: { room: { select: { code: true } } },
        take: 1,
      },
      invoices: { include: { period: { select: { year: true, month: true, label: true } } } },
      payments: {
        where: { status: { in: ['APPROVED', 'REVERSED'] } },
        orderBy: { paidAt: 'asc' },
      },
    },
  });
  if (!student) return new Response('No such student.', { status: 404 });

  const invoices = [...student.invoices].sort(
    (a, b) => (a.period.year * 12 + a.period.month) - (b.period.year * 12 + b.period.month),
  );

  const rows = [
    ['Lepamus Residency — student statement'],
    [student.fullName],
    ['Room', student.occupancies[0]?.room.code ?? 'Not allocated'],
    ['Produced', isoDate()],
    [],
    ['Month', 'Invoice', 'Opening', 'Rent share', 'Charges', 'Discount', 'Payable', 'Paid', 'Closing', 'Status', 'Discount reason'],
  ];

  for (const inv of invoices) {
    rows.push([
      inv.period.label,
      inv.invoiceNo,
      csvMoney(inv.openingBalance),
      csvMoney(inv.rentShare),
      csvMoney(inv.chargesTotal),
      csvMoney(inv.discount),
      csvMoney(inv.totalPayable),
      csvMoney(inv.amountPaid),
      csvMoney(inv.closingBalance),
      inv.status,
      inv.discountReason ?? '',
    ]);
  }

  rows.push([]);
  rows.push(['Payments']);
  rows.push(['Receipt', 'Method', 'Code', 'Date paid', 'Amount', 'Status']);
  for (const p of student.payments) {
    rows.push([
      p.receiptNo ?? '',
      METHOD_LABEL[p.method] ?? p.method,
      p.transactionCode ?? '',
      isoDate(p.paidAt),
      csvMoney(p.amount),
      p.status,
    ]);
  }

  const balance = invoices.length > 0
    ? invoices[invoices.length - 1].closingBalance
    : student.openingBalance;
  rows.push([]);
  rows.push(['Balance', csvMoney(balance), balance < 0 ? 'in credit' : balance > 0 ? 'owing' : 'settled']);

  const slug = student.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return csvResponse(rows, `statement-${slug}.csv`);
}
