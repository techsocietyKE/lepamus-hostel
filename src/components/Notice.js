/** Errors say what happened and how to fix it. They do not apologise. */
export default function Notice({ tone = 'error', children }) {
  if (!children) return null;
  const styles = {
    error: 'border-unpaid/30 bg-unpaid-tint text-unpaid',
    done: 'border-paid/30 bg-paid-tint text-paid',
    info: 'border-enamel/20 bg-enamel-tint text-enamel-dark',
  }[tone];
  return (
    <div className={`rounded-sm border px-3 py-2 text-sm ${styles}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
