export default function PageHeader({ eyebrow, title, count, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="font-cond text-2xl font-semibold tracking-tight">
          {title}
          {count !== undefined && count !== null ? (
            <span className="num ml-2 text-lg font-normal text-ink-faint">{count}</span>
          ) : null}
        </h1>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
