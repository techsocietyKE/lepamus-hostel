import Link from 'next/link';

/** An empty screen is an invitation to act, not an apology. */
export default function Empty({ title, body, actionHref, actionLabel }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="font-cond text-lg font-semibold">{title}</p>
      {body ? <p className="mt-1.5 text-sm text-ink-soft max-w-md mx-auto">{body}</p> : null}
      {actionHref ? (
        <Link href={actionHref} className="btn btn-primary mt-5">{actionLabel}</Link>
      ) : null}
    </div>
  );
}
