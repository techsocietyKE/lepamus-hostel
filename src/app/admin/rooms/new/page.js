import Link from 'next/link';
import { prisma } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import RoomForms from './RoomForms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add rooms — Lepamus Residency' };

export default async function NewRoomPage() {
  const blocks = await prisma.block.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeader eyebrow="Rooms" title="Add rooms">
        <Link href="/admin/rooms" className="btn btn-quiet">Back to rooms</Link>
      </PageHeader>
      <RoomForms blocks={blocks} />
    </>
  );
}
