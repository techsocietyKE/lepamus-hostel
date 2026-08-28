import { prisma } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import BlockManager from './BlockManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Blocks — Lepamus Residency' };

export default async function BlocksPage() {
  const blocks = await prisma.block.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { rooms: true } } },
  });

  return (
    <>
      <PageHeader eyebrow="Structure" title="Blocks" count={blocks.length} />
      <p className="-mt-2 mb-6 max-w-2xl text-sm text-ink-soft">
        Blocks group rooms for navigation and reporting. They carry no gender of
        their own — that is set on each room, so one block can hold men&rsquo;s,
        women&rsquo;s and mixed rooms side by side.
      </p>
      <BlockManager blocks={blocks} />
    </>
  );
}
