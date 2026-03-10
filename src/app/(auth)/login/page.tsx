"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  const inputStyle = {
    background: "#0d1117",
    border: "1px solid #30373f",
    color: "#e6edf3",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0d1117" }}>
      <div className="w-full max-w-sm">
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1.5px solid #C9A84C44", padding: "4px", background: "#1e2736" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="MIBH Logo" width={72} height={72} className="rounded-lg object-contain" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>GC Portal</h1>
          <p className="text-sm mt-1" style={{ color: "#8b949e" }}>Sign in to continue</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "#161b22", border: "1px solid #30373f" }}>
          {registered && (
            <div className="rounded-lg px-3 py-2 text-sm mb-5" style={{ background: "#22c55e22", border: "1px solid #22c55e55", color: "#22c55e" }}>
              Account created — sign in below.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={inputStyle}
                placeholder="mike@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={inputStyle}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "#ef444422", border: "1px solid #ef444455", color: "#ef4444" }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: "#8b949e" }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium" style={{ color: "#C9A84C" }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
