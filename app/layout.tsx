import type { Metadata } from 'next';

import './globals.css';

const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: '父親的唱片櫃｜Dad’s Vinyl',
  description: '古典、爵士、流行與臺灣黑膠唱片專門店。',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: '父親的唱片櫃｜Dad’s Vinyl',
    description: '古典、爵士、流行與臺灣黑膠唱片專門店。',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: '父親的唱片櫃' }],
    type: 'website',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: '父親的唱片櫃｜Dad’s Vinyl',
    description: '古典、爵士、流行與臺灣黑膠唱片專門店。',
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
