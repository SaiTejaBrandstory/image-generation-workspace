import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} data-theme="dark">
      <body className="h-full overflow-hidden antialiased">{children}</body>
    </html>
  );
}
