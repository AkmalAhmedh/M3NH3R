import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { CapacitorInit } from "@/components/CapacitorInit";

export const metadata: Metadata = {
  title: "M3NH3R | Our Universe",
  description: "A living cinematic universe built by two hearts.",
  // PWA / mobile web app meta
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "M3NH3R",
  },
  applicationName: "M3NH3R",
};

export const viewport: Viewport = {
  // Prevent zoom on input focus on iOS
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Extend content into safe areas (notch, home bar)
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <head>
        {/* Prevent iOS bounce & ensure correct safe area behaviour */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="min-h-dvh bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden flex flex-col status-bar-safe">
        <AppProvider>
          <CapacitorInit />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
