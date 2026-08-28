import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { displayPhone } from '@/lib/validation';
import PageHeader from '@/components/PageHeader';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings — Lepamus Residency' };

const defaults = {
  hostelName: 'Lepamus Residency',
  tillNumber: '4806384',
  tillBusinessName: 'LEPAMUS RESIDENCY',
  contactPhone: null,
  contactEmail: null,
  location: null,
  rentDueDay: 5,
  graceDays: 7,
  bookingHoldDays: 5,
  cleaningDelayDays: 1,
  staleClaimDays: 2,
  smsEnabled: false,
  emailEnabled: false,
};

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/admin');

  const settings = (await prisma.settings.findUnique({ where: { id: 'singleton' } })) ?? defaults;

  return (
    <>
      <PageHeader eyebrow="Administration" title="Settings" />
      <p className="-mt-2 mb-6 max-w-2xl text-sm text-ink-soft">
        The figures the system runs on. They are held here rather than in code,
        so none of them needs a developer to change.
      </p>
      <SettingsForm
        settings={settings}
        contactPhoneDisplay={settings.contactPhone ? displayPhone(settings.contactPhone) : null}
      />
    </>
  );
}
