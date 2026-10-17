'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileSpreadsheet, Search } from 'lucide-react';

import { AdminSectionNav } from '@/components/admin/admin-section-nav';
import { categoryLabels, type VinylRecord } from '@/lib/catalog';

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function UploadHistoryPage() {
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('正在讀取上架紀錄…');

  useEffect(() => {
    void fetch('/api/admin/records', { credentials: 'same-origin' })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign('/vinyl-login');
          return null;
        }
        const result = (await response.json()) as { records?: VinylRecord[]; message?: string };
        if (!response.ok) throw new Error(result.message || '暫時無法讀取上架紀錄。');
        return result.records ?? [];
      })
      .then((items) => {
        if (!items) return;
        setRecords(items);
        setMessage('');
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : '暫時無法讀取上架紀錄。'),
      );
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...records]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .filter((record) =>
        !needle || [record.batchNumber, record.title, record.composers, record.performers,
          record.label, record.catalogNumber].join(' ').toLocaleLowerCase().includes(needle),
      );
  }, [query, records]);

  return (
    <main className="admin-page admin-docs-page">
      <header className="admin-docs-header admin-shell">
        <div><p>唱片管理</p><h1>上架紀錄</h1><span>依日期查看每一張已加入系統的唱片資料。</span></div>
        <a className="back-to-shop" href="/"><ArrowLeft aria-hidden="true" /> 回到商店</a>
      </header>
      <AdminSectionNav current="history" />
      <section className="admin-docs-shell admin-shell">
        <div className="admin-docs-title">
          <div><FileSpreadsheet aria-hidden="true" /><h2>唱片上架資料表</h2></div>
          <label className="manage-search"><Search aria-hidden="true" /><span className="sr-only">搜尋紀錄</span><input onChange={(event) => setQuery(event.target.value)} placeholder="搜尋批次、名稱或編號" type="search" value={query} /></label>
        </div>
        {message ? <p className="admin-docs-message">{message}</p> : (
          <div className="admin-record-table-wrap">
            <table className="admin-record-table">
              <thead><tr><th>上傳日期</th><th>批次</th><th>唱片名稱</th><th>分類</th><th>作曲家／演奏家</th><th>唱片公司／編號</th><th>售價</th><th>狀態</th></tr></thead>
              <tbody>{filtered.map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.createdAt)}</td><td><strong>{record.batchNumber || '未設定'}</strong></td><td>{record.title}</td><td>{categoryLabels[record.category]}</td>
                  <td>{[record.composers, record.performers].filter(Boolean).join('／') || '—'}</td><td>{[record.label, record.catalogNumber].filter(Boolean).join('・') || '—'}</td><td>{record.price}</td><td>{record.status === 'published' ? '商店顯示中' : '已隱藏'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
