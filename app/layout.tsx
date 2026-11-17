import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Band";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Band Jams",
  description: "Our jam sessions: listen, vote and pick what to work on next.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e0f12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <Nav />
          <main className="wrap">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
