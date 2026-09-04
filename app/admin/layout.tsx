import type { Metadata } from 'next';

import './admin.css';

export const metadata: Metadata = {
  title: '新增唱片｜Utopia Vinyl 私人管理',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
