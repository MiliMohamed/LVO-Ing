import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans, Montserrat } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "LVO Ingénierie — Mobilité verticale & CRM",
  description:
    "Bureau d'études mobilité verticale — ascenseurs, escaliers mécaniques et CRM interne.",
  icons: {
    icon: "/logo-lvo.svg",
    apple: "/logo-lvo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${bebasNeue.variable} ${dmSans.variable} ${montserrat.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
