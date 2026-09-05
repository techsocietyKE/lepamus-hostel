"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-wall">
      <div className="w-full max-w-md card p-6">
        <div className="text-center mb-6">
          <h1 className="font-cond text-2xl font-semibold text-ink">Hostel Portal Login</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Access your student statement or staff dashboard
          </p>
        </div>

        {/* First-Time Student Helper */}
        <div className="mb-6 p-4 rounded-sm bg-wall border border-rule">
          <h3 className="text-sm font-semibold text-ink mb-1.5">First time logging in?</h3>
          <div className="text-xs text-ink-soft space-y-1">
            <p>
              <span className="font-medium text-ink">Username:</span> the phone number or email you used to book.
            </p>
            <p>
              <span className="font-medium text-ink">Password:</span>{" "}
              <code className="bg-paper border border-rule px-1.5 py-0.5 rounded-sm font-mono text-ink">
                student123
              </code>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs rounded-sm bg-wall border border-rule text-ink">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              Phone Number or Email
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 0712345678"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-sm border border-rule bg-paper text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-enamel"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 text-sm rounded-sm border border-rule bg-paper text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-enamel"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}