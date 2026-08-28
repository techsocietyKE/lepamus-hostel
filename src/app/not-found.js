import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <p className="eyebrow">Not found</p>
      <h1 className="font-cond mt-1 text-2xl font-semibold">That page does not exist</h1>
      <p className="mt-2 text-sm text-ink-soft">
        The link may be out of date, or the record may have been removed.
      </p>
      <Link href="/admin" className="btn btn-primary mt-6 self-center">Back to the dashboard</Link>
    </main>
  );
}
