import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oughter = localFont({
  src: "../../public/fonts/Oughter.otf",
  variable: "--font-oughter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Inertia Leads - AI-Powered Lead Generation & Cold Email Outreach",
  description: "Find leads, generate personalized cold emails with AI, and send them automatically with inbox rotation.",
  icons: {
    icon: "/images/favicon-2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ background: "#0d0a25", colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0d0a25" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${oughter.variable} antialiased`}
        style={{ background: "#0d0a25" }}
      >
        {children}
      </body>
    </html>
  );
}
