/**
 * 🏗️ Root Layout (Kerangka Halaman)
 * ---------------------------------
 * File wajib Next.js App Router — membungkus SEMUA halaman.
 *
 * Fungsi:
 *  - Load font Roboto (sans) + Roboto Mono dari Google Fonts
 *  - Set metadata global: judul tab browser & deskripsi
 *  - Inline script anti-FOUC: terapkan tema (dark/light) sebelum paint
 *  - Tema dikontrol via class `dark` di <html> + CSS design tokens
 *
 * Semua halaman (/, /api/*) akan dirender di dalam <body> ini.
 */
import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cek API — Monitor API Key",
  description:
    "Dashboard personal untuk memeriksa validitas API key dan sisa kuota berbagai provider AI.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${roboto.variable} ${robotoMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-FOUC: terapkan tema sebelum paint (baca localStorage) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full">
        <div className="relative flex min-h-screen flex-col">
          <div className="relative z-10 flex flex-1 flex-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
