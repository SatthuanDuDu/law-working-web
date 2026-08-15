import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-app",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return {
    title: "NSLAW Work Manager",
    description: t("siteDescription"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "NSLAW",
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: "/favicon.png", type: "image/png", sizes: "32x32" },
        { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: "/favicon.png",
    },
  };
}

// Keep zoom enabled and layout stable; prevents iOS auto-zoom side effects.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
