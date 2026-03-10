"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signUp } from "./actions";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signUp(new FormData(e.currentTarget));
      window.location.href = "/login?registered=1";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account");
      setLoading(false);
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
            <Image src="/logo.png" alt="MIBH Logo" width={72} height={72} className="rounded-lg object-contain" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>GC Portal</h1>
          <p className="text-sm mt-1" style={{ color: "#8b949e" }}>Create your account</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "#161b22", border: "1px solid #30373f" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>Company Name</label>
              <input type="text" name="companyName" required placeholder="e.g. MIBH Construction"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>Your Name</label>
              <input type="text" name="name" required placeholder="e.g. John Smith"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>Email</label>
              <input type="email" name="email" required placeholder="john@example.com"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>Password</label>
              <input type="password" name="password" required minLength={8} placeholder="Min. 8 characters"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none" style={inputStyle} />
            </div>
            {error && (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "#ef444422", border: "1px solid #ef444455", color: "#ef4444" }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
              style={{ background: "#C9A84C", color: "#0d1117" }}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: "#8b949e" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-medium" style={{ color: "#C9A84C" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
