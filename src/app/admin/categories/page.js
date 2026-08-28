import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import PageHeader from '@/components/PageHeader';
import Empty from '@/components/Empty';
import CategoryCard from './CategoryCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categories — Lepamus Residency' };

export default async function CategoriesPage() {
  const session = await auth();
  const readOnly = session?.user?.role !== 'SUPER_ADMIN';

  const categories = await prisma.roomCategory.findMany({
    orderBy: { capacity: 'asc' },
    include: { _count: { select: { rooms: true } } },
  });

  return (
    <>
      <PageHeader eyebrow="Structure" title="Categories" count={categories.length} />
      <p className="-mt-2 mb-6 max-w-2xl text-sm text-ink-soft">
        A category is the grouping a visitor sees on the website — Single, 2
        Sharing, 3 Sharing. It follows from a room&rsquo;s capacity and is never
        chosen by hand, so the two can never disagree. What is set here is how
        each one presents itself publicly.
      </p>

      {categories.length === 0 ? (
        <Empty
          title="No categories yet"
          body="A category appears as soon as a room of that capacity exists. Add a room and it will show up here."
          actionHref="/admin/rooms/new"
          actionLabel="Add a room"
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} readOnly={readOnly} />
          ))}
        </div>
      )}
    </>
  );
}
