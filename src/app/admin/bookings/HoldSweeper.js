"use client";

import { useState, useTransition } from "react";
import { sweepExpiredHoldsAction } from "@/actions/bookings";

export default function HoldSweeper() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState(null);

  const handleSweep = () => {
    setResult(null);
    startTransition(async () => {
      const res = await sweepExpiredHoldsAction();
      if (res?.success) {
        setResult({
          type: "success",
          message:
            res.count > 0
              ? `Cleared ${res.count} expired hold${res.count === 1 ? "" : "s"}.`
              : "No expired holds to sweep.",
        });
      } else {
        setResult({
          type: "error",
          message: res?.error || "Failed to sweep expired holds.",
        });
      }
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Hold Sweeper
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Scan and restore beds locked by timed-out or unconfirmed bookings.
        </p>
        {result && (
          <p
            className={`text-xs mt-1.5 font-medium ${
              result.type === "success"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {result.message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleSweep}
        disabled={isPending}
        className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors whitespace-nowrap"
      >
        {isPending ? (
          <span className="flex items-center gap-1.5">
            <svg
              className="animate-spin h-3.5 w-3.5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Sweeping...
          </span>
        ) : (
          "Sweep Expired Holds"
        )}
      </button>
    </div>
  );
}