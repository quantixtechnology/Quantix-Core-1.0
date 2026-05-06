import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quantix Technology - Managed White-Label SaaS Platform",
  description: "Run Your Business Smarter. Managed white-label multi-tenant SaaS platform for Grocery, Food Delivery, Laundry, Car Wash, Pharmacy, Home Services and more.",
  keywords: ["Quantix", "SaaS", "White-Label", "Multi-Tenant", "Business Platform", "India"],
  authors: [{ name: "Quantix Technology" }],
  openGraph: {
    title: "Quantix Technology",
    description: "Run Your Business Smarter - Managed White-Label SaaS Platform",
    siteName: "Quantix Technology",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantix Technology",
    description: "Run Your Business Smarter - Managed White-Label SaaS Platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
