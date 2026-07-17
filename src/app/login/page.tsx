"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email hoặc mật khẩu không đúng");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-primary-hover to-[#0b3a20] p-6">
      <Card className="w-full max-w-md border-border shadow-[var(--shadow-overlay)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border">
            <Image
              src="/logo-nslaw.png"
              alt="NSLAW"
              width={80}
              height={80}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <CardTitle>NSLAW Work Manager</CardTitle>
          <CardDescription>
            Hệ thống quản lý công việc nội bộ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@luat.vn"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>
          <div className="mt-6 rounded-lg bg-muted p-4 text-xs text-slate-500">
            {process.env.NODE_ENV === "development" && (
              <>
                <p className="font-medium text-primary">Tài khoản demo (local seed):</p>
                <p>admin@luat.vn / password123</p>
                <p>luatsu1@luat.vn / password123</p>
              </>
            )}
            <p className={process.env.NODE_ENV === "development" ? "mt-2" : undefined}>
              Quên mật khẩu? Liên hệ quản trị viên để được đặt lại, hoặc đăng nhập
              rồi đổi mật khẩu trong mục Cài đặt.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
