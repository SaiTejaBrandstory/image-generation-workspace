import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { OVERLAY_GOOGLE_FONTS_HREF } from "@/lib/overlay-fonts";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-satoshi",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Brandwise — AI Layout Generation Workspace",
  description:
    "Conversational AI creative operating system for 20 professional layout systems",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href={OVERLAY_GOOGLE_FONTS_HREF} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full overflow-hidden antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
