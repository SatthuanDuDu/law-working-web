import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NSLAW Work Manager",
  description: "Hệ thống quản lý công việc nội bộ cho công ty luật",
};

// Keep zoom enabled and layout stable; prevents iOS auto-zoom side effects.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${openSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
