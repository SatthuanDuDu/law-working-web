"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tPages = useTranslations("pages");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t("invalidCredentials"));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-primary-hover to-[#0b3a20] p-4 sm:p-6">
      <Card className="w-full max-w-md border-border shadow-[var(--shadow-overlay)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-surface ring-1 ring-border">
            <Image
              src="/logo-nslaw.png"
              alt="NSLAW"
              width={80}
              height={80}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <CardTitle>{tPages("fallback.title")}</CardTitle>
          <CardDescription>
            {t("loginSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t("username")}</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="admin"
                required
                className="text-base sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="text-base sm:text-sm"
              />
            </div>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Button type="submit" className="interactive-press w-full" disabled={loading}>
              {loading ? t("signingIn") : t("signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
