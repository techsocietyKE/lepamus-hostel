'use client';

/** Printing is how a statement becomes a PDF — the browser already does it well. */
export default function PrintButton() {
  return (
    <button type="button" className="btn btn-quiet no-print" onClick={() => window.print()}>
      Print / save as PDF
    </button>
  );
}
