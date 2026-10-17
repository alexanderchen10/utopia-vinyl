'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

import { AdminSectionNav } from '@/components/admin/admin-section-nav';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { categoryLabels, type VinylRecord } from '@/lib/catalog';

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];
const dateKey = (value?: string) => value?.slice(0, 10) ?? '';
const pad = (value: number) => String(value).padStart(2, '0');

export default function UploadCalendarPage() {
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState('');
  const [message, setMessage] = useState('正在讀取上架日曆…');

  useEffect(() => {
    void fetch('/api/admin/records', { credentials: 'same-origin' })
      .then(async (response) => {
        if (response.status === 401) { window.location.assign('/vinyl-login'); return null; }
        const result = (await response.json()) as { records?: VinylRecord[]; message?: string };
        if (!response.ok) throw new Error(result.message || '暫時無法讀取上架日曆。');
        return result.records ?? [];
      })
      .then((items) => { if (items) { setRecords(items); setMessage(''); } })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '暫時無法讀取上架日曆。'));
  }, []);

  const grouped = useMemo(() => records.reduce<Record<string, VinylRecord[]>>((result, record) => {
    const key = dateKey(record.createdAt);
    if (key) (result[key] ??= []).push(record);
    return result;
  }, {}), [records]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const count = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstWeekday + 1;
      if (day < 1 || day > count) return null;
      const key = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
      return { day, key, records: grouped[key] ?? [] };
    });
  }, [grouped, month]);
  const selected = grouped[selectedDate] ?? [];

  return (
    <main className="admin-page admin-docs-page">
      <header className="admin-docs-header admin-shell"><div><p>唱片管理</p><h1>上架日曆</h1><span>按有標記的日期，即可查看當天加入的唱片。</span></div><a className="back-to-shop" href="/"><ArrowLeft aria-hidden="true" /> 回到商店</a></header>
      <AdminSectionNav current="calendar" />
      <section className="admin-docs-shell admin-shell">
        <div className="calendar-toolbar"><button aria-label="上一個月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} type="button"><ChevronLeft /></button><h2>{month.getFullYear()} 年 {month.getMonth() + 1} 月</h2><button aria-label="下一個月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} type="button"><ChevronRight /></button></div>
        {message ? <p className="admin-docs-message">{message}</p> : (
          <div className="upload-calendar"><div className="calendar-weekdays">{weekdayLabels.map((day) => <span key={day}>週{day}</span>)}</div><div className="calendar-grid">{cells.map((cell, index) => cell ? (
            <button className={cell.records.length ? 'has-records' : ''} disabled={!cell.records.length} key={cell.key} onClick={() => setSelectedDate(cell.key)} type="button"><span>{cell.day}</span>{cell.records.length ? <><strong>{cell.records.length} 張</strong><small>{cell.records.slice(0, 2).map((record) => record.batchNumber || record.title).join('、')}</small></> : null}</button>
          ) : <span className="calendar-empty-cell" key={`empty-${index}`} />)}</div></div>
        )}
      </section>
      <Dialog onOpenChange={(open) => { if (!open) setSelectedDate(''); }} open={Boolean(selectedDate)}><DialogContent className="calendar-record-dialog"><DialogHeader><DialogTitle>{selectedDate} 上架唱片</DialogTitle><DialogDescription>共 {selected.length} 張唱片</DialogDescription></DialogHeader><div className="calendar-record-list">{selected.map((record) => <article key={record.id}><div><Image alt={`${record.title} 封面`} fill sizes="72px" src={record.image} unoptimized={record.image.startsWith('/api/')} /></div><section><small>{record.batchNumber || '未設定批次'}・{categoryLabels[record.category]}</small><h3>{record.title}</h3><p>{[record.composers, record.performers].filter(Boolean).join('／') || '尚未填寫演出資料'}</p><span>{[record.label, record.catalogNumber, record.price].filter(Boolean).join('・')}</span></section></article>)}</div></DialogContent></Dialog>
    </main>
  );
}
