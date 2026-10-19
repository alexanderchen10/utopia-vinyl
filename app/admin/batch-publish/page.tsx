'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, Check, LoaderCircle, Upload } from 'lucide-react';

import { AdminSectionNav } from '@/components/admin/admin-section-nav';
import { BatchNumberFields, currentBatchNumber } from '@/components/admin/batch-number-fields';
import { categoryLabels, type RecordStatus, type VinylRecord } from '@/lib/catalog';

type ManagedRecord = VinylRecord & { status: RecordStatus };

function publicationData(record: ManagedRecord) {
  const data = new FormData();
  data.set('title', record.title);
  data.set('composers', record.composers);
  data.set('performers', record.performers);
  data.set('category', record.category);
  data.set('indexLetters', record.indexLetters.join(','));
  data.set('label', record.label);
  data.set('catalogNumber', record.catalogNumber);
  data.set('price', record.price);
  data.set('condition', record.condition);
  data.set('conditionNotes', record.conditionNotes);
  data.set('batchNumber', record.batchNumber ?? '');
  data.set('newArrival', String(record.newArrival));
  data.set('status', 'published');
  return data;
}

export default function BatchPublishPage() {
  const [records, setRecords] = useState<ManagedRecord[]>([]);
  const [batch, setBatch] = useState(currentBatchNumber);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('正在讀取批次資料…');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/admin/records', { credentials: 'same-origin' })
      .then(async (response) => {
        if (response.status === 401) { window.location.assign('/vinyl-login'); return null; }
        const result = (await response.json()) as { records?: VinylRecord[]; message?: string };
        if (!response.ok) throw new Error(result.message || '暫時無法讀取批次資料。');
        return (result.records ?? []).map((record) => ({ ...record, status: record.status ?? 'published' }));
      })
      .then((items) => {
        if (items) {
          const initialBatch = currentBatchNumber();
          setRecords(items);
          setBatch(initialBatch);
          setSelected(new Set(items.filter((record) => record.batchNumber === initialBatch && record.status === 'draft').map((record) => record.id)));
          setMessage('');
        }
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '暫時無法讀取批次資料。'));
  }, []);

  const drafts = useMemo(() => batch ? records.filter((record) => record.batchNumber === batch && record.status === 'draft') : [], [batch, records]);
  const alreadyPublished = useMemo(() => batch ? records.filter((record) => record.batchNumber === batch && record.status === 'published').length : 0, [batch, records]);

  function chooseBatch(value: string) {
    setBatch(value);
    setSelected(new Set(records.filter((record) => record.batchNumber === value && record.status === 'draft').map((record) => record.id)));
    setMessage('');
  }

  async function publishSelected() {
    const chosen = drafts.filter((record) => selected.has(record.id));
    if (!chosen.length) { setMessage('請至少勾選一張尚未上架的唱片。'); return; }
    setBusy(true);
    setMessage(`正在上架 ${chosen.length} 張唱片…`);
    const results = await Promise.all(chosen.map(async (record) => {
      const response = await fetch(`/api/admin/records/${encodeURIComponent(record.id)}`, { method: 'PATCH', credentials: 'same-origin', body: publicationData(record) });
      return { id: record.id, ok: response.ok };
    }));
    const succeeded = new Set(results.filter((result) => result.ok).map((result) => result.id));
    setRecords((current) => current.map((record) => succeeded.has(record.id) ? { ...record, status: 'published' } : record));
    setSelected((current) => new Set([...current].filter((id) => !succeeded.has(id))));
    const failed = results.length - succeeded.size;
    setMessage(failed ? `已上架 ${succeeded.size} 張；${failed} 張失敗，仍保持勾選，請再試一次。` : `已成功上架 ${succeeded.size} 張唱片。`);
    setBusy(false);
  }

  return (
    <main className="admin-page admin-docs-page batch-publish-page">
      <header className="admin-docs-header admin-shell"><div><p>唱片管理</p><h1>批次上架</h1><span>先選批次、逐張確認，再一次上架已勾選的唱片。</span></div><a className="back-to-shop" href="/"><ArrowLeft aria-hidden="true" /> 回到商店</a></header>
      <AdminSectionNav current="publish" />
      <section className="admin-docs-shell admin-shell">
        <div className="batch-publish-controls"><div><span className="batch-publish-control-label">選擇批次</span><BatchNumberFields onChange={chooseBatch} value={batch} /></div><p><strong>{drafts.length}</strong> 張尚未上架・{alreadyPublished} 張已在商店</p></div>
        <section aria-labelledby="batch-workflow-title" className="batch-shopify-workflow">
          <div className="batch-workflow-heading">
            <div><span>內部上架流程</span><h2 id="batch-workflow-title">從唱片資料到 Utopia Vinyl 商店</h2></div>
            <small>所有流程皆由本站管理</small>
          </div>
          <ol>
            <li><span>01</span><strong>新增／編輯唱片</strong><small>在 Utopia Vinyl 管理頁完成資料</small></li>
            <li><span>02</span><strong>儲存至 Utopia Vinyl 資料庫</strong><small>保存唱片內容、狀態與批次</small></li>
            <li><span>03</span><strong>上架至公開商店</strong><small>顧客可以瀏覽並加入購物車</small></li>
            <li><span>04</span><strong>內部追蹤單件庫存</strong><small>訂單成立即保留；取消或逾期才歸還</small></li>
          </ol>
        </section>
        {message ? <output className="batch-publish-message">{message}</output> : null}
        {!batch && !message ? <div className="admin-docs-message">請先選擇要檢查的批次。</div> : null}
        {batch && drafts.length === 0 ? <div className="admin-docs-message">這個批次沒有等待上架的唱片。</div> : null}
        {drafts.length ? <div className="batch-publish-list">{drafts.map((record) => {
          const checked = selected.has(record.id);
          return <label className={checked ? 'is-selected' : ''} key={record.id}><input checked={checked} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(record.id); else next.delete(record.id); return next; })} type="checkbox" /><span className="batch-check"><Check aria-hidden="true" /></span><span className="batch-publish-cover"><Image alt={`${record.title} 封面`} fill sizes="92px" src={record.image} unoptimized={record.image.startsWith('/api/')} /></span><span className="batch-publish-copy"><small>{record.batchNumber}・{categoryLabels[record.category]}</small><strong>{record.title}</strong><span>{[record.label, record.catalogNumber].filter(Boolean).join('・') || '尚未填寫唱片公司或編號'}</span></span></label>;
        })}</div> : null}
        {drafts.length ? <div className="batch-publish-footer"><span>已選擇 <strong>{selected.size}</strong> 張</span><button disabled={busy || selected.size === 0} onClick={() => void publishSelected()} type="button">{busy ? <LoaderCircle aria-hidden="true" /> : <Upload aria-hidden="true" />} 上架已選唱片</button></div> : null}
      </section>
    </main>
  );
}
