import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyAdminSession } from '@/lib/server/admin-auth';

import './admin.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '新增唱片｜Utopia Vinyl 私人管理',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const session = await verifyAdminSession(requestHeaders.get('cookie'));
  if (!session.ok) redirect('/vinyl-login');

  return children;
}
