import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import StudentForm from './StudentForm';

export const metadata = { title: 'Add student — Lepamus Residency' };

export default function NewStudentPage() {
  return (
    <>
      <PageHeader eyebrow="People" title="Add a student">
        <Link href="/admin/students" className="btn btn-quiet">Back to students</Link>
      </PageHeader>
      <StudentForm />
    </>
  );
}
