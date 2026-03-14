"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api<{
        success: boolean;
        data: { user: any; token: string };
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setAuth(res.data.user, res.data.token);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-[hsl(330,55%,48%)] p-12 lg:flex">
        <div>
          <Image
            src="https://sunshinebrazilian.com/wp-content/uploads/2025/05/Logo-horizontal-preto.png"
            alt="Sunshine Brazilian"
            width={220}
            height={50}
            className="brightness-0 invert"
            unoptimized
          />
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-white">
            Smart Lead Management
            <br />
            <span className="text-[hsl(258,60%,72%)]">Powered by AI</span>
          </h1>
          <p className="max-w-md text-lg text-white/60">
            Automate your outreach with SunnyBee AI. Manage leads, track calls,
            and grow your business — all in one place.
          </p>
        </div>
        <p className="text-sm text-white/30">
          © {new Date().getFullYear()} Sunshine WL Brazilian LLC
        </p>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full flex-col items-center justify-center bg-[hsl(270,20%,97%)] px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Image
              src="https://sunshinebrazilian.com/wp-content/uploads/2025/05/Logo-horizontal-preto.png"
              alt="Sunshine Brazilian"
              width={200}
              height={45}
              unoptimized
            />
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold">Welcome back</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              <Button
                type="submit"
                className="w-full rounded-xl bg-primary py-5 text-base font-semibold hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
