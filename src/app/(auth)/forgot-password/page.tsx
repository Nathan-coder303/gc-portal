"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Fire-and-forget — always show success to avoid user enumeration
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setLoading(false);
    setSubmitted(true);
  }

  const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0d1117" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1.5px solid #C9A84C44", padding: "4px", background: "#1e2736" }}>
            <Image src="/logo.png" alt="MIBH Logo" width={72} height={72} className="rounded-lg object-contain" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>Reset Password</h1>
          <p className="text-sm mt-1 text-center" style={{ color: "#8b949e" }}>
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "#161b22", border: "1px solid #30373f" }}>
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "#22c55e22", border: "1px solid #22c55e55", color: "#22c55e" }}>
                If an account exists for <strong>{email}</strong>, a reset link has been sent.
              </div>
              <p className="text-xs" style={{ color: "#8b949e" }}>
                Check your inbox and spam folder. The link expires in 1 hour.
              </p>
              <Link href="/login" className="block text-sm font-medium mt-4" style={{ color: "#C9A84C" }}>
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="mike@example.com"
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <p className="text-center text-xs" style={{ color: "#8b949e" }}>
                <Link href="/login" className="font-medium" style={{ color: "#C9A84C" }}>← Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
