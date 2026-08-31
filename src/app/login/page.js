"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid login details. Check your phone/email and password.");
      setLoading(false);
    } else {
      router.push("/after-login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Hostel Portal Login
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Access your student statement or staff dashboard
          </p>
        </div>

        {/* First-Time Student Helper Card */}
        <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1.5 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            First time logging in?
          </h3>
          <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <p><strong>Username:</strong> The Phone Number or Email you used to book.</p>
            <p><strong>Password:</strong> <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded font-mono font-bold">student123</code></p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs rounded-md bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Phone Number or Email
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 0712345678"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

      </div>
    </div>
  );
}