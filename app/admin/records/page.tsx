'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Disc3,
  Eye,
  EyeOff,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

import { PhotoScanEditor } from '@/components/admin/photo-scan-editor';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { prepareRecordPhoto } from '@/lib/client/record-image';
import {
  categoryLabels,
  type RecordCategory,
  type RecordStatus,
  type VinylRecord,
} from '@/lib/catalog';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const acceptedImages = ['image/jpeg', 'image/png', 'image/webp'];
const maximumOriginalImageBytes = 20 * 1024 * 1024;

type ManagedRecord = VinylRecord & { status: RecordStatus };
type StatusFilter = 'all' | RecordStatus;
type LoadState = 'loading' | 'ready' | 'error';

function withRequiredStatus(record: VinylRecord): ManagedRecord {
  return { ...record, status: record.status ?? 'published' };
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function recordFormData(record: ManagedRecord, replacementImage?: File | null) {
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
  data.set('newArrival', String(record.newArrival));
  data.set('status', record.status);
  if (replacementImage) data.set('image', replacementImage);
  return data;
}

export default function ManageRecordsPage() {
  const replacementUrlRef = useRef('');
  const [records, setRecords] = useState<ManagedRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<ManagedRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedRecord | null>(null);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [replacementImage, setReplacementImage] = useState<File | null>(null);
  const [replacementOriginal, setReplacementOriginal] = useState<File | null>(null);
  const [replacementPreview, setReplacementPreview] = useState('');
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [scanEditorOpen, setScanEditorOpen] = useState(false);

  useEffect(() => () => {
    if (replacementUrlRef.current) URL.revokeObjectURL(replacementUrlRef.current);
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/records', { credentials: 'same-origin' });
      const result = (await response.json()) as { records?: VinylRecord[]; message?: string };
      if (response.status === 401) {
        window.location.assign('/vinyl-login');
        return;
      }
      if (!response.ok || !Array.isArray(result.records)) {
        throw new Error(result.message || '暫時無法讀取唱片。');
      }
      setRecords(result.records.map(withRequiredStatus));
      setLoadState('ready');
    } catch (error) {
      setLoadState('error');
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : '暫時無法讀取唱片。',
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/records', { credentials: 'same-origin' })
      .then(async (response) => ({
        response,
        result: (await response.json()) as { records?: VinylRecord[]; message?: string },
      }))
      .then(({ response, result }) => {
        if (cancelled) return;
        if (response.status === 401) {
          window.location.assign('/vinyl-login');
          return;
        }
        if (!response.ok || !Array.isArray(result.records)) {
          throw new Error(result.message || '暫時無法讀取唱片。');
        }
        setRecords(result.records.map(withRequiredStatus));
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState('error');
        setNotice({
          type: 'error',
          message: error instanceof Error ? error.message : '暫時無法讀取唱片。',
        });
      });

    return () => { cancelled = true; };
  }, []);

  function clearReplacement() {
    if (replacementUrlRef.current) URL.revokeObjectURL(replacementUrlRef.current);
    replacementUrlRef.current = '';
    setReplacementImage(null);
    setReplacementOriginal(null);
    setReplacementPreview('');
    setScanEditorOpen(false);
  }

  function showReplacement(file: File) {
    if (replacementUrlRef.current) URL.revokeObjectURL(replacementUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    replacementUrlRef.current = nextUrl;
    setReplacementImage(file);
    setReplacementPreview(nextUrl);
  }

  function openEditor(record: ManagedRecord) {
    clearReplacement();
    setNotice(null);
    setEditing({ ...record, indexLetters: [...record.indexLetters] });
  }

  function closeEditor() {
    clearReplacement();
    setEditing(null);
  }

  function updateEditing<K extends keyof ManagedRecord>(key: K, value: ManagedRecord[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  async function chooseReplacement(file?: File) {
    if (!file) return;
    setNotice(null);
    if (!acceptedImages.includes(file.type)) {
      setNotice({ type: 'error', message: '請選擇 JPG、PNG 或 WebP 照片。' });
      return;
    }
    if (file.size > maximumOriginalImageBytes) {
      setNotice({ type: 'error', message: '照片太大，請選擇小於 20 MB 的照片。' });
      return;
    }

    setIsPreparingImage(true);
    try {
      const prepared = await prepareRecordPhoto(file);
      setReplacementOriginal(prepared.original);
      showReplacement(prepared.scan);
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : '無法處理這張照片。',
      });
    } finally {
      setIsPreparingImage(false);
    }
  }

  async function sendUpdate(record: ManagedRecord, replacement?: File | null) {
    const response = await fetch(`/api/admin/records/${encodeURIComponent(record.id)}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      body: recordFormData(record, replacement),
    });
    const result = (await response.json()) as { message?: string };
    if (response.status === 401) {
      window.location.assign('/vinyl-login');
      return null;
    }
    if (!response.ok) throw new Error(result.message || '暫時無法更新唱片。');
    return result.message ?? '唱片資料已更新。';
  }

  async function toggleVisibility(record: ManagedRecord) {
    const nextStatus: RecordStatus = record.status === 'published' ? 'draft' : 'published';
    setBusyId(record.id);
    setNotice(null);
    try {
      const message = await sendUpdate({ ...record, status: nextStatus });
      if (!message) return;
      setRecords((current) => current.map((item) =>
        item.id === record.id ? { ...item, status: nextStatus } : item,
      ));
      setNotice({ type: 'success', message });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '暫時無法更新唱片。' });
    } finally {
      setBusyId('');
    }
  }

  async function saveEdit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (!editing) return;
    setBusyId(editing.id);
    setNotice(null);
    try {
      const message = await sendUpdate(editing, replacementImage);
      if (!message) return;
      closeEditor();
      await loadRecords();
      setNotice({ type: 'success', message });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '暫時無法更新唱片。' });
    } finally {
      setBusyId('');
    }
  }

  async function deleteRecord(record: ManagedRecord) {
    setBusyId(record.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/records/${encodeURIComponent(record.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const result = (await response.json()) as { message?: string };
      if (response.status === 401) {
        window.location.assign('/vinyl-login');
        return;
      }
      if (!response.ok) throw new Error(result.message || '暫時無法刪除唱片。');
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setDeleteTarget(null);
      setNotice({ type: 'success', message: result.message ?? '唱片已永久刪除。' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '暫時無法刪除唱片。' });
    } finally {
      setBusyId('');
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.assign('/vinyl-login');
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRecords = records.filter((record) => {
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const searchable = [
      record.title,
      record.composers,
      record.performers,
      record.label,
      record.catalogNumber,
    ].join(' ').toLocaleLowerCase();
    return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
  });

  const publishedCount = records.filter((record) => record.status === 'published').length;
  const hiddenCount = records.length - publishedCount;

  return (
    <main className="admin-page manage-page">
      <div className="admin-topline">
        <p><LockKeyhole aria-hidden="true" /> UTOPIA VINYL 私人管理</p>
        <button onClick={() => { void logout(); }} type="button"><LogOut aria-hidden="true" /> 登出</button>
      </div>

      <header className="admin-header admin-shell">
        <Link aria-label="回到 Utopia Vinyl 商店" className="admin-brand" href="/">
          <Image alt="Utopia Vinyl 黑膠理想國" height={1024} priority src="/utopia-vinyl.png" width={1536} />
        </Link>
        <div className="admin-heading">
          <p>唱片管理</p>
          <h1>管理唱片</h1>
          <span>修改資料、暫時隱藏，或永久刪除唱片。</span>
        </div>
        <Link className="back-to-shop" href="/"><ArrowLeft aria-hidden="true" /> 回到商店</Link>
      </header>

      <nav aria-label="唱片管理功能" className="admin-section-nav">
        <div className="admin-shell">
          <Link href="/admin">新增唱片</Link>
          <Link aria-current="page" href="/admin/records">管理唱片</Link>
        </div>
      </nav>

      <section className="manage-shell admin-shell">
        <div className="manage-summary">
          <div><strong>{records.length}</strong><span>全部唱片</span></div>
          <div><strong>{publishedCount}</strong><span>商店顯示中</span></div>
          <div><strong>{hiddenCount}</strong><span>已隱藏</span></div>
          <Link href="/admin"><Plus aria-hidden="true" /> 新增一張唱片</Link>
        </div>

        <div className="manage-toolbar">
          <label className="manage-search">
            <Search aria-hidden="true" />
            <span className="sr-only">搜尋唱片</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋名稱、作曲家、演奏家或編號"
              type="search"
              value={query}
            />
          </label>
          <div aria-label="依上架狀態篩選" className="manage-filters">
            {([
              ['all', '全部'],
              ['published', '商店顯示中'],
              ['draft', '已隱藏'],
            ] as [StatusFilter, string][]).map(([value, label]) => (
              <button
                aria-pressed={statusFilter === value}
                key={value}
                onClick={() => setStatusFilter(value)}
                type="button"
              >{label}</button>
            ))}
          </div>
        </div>

        {notice ? (
          <output className={`manage-notice ${notice.type}`}>
            {notice.type === 'success' ? <Check aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
            <span>{notice.message}</span>
          </output>
        ) : null}

        {loadState === 'loading' ? (
          <div aria-label="正在讀取唱片" className="manage-loading">
            {[0, 1, 2].map((item) => <Skeleton className="manage-record-skeleton" key={item} />)}
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="manage-empty">
            <AlertTriangle aria-hidden="true" />
            <h2>暫時無法讀取唱片</h2>
            <button onClick={() => { setLoadState('loading'); void loadRecords(); }} type="button">再試一次</button>
          </div>
        ) : null}

        {loadState === 'ready' && filteredRecords.length === 0 ? (
          <div className="manage-empty">
            <Disc3 aria-hidden="true" />
            <h2>{records.length === 0 ? '目前還沒有唱片' : '找不到符合的唱片'}</h2>
            <p>{records.length === 0 ? '新增第一張唱片後，就會出現在這裡。' : '請試試其他搜尋字詞或篩選方式。'}</p>
            {records.length === 0 ? <Link href="/admin">新增唱片</Link> : null}
          </div>
        ) : null}

        {loadState === 'ready' && filteredRecords.length > 0 ? (
          <div className="manage-record-list">
            {filteredRecords.map((record) => {
              const isBusy = busyId === record.id;
              return (
                <article className="manage-record" key={record.id}>
                  <div className="manage-cover">
                    <Image alt={`${record.title} 唱片封面`} fill sizes="112px" src={record.image} unoptimized={record.image.startsWith('/api/')} />
                  </div>
                  <div className="manage-record-copy">
                    <div className="manage-record-heading">
                      <span className={`manage-status ${record.status}`}>
                        {record.status === 'published' ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                        {record.status === 'published' ? '商店顯示中' : '已隱藏'}
                      </span>
                      <span>{categoryLabels[record.category]}</span>
                      {record.newArrival ? <span>新到唱片</span> : null}
                    </div>
                    <h2>{record.title}</h2>
                    <p>{record.composers || record.performers || '尚未填寫作曲家或演奏家'}</p>
                    <small>{record.label || '未填唱片公司'}{record.catalogNumber ? `・${record.catalogNumber}` : ''}{record.createdAt ? `・${formatDate(record.createdAt)}` : ''}</small>
                  </div>
                  <div className="manage-record-actions">
                    <button disabled={isBusy} onClick={() => openEditor(record)} type="button"><Pencil aria-hidden="true" /> 編輯</button>
                    <button disabled={isBusy} onClick={() => { void toggleVisibility(record); }} type="button">
                      {isBusy ? <LoaderCircle aria-hidden="true" /> : record.status === 'published' ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      {record.status === 'published' ? '隱藏' : '重新上架'}
                    </button>
                    <button className="record-delete" disabled={isBusy} onClick={() => setDeleteTarget(record)} type="button"><Trash2 aria-hidden="true" /> 刪除</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <Dialog onOpenChange={(open) => { if (!open && !busyId) closeEditor(); }} open={Boolean(editing)}>
        <DialogContent className="record-editor-dialog" showCloseButton={false}>
          {editing ? (
            <form onSubmit={(event) => { void saveEdit(event); }}>
              <DialogHeader className="record-editor-heading">
                <DialogTitle>編輯唱片</DialogTitle>
                <DialogDescription>修改後按「儲存變更」，商店內容就會更新。</DialogDescription>
              </DialogHeader>

              <div className="record-editor-body">
                <section className="record-editor-photo">
                  <div className="record-editor-preview">
                    <Image
                      alt={`${editing.title} 唱片封面預覽`}
                      fill
                      sizes="320px"
                      src={replacementPreview || editing.image}
                      unoptimized={Boolean(replacementPreview) || editing.image.startsWith('/api/')}
                    />
                    {isPreparingImage ? <span><LoaderCircle aria-hidden="true" /> 正在整理照片…</span> : null}
                  </div>
                  <label className="replace-cover-button">
                    <ImagePlus aria-hidden="true" /> 更換封面
                    <input accept="image/jpeg,image/png,image/webp" onChange={(event) => { void chooseReplacement(event.target.files?.[0]); }} type="file" />
                  </label>
                  {replacementOriginal ? (
                    <button className="adjust-replacement" onClick={() => setScanEditorOpen(true)} type="button">
                      <SlidersHorizontal aria-hidden="true" /> 調整裁切與色彩
                    </button>
                  ) : null}
                  <p>{replacementImage ? '新的整理版封面會在儲存後取代原圖。' : '不選新照片，就會保留目前封面。'}</p>
                </section>

                <section className="record-editor-fields">
                  <label className="editor-field editor-full">
                    <span>唱片名稱</span>
                    <input maxLength={180} onChange={(event) => updateEditing('title', event.target.value)} required value={editing.title} />
                  </label>
                  <label className="editor-field">
                    <span>分類</span>
                    <select
                      onChange={(event) => {
                        updateEditing('category', event.target.value as RecordCategory);
                        if (event.target.value !== 'classical' && event.target.value !== 'jazz') updateEditing('indexLetters', []);
                      }}
                      value={editing.category}
                    >
                      {(Object.entries(categoryLabels) as [RecordCategory, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="editor-field">
                    <span>上架狀態</span>
                    <select onChange={(event) => updateEditing('status', event.target.value as RecordStatus)} value={editing.status}>
                      <option value="published">商店顯示中</option>
                      <option value="draft">隱藏</option>
                    </select>
                  </label>
                  <label className="editor-field">
                    <span>作曲家</span>
                    <input maxLength={300} onChange={(event) => updateEditing('composers', event.target.value)} value={editing.composers} />
                  </label>
                  <label className="editor-field">
                    <span>演奏家或樂團</span>
                    <input maxLength={300} onChange={(event) => updateEditing('performers', event.target.value)} value={editing.performers} />
                  </label>
                  <label className="editor-field">
                    <span>唱片公司</span>
                    <input maxLength={120} onChange={(event) => updateEditing('label', event.target.value)} value={editing.label} />
                  </label>
                  <label className="editor-field">
                    <span>唱片編號</span>
                    <input maxLength={80} onChange={(event) => updateEditing('catalogNumber', event.target.value)} value={editing.catalogNumber} />
                  </label>
                  <label className="editor-field">
                    <span>售價</span>
                    <input maxLength={50} onChange={(event) => updateEditing('price', event.target.value)} value={editing.price} />
                  </label>
                  <label className="editor-field">
                    <span>品相</span>
                    <select onChange={(event) => updateEditing('condition', event.target.value)} value={editing.condition}>
                      <option>品相待確認</option>
                      <option>全新未拆</option>
                      <option>近全新</option>
                      <option>保存良好</option>
                      <option>有使用痕跡</option>
                    </select>
                  </label>

                  {editing.category === 'classical' || editing.category === 'jazz' ? (
                    <fieldset className="editor-index editor-full">
                      <legend>{editing.category === 'classical' ? '作曲家' : '演奏家／樂團'} A–Z 索引</legend>
                      <div>
                        {alphabet.map((letter) => (
                          <button
                            aria-pressed={editing.indexLetters.includes(letter)}
                            key={letter}
                            onClick={() => updateEditing(
                              'indexLetters',
                              editing.indexLetters.includes(letter)
                                ? editing.indexLetters.filter((item) => item !== letter)
                                : [...editing.indexLetters, letter].sort(),
                            )}
                            type="button"
                          >{letter}</button>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}

                  <label className="editor-new-arrival editor-full">
                    <input checked={editing.newArrival} onChange={(event) => updateEditing('newArrival', event.target.checked)} type="checkbox" />
                    同時放進「新到唱片」
                  </label>
                </section>
              </div>

              <DialogFooter className="record-editor-footer">
                <button disabled={busyId === editing.id} onClick={closeEditor} type="button">取消</button>
                <button className="save-record-edit" disabled={busyId === editing.id || isPreparingImage} type="submit">
                  {busyId === editing.id ? <LoaderCircle aria-hidden="true" /> : <Check aria-hidden="true" />}
                  儲存變更
                </button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {scanEditorOpen && replacementOriginal ? (
        <PhotoScanEditor
          file={replacementOriginal}
          onApply={(scan) => showReplacement(scan)}
          onOpenChange={setScanEditorOpen}
          open
        />
      ) : null}

      <AlertDialog onOpenChange={(open) => { if (!open && !busyId) setDeleteTarget(null); }} open={Boolean(deleteTarget)}>
        <AlertDialogContent className="record-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogMedia><Trash2 aria-hidden="true" /></AlertDialogMedia>
            <AlertDialogTitle>永久刪除這張唱片？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」會從管理頁和商店永久移除，而且無法復原。若只是暫時不想顯示，請改用「隱藏」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busyId)}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="confirm-record-delete"
              disabled={Boolean(busyId)}
              onClick={() => { if (deleteTarget) void deleteRecord(deleteTarget); }}
            >
              {busyId ? <LoaderCircle aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              永久刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
