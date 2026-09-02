import { prisma } from '@/lib/db';
import BookingForm from './BookingForm';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Booking enquiry — Lepamus Residency',
  description: 'Tell us what you are looking for. No account and no payment needed.',
};

export default async function BookPage({ searchParams }) {
  const params = await searchParams;
  const [categories, settings] = await Promise.all([
    prisma.roomCategory.findMany({
      where: { isPublic: true },
      orderBy: { capacity: 'asc' },
      select: { id: true, name: true, capacity: true },
    }),
    prisma.settings.findUnique({ where: { id: 'singleton' } }),
  ]);

  return (
    <>
      <h1 className="font-cond text-2xl font-semibold tracking-tight">Booking enquiry</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Tell us what you are looking for. No account, no payment, and nothing is
        confirmed until the office replies with a room — normally the same day.
        {params?.room ? (
          <> You were looking at room <span className="num font-medium text-ink">{String(params.room).slice(0, 20)}</span>.</>
        ) : null}
      </p>

      <BookingForm
        categories={categories}
        preselected={typeof params?.category === 'string' ? params.category : ''}
        preselectedRoom={typeof params?.room === 'string' ? params.room : ''}
        holdDays={settings?.bookingHoldDays ?? 5}
      />
    </>
  );
}
