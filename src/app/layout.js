import { IBM_Plex_Sans, IBM_Plex_Mono, IBM_Plex_Sans_Condensed } from 'next/font/google';
import './globals.css';

const sans = IBM_Plex_Sans({
  subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans', display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap',
});
const cond = IBM_Plex_Sans_Condensed({
  subsets: ['latin'], weight: ['500', '600'], variable: '--font-plex-cond', display: 'swap',
});

export const metadata = {
  title: 'Lepamus Residency',
  description: 'Hostel and rentals management',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${cond.variable}`}>
      {/* Extensions write their own attributes onto body before React hydrates.
          Suppression is shallow — it covers this element's attributes only, so a
          real mismatch anywhere inside still reports. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
