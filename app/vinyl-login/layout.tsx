import type { Metadata } from 'next';

import '../admin/admin.css';

export const metadata: Metadata = {
  title: '私人登入｜Utopia Vinyl',
  robots: { index: false, follow: false },
};

export default function VinylLoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
