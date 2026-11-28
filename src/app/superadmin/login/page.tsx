"use client";

import { useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext"; // or "@/contexts/AdminAuthContext"
import { Lock, Mail, ShieldAlert, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAdminAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await login(email, password);
      if (!result.ok) {
        setError(
          result.error ||
            "Invalid email or password. Please check your credentials.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#FAF9F5]">
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-xl p-8 md:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-[#1C3516]/10 text-[#1C3516] mb-3">
            <Lock className="size-6" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1C3516]">
            Admin Portal
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Sign in with your assigned account to access the management console
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 size-4 text-stone-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@trumate.com"
                className="w-full rounded-xl border border-stone-300 bg-stone-50 pl-10 pr-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C3516]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 size-4 text-stone-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-stone-300 bg-stone-50 pl-10 pr-11 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C3516]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-3.5 text-stone-400 hover:text-stone-600"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-[#1C3516] text-white text-sm font-medium shadow-md transition-all hover:bg-[#274a20] disabled:opacity-50"
          >
            {submitting ? "Signing In..." : "Sign In to Dashboard"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-stone-400">
          Role &amp; Permission Protected Access
        </div>
      </div>
    </div>
  );
}
