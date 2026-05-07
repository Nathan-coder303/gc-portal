"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm" style={{ color: "#f85149" }}>Invalid or missing reset token.</p>
        <Link href="/forgot-password" className="text-sm font-medium" style={{ color: "#C9A84C" }}>Request a new link →</Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    setLoading(false);
    if (!res.ok || !json.ok) { setError(json.error ?? "Reset failed — link may have expired"); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" };

  return done ? (
    <div className="text-center space-y-3">
      <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "#22c55e22", border: "1px solid #22c55e55", color: "#22c55e" }}>
        Password updated! Redirecting to login…
      </div>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>New password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
          placeholder="••••••••" className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none" style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>Confirm password</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
          placeholder="••••••••" className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none" style={inputStyle} />
      </div>
      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "#ef444422", border: "1px solid #ef444455", color: "#ef4444" }}>{error}</div>}
      <button type="submit" disabled={loading}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
        style={{ background: "#C9A84C", color: "#0d1117" }}>
        {loading ? "Saving…" : "Set new password"}
      </button>
      <p className="text-center text-xs"><Link href="/login" className="font-medium" style={{ color: "#8b949e" }}>← Back to sign in</Link></p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0d1117" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1.5px solid #C9A84C44", padding: "4px", background: "#1e2736" }}>
            <Image src="/logo.png" alt="MIBH Logo" width={72} height={72} className="rounded-lg object-contain" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>New Password</h1>
        </div>
        <div className="rounded-2xl p-8" style={{ background: "#161b22", border: "1px solid #30373f" }}>
          <Suspense><ResetForm /></Suspense>
        </div>
      </div>
    </div>
  );
}
