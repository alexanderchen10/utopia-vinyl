import type { Metadata } from 'next';

import './globals.css';

const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Utopia Vinyl｜黑膠理想國',
  description: 'Utopia Vinyl 自 2009 年起提供豐富的古典、爵士、流行與臺灣黑膠唱片。',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Utopia Vinyl｜黑膠理想國',
    description: 'Utopia Vinyl 自 2009 年起提供豐富的古典、爵士、流行與臺灣黑膠唱片。',
    images: [{ url: '/og.png', width: 1536, height: 1024, alt: 'Utopia Vinyl 黑膠理想國' }],
    type: 'website',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Utopia Vinyl｜黑膠理想國',
    description: 'Utopia Vinyl 自 2009 年起提供豐富的古典、爵士、流行與臺灣黑膠唱片。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
