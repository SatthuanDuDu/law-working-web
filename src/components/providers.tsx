"use client";

import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import type { AbstractIntlMessages } from "next-intl";

export function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Ho_Chi_Minh">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
