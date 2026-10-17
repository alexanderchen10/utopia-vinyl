'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleDashed, RefreshCw, ShoppingBag, TriangleAlert } from 'lucide-react';

import { AdminSectionNav } from '@/components/admin/admin-section-nav';
import type { VinylRecord } from '@/lib/catalog';

function syncState(record: VinylRecord) {
  if (record.available === false) return 'sold';
  if (record.shopifySyncStatus === 'synced') return 'synced';
  if (record.shopifySyncStatus === 'failed') return 'failed';
  return 'pending';
}

const labels = {
  synced: '已同步 Shopify', pending: '等待同步', failed: '同步失敗', sold: '已售出',
} as const;

export default function ShopifySyncPage() {
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [message, setMessage] = useState('正在讀取同步狀態…');

  useEffect(() => {
    void fetch('/api/admin/records', { credentials: 'same-origin' })
      .then(async (response) => {
        if (response.status === 401) { window.location.assign('/vinyl-login'); return null; }
        const result = (await response.json()) as { records?: VinylRecord[]; message?: string };
        if (!response.ok) throw new Error(result.message || '暫時無法讀取同步狀態。');
        return result.records ?? [];
      })
      .then((items) => { if (items) { setRecords(items); setMessage(''); } })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '暫時無法讀取同步狀態。'));
  }, []);

  const counts = useMemo(() => records.reduce((result, record) => {
    result[syncState(record)] += 1;
    return result;
  }, { synced: 0, pending: 0, failed: 0, sold: 0 }), [records]);

  return <main className="admin-page admin-docs-page shopify-sync-page">
    <header className="admin-docs-header admin-shell"><div><p>唱片管理</p><h1>Shopify 同步</h1><span>查看唱片、庫存與台灣商店設定的連線狀態。</span></div><a className="back-to-shop" href="/"><ArrowLeft aria-hidden="true" /> 回到商店</a></header>
    <AdminSectionNav current="shopify" />
    <section className="admin-docs-shell admin-shell">
      <div className="shopify-connection-banner"><TriangleAlert aria-hidden="true" /><div><strong>Shopify 尚未連線</strong><p>目前沒有設定商店憑證。所有唱片會保持「等待同步」，不會啟用付款。</p></div></div>
      <div className="sync-summary">
        <article><CheckCircle2 aria-hidden="true" /><strong>{counts.synced}</strong><span>{labels.synced}</span></article>
        <article><CircleDashed aria-hidden="true" /><strong>{counts.pending}</strong><span>{labels.pending}</span></article>
        <article><TriangleAlert aria-hidden="true" /><strong>{counts.failed}</strong><span>{labels.failed}</span></article>
        <article><ShoppingBag aria-hidden="true" /><strong>{counts.sold}</strong><span>{labels.sold}</span></article>
      </div>
      <section className="taiwan-shopify-settings" aria-labelledby="taiwan-settings-title"><div><span>台灣商店設定</span><h2 id="taiwan-settings-title">Shopify 上線前檢查</h2></div><ul>
        <li className="is-ready"><CheckCircle2 aria-hidden="true" /><span><strong>商店顯示幣別：TWD</strong><small>網站售價已使用 NT$／NTD</small></span></li>
        <li className="is-ready"><CheckCircle2 aria-hidden="true" /><span><strong>繁體中文商店介面</strong><small>網站已提供繁體中文</small></span></li>
        <li><CircleDashed aria-hidden="true" /><span><strong>台灣市場與運送費率</strong><small>等待在 Shopify 後台設定</small></span></li>
        <li><CircleDashed aria-hidden="true" /><span><strong>台灣相容付款服務商</strong><small>等待選擇與測試；尚未啟用真實付款</small></span></li>
        <li><CircleDashed aria-hidden="true" /><span><strong>退換貨、隱私與聯絡資訊</strong><small>等待商店政策內容確認</small></span></li>
      </ul></section>
      <section className="shopify-launch-roadmap" aria-labelledby="launch-roadmap-title"><div><span>完整上線順序</span><h2 id="launch-roadmap-title">從測試商店到正式營運</h2></div><ol>
        <li className="is-next"><span>01</span><strong>建立 Shopify 商店</strong></li>
        <li><span>02</span><strong>設定測試模式與台灣商店設定</strong></li>
        <li><span>03</span><strong>安全加入 API 憑證</strong></li>
        <li><span>04</span><strong>建立商品同步</strong></li>
        <li><span>05</span><strong>連接購物車與結帳轉址</strong></li>
        <li><span>06</span><strong>註冊 Shopify Webhooks</strong></li>
        <li><span>07</span><strong>執行端對端測試訂單</strong></li>
        <li><span>08</span><strong>購買並連接一個 .tw 網域</strong></li>
        <li><span>09</span><strong>核准並啟用真實付款</strong></li>
      </ol></section>
      {message ? <p className="admin-docs-message">{message}</p> : <div className="sync-record-list">{records.map((record) => { const state = syncState(record); return <article key={record.id}><div><small>{record.batchNumber || '未設定批次'}</small><strong>{record.title}</strong><span>{record.catalogNumber || '未填唱片編號'}</span></div><mark className={`sync-${state}`}>{labels[state]}</mark>{state === 'failed' ? <button disabled type="button"><RefreshCw aria-hidden="true" /> 重試</button> : null}</article>; })}</div>}
    </section>
  </main>;
}
