'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Sparkles,
} from 'lucide-react';

import {
  createPerspectiveScan,
  isUsableCoverCorners,
  prepareRecordPhoto,
  type CoverCorners,
} from '@/lib/client/record-image';
import { categoryLabels, type RecordCategory, type RecordStatus } from '@/lib/catalog';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const acceptedImages = ['image/jpeg', 'image/png', 'image/webp'];
const maximumOriginalImageBytes = 20 * 1024 * 1024;

type RecordFields = {
  title: string;
  composers: string;
  performers: string;
  label: string;
  catalogNumber: string;
};

type ConfidenceKey = keyof RecordFields | 'category' | 'indexLetters';
type ConfidenceScores = Record<ConfidenceKey, number>;

type AnalysisRecord = RecordFields & {
  category: RecordCategory | null;
  indexLetters: string[];
  fieldConfidence: ConfidenceScores;
  coverCorners: CoverCorners;
  coverCornersConfidence: number;
  notes: string[];
};

type AnalysisState =
  | { type: 'idle'; message: ''; remainingToday?: number }
  | { type: 'analyzing'; message: string; remainingToday?: number }
  | { type: 'success'; message: string; remainingToday?: number }
  | { type: 'error'; message: string; remainingToday?: number };

const emptyFields: RecordFields = {
  title: '',
  composers: '',
  performers: '',
  label: '',
  catalogNumber: '',
};

type SubmitState =
  | { type: 'idle'; message: '' }
  | { type: 'saving'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export default function AddRecordPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef('');
  const imageRequestRef = useRef(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [scanImageFile, setScanImageFile] = useState<File | null>(null);
  const [imageMode, setImageMode] = useState<'scan' | 'original'>('scan');
  const [imagePreview, setImagePreview] = useState('');
  const [originalImageName, setOriginalImageName] = useState('');
  const [fields, setFields] = useState<RecordFields>(emptyFields);
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
  const [category, setCategory] = useState<RecordCategory>('classical');
  const [confidence, setConfidence] = useState<ConfidenceScores | null>(null);
  const [analysisNotes, setAnalysisNotes] = useState<string[]>([]);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ type: 'idle', message: '' });
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle', message: '' });
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function showImage(file: File, mode: 'scan' | 'original') {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setImagePreview(previewUrl);
    setImageFile(file);
    setImageMode(mode);
  }

  function updateField(field: keyof RecordFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  async function analyzeImage(originalFile: File, fallbackScan: File, requestId: number) {
    setAnalysisState({ type: 'analyzing', message: '正在讀取封面上的資料…' });
    setConfidence(null);
    setAnalysisNotes([]);

    const data = new FormData();
    data.set('image', originalFile);

    try {
      const response = await fetch('/api/admin/analyze-record', {
        method: 'POST',
        credentials: 'same-origin',
        body: data,
      });
      const result = (await response.json()) as {
        message?: string;
        record?: AnalysisRecord;
        remainingToday?: number;
      };
      if (response.status === 401) {
        window.location.assign('/vinyl-login');
        return;
      }
      if (!response.ok || !result.record) {
        throw new Error(result.message || '自動辨識沒有讀取成功。');
      }
      if (imageRequestRef.current !== requestId) return;

      const record = result.record;
      setFields({
        title: record.title,
        composers: record.composers,
        performers: record.performers,
        label: record.label,
        catalogNumber: record.catalogNumber,
      });
      if (record.category) setCategory(record.category);
      setSelectedLetters(
        record.category === 'classical' || record.category === 'jazz'
          ? record.indexLetters
          : [],
      );
      setConfidence(record.fieldConfidence);
      setAnalysisNotes(record.notes);

      if (
        record.coverCornersConfidence >= 0.62 &&
        isUsableCoverCorners(record.coverCorners)
      ) {
        try {
          const correctedScan = await createPerspectiveScan(originalFile, record.coverCorners);
          if (imageRequestRef.current !== requestId) return;
          setScanImageFile(correctedScan);
          showImage(correctedScan, 'scan');
        } catch {
          setScanImageFile(fallbackScan);
        }
      }

      setAnalysisState({
        type: 'success',
        message: result.message ?? '已自動填入資料，請檢查後再上架。',
        remainingToday: result.remainingToday,
      });
    } catch (error) {
      if (imageRequestRef.current !== requestId) return;
      setAnalysisState({
        type: 'error',
        message: error instanceof Error ? error.message : '自動辨識沒有讀取成功，請手動填寫。',
      });
    }
  }

  async function chooseImage(file?: File) {
    if (!file) return;
    if (!acceptedImages.includes(file.type)) {
      setSubmitState({ type: 'error', message: '請選擇 JPG、PNG 或 WebP 照片。' });
      return;
    }
    if (file.size > maximumOriginalImageBytes) {
      setSubmitState({ type: 'error', message: '照片太大，請選擇小於 20 MB 的照片。' });
      return;
    }

    const requestId = imageRequestRef.current + 1;
    imageRequestRef.current = requestId;
    setIsOptimizing(true);
    setAnalysisState({ type: 'idle', message: '' });
    setAnalysisNotes([]);
    setConfidence(null);
    setSubmitState({ type: 'idle', message: '' });

    try {
      const prepared = await prepareRecordPhoto(file);
      if (imageRequestRef.current !== requestId) return;

      setOriginalImageFile(prepared.original);
      setScanImageFile(prepared.scan);
      showImage(prepared.scan, 'scan');
      setOriginalImageName(file.name);
      setIsOptimizing(false);
      await analyzeImage(prepared.original, prepared.scan, requestId);
    } catch (error) {
      if (imageRequestRef.current !== requestId) return;
      setSubmitState({
        type: 'error',
        message: error instanceof Error ? error.message : '無法處理這張照片，請換一張再試。',
      });
    } finally {
      if (imageRequestRef.current === requestId) setIsOptimizing(false);
    }
  }

  function toggleLetter(letter: string) {
    setSelectedLetters((current) =>
      current.includes(letter)
        ? current.filter((item) => item !== letter)
        : [...current, letter].sort(),
    );
  }

  function resetForm() {
    imageRequestRef.current += 1;
    formRef.current?.reset();
    setFields(emptyFields);
    setCategory('classical');
    setSelectedLetters([]);
    setImageFile(null);
    setOriginalImageFile(null);
    setScanImageFile(null);
    setImageMode('scan');
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setImagePreview('');
    setOriginalImageName('');
    setConfidence(null);
    setAnalysisNotes([]);
    setAnalysisState({ type: 'idle', message: '' });
    setIsOptimizing(false);
    setFileInputKey((key) => key + 1);
    setSubmitState({ type: 'idle', message: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveRecord(form: HTMLFormElement, status: RecordStatus) {
    if (!imageFile) {
      setSubmitState({ type: 'error', message: '請先加入唱片封面照片。' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    data.set('image', imageFile);
    data.set('status', status);
    data.set('category', category);
    data.set('indexLetters', selectedLetters.join(','));
    data.set('newArrival', String(data.get('newArrival') === 'on'));

    setSubmitState({
      type: 'saving',
      message: status === 'published' ? '正在上架唱片…' : '正在儲存草稿…',
    });

    try {
      const response = await fetch('/api/admin/records', {
        method: 'POST',
        credentials: 'same-origin',
        body: data,
      });
      const result = (await response.json()) as { message?: string };
      if (response.status === 401) {
        window.location.assign('/vinyl-login');
        return;
      }
      if (!response.ok) throw new Error(result.message || '暫時無法儲存唱片。');

      setSubmitState({ type: 'success', message: result.message ?? '唱片已儲存。' });
      if (status === 'published') resetFormAfterSuccess(result.message ?? '唱片已成功上架！');
    } catch (error) {
      setSubmitState({
        type: 'error',
        message: error instanceof Error ? error.message : '暫時無法儲存唱片。',
      });
    }
  }

  function resetFormAfterSuccess(message: string) {
    imageRequestRef.current += 1;
    formRef.current?.reset();
    setFields(emptyFields);
    setCategory('classical');
    setSelectedLetters([]);
    setImageFile(null);
    setOriginalImageFile(null);
    setScanImageFile(null);
    setImageMode('scan');
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setImagePreview('');
    setOriginalImageName('');
    setConfidence(null);
    setAnalysisNotes([]);
    setAnalysisState({ type: 'idle', message: '' });
    setIsOptimizing(false);
    setFileInputKey((key) => key + 1);
    setSubmitState({ type: 'success', message });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isSaving = submitState.type === 'saving';
  const isAnalyzing = analysisState.type === 'analyzing';
  const isBusy = isSaving || isOptimizing || isAnalyzing;
  const needsIndex = category === 'classical' || category === 'jazz';
  const needsReview = (field: ConfidenceKey) =>
    analysisState.type === 'success' && confidence !== null && confidence[field] < 0.68;

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.assign('/vinyl-login');
  }

  return (
    <main className="admin-page">
      <div className="admin-topline">
        <p><LockKeyhole aria-hidden="true" /> UTOPIA VINYL 私人管理</p>
        <button onClick={() => { void logout(); }} type="button"><LogOut aria-hidden="true" /> 登出</button>
      </div>

      <header className="admin-header admin-shell">
        <Link className="admin-brand" href="/" aria-label="回到 Utopia Vinyl 商店">
          <Image alt="Utopia Vinyl 黑膠理想國" height={1024} priority src="/utopia-vinyl.png" width={1536} />
        </Link>
        <div className="admin-heading">
          <p>唱片管理</p>
          <h1>新增唱片</h1>
          <span>填完資料後，就可以直接放進商店。</span>
        </div>
        <Link className="back-to-shop" href="/"><ArrowLeft aria-hidden="true" /> 回到商店</Link>
      </header>

      <div className="admin-steps" aria-label="新增唱片步驟">
        <div className="admin-shell">
          <p><span>1</span> 加入封面照片</p>
          <p><span>2</span> 填寫唱片資料</p>
          <p><span>3</span> 儲存或上架</p>
        </div>
      </div>

      <form
        className="record-form admin-shell"
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          void saveRecord(event.currentTarget, 'published');
        }}
      >
        <section className="photo-column" aria-labelledby="photo-title">
          <div className="section-number">01</div>
          <div className="section-heading">
            <div>
              <p>唱片封面</p>
              <h2 id="photo-title">先加入照片</h2>
            </div>
            <Camera aria-hidden="true" />
          </div>

          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            key={fileInputKey}
            name="imagePicker"
            onChange={(event) => { void chooseImage(event.target.files?.[0]); }}
            ref={fileInputRef}
            type="file"
          />
          <button
            className={`photo-drop ${imagePreview ? 'has-photo' : ''} ${imageMode === 'original' ? 'show-original' : ''} ${isDragging ? 'is-dragging' : ''}`}
            disabled={isOptimizing}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void chooseImage(event.dataTransfer.files[0]);
            }}
            type="button"
          >
            {isOptimizing ? (
              <div className="photo-prompt photo-processing">
                <div><LoaderCircle aria-hidden="true" /></div>
                <strong>正在整理照片…</strong>
                <span>正在裁切封面並調整光線。</span>
              </div>
            ) : imagePreview ? (
              <>
                <Image alt="唱片封面預覽" fill sizes="(max-width: 780px) calc(100vw - 32px), 480px" src={imagePreview} unoptimized />
                <span className="replace-photo"><ImagePlus aria-hidden="true" /> 更換照片</span>
              </>
            ) : (
              <div className="photo-prompt">
                <div><ImagePlus aria-hidden="true" /></div>
                <strong>點這裡選擇照片</strong>
                <span>也可以把照片拖到這個方框</span>
                <small>JPG、PNG 或 WebP・原圖最大 20 MB</small>
              </div>
            )}
          </button>

          {imageFile ? (
            <>
              <div className="photo-ready"><Check aria-hidden="true" /> 照片已整理完成：{originalImageName}</div>
              <div className="scan-choice" aria-label="選擇封面版本">
                <button
                  aria-pressed={imageMode === 'scan'}
                  disabled={!scanImageFile}
                  onClick={() => { if (scanImageFile) showImage(scanImageFile, 'scan'); }}
                  type="button"
                ><ScanLine aria-hidden="true" /> 掃描版</button>
                <button
                  aria-pressed={imageMode === 'original'}
                  disabled={!originalImageFile}
                  onClick={() => { if (originalImageFile) showImage(originalImageFile, 'original'); }}
                  type="button"
                >原始照片</button>
              </div>
              <p className="photo-tip">若自動裁切不正確，請選擇「原始照片」。上架時只會使用目前顯示的版本。</p>
            </>
          ) : (
            <p className="photo-tip">小提醒：讓整張封面都在照片內，四個角落越清楚，自動掃描就越準確。</p>
          )}

          {analysisState.type !== 'idle' ? (
            <section className={`analysis-card ${analysisState.type}`} aria-live="polite">
              <div className="analysis-icon">
                {analysisState.type === 'analyzing' ? <LoaderCircle aria-hidden="true" /> : null}
                {analysisState.type === 'success' ? <Sparkles aria-hidden="true" /> : null}
                {analysisState.type === 'error' ? <AlertTriangle aria-hidden="true" /> : null}
              </div>
              <div>
                <strong>
                  {analysisState.type === 'analyzing' ? '自動讀取資料' : null}
                  {analysisState.type === 'success' ? '資料已自動填入' : null}
                  {analysisState.type === 'error' ? '請手動檢查資料' : null}
                </strong>
                <p>{analysisState.message}</p>
                {analysisState.type === 'success' && typeof analysisState.remainingToday === 'number' ? (
                  <small>今天還可免費辨識 {analysisState.remainingToday} 張</small>
                ) : null}
              </div>
              {analysisState.type === 'error' && originalImageFile && scanImageFile ? (
                <button
                  onClick={() => { void analyzeImage(originalImageFile, scanImageFile, imageRequestRef.current); }}
                  type="button"
                ><RefreshCw aria-hidden="true" /> 再試一次</button>
              ) : null}
            </section>
          ) : null}
        </section>

        <section className="details-column" aria-labelledby="details-title">
          <div className="section-number">02</div>
          <div className="section-heading">
            <div>
              <p>基本資料</p>
              <h2 id="details-title">這張唱片是什麼？</h2>
            </div>
          </div>

          {analysisState.type === 'success' ? (
            <div className="review-reminder">
              <Sparkles aria-hidden="true" />
              <div>
                <strong>請檢查自動填入的內容</strong>
                <p>黃色欄位代表辨識結果較不確定；售價和品相需要手動選擇。確認後才按「立即上架」。</p>
                {analysisNotes.length > 0 ? (
                  <ul>{analysisNotes.map((note) => <li key={note}>{note}</li>)}</ul>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={`form-field full-field ${needsReview('title') ? 'needs-review' : ''}`}>
            <label htmlFor="title">唱片名稱 <em>必填</em>{needsReview('title') ? <span>請檢查</span> : null}</label>
            <input
              id="title"
              maxLength={180}
              name="title"
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="例如：Chopin Piano Concertos"
              required
              value={fields.title}
            />
          </div>

          <fieldset className={`category-field ${needsReview('category') ? 'needs-review' : ''}`}>
            <legend>分類 <em>必填</em>{needsReview('category') ? <span>請檢查</span> : null}</legend>
            <div className="category-choices">
              {(Object.entries(categoryLabels) as [RecordCategory, string][]).map(([value, label]) => (
                <label className={category === value ? 'is-selected' : ''} key={value}>
                  <input
                    checked={category === value}
                    name="categoryChoice"
                    onChange={() => { setCategory(value); setSelectedLetters([]); }}
                    type="radio"
                    value={value}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="form-grid">
            <div className={`form-field ${needsReview('composers') ? 'needs-review' : ''}`}>
              <label htmlFor="composers">作曲家{needsReview('composers') ? <span>請檢查</span> : null}</label>
              <input id="composers" maxLength={300} name="composers" onChange={(event) => updateField('composers', event.target.value)} placeholder="例如：蕭邦、李斯特" value={fields.composers} />
            </div>
            <div className={`form-field ${needsReview('performers') ? 'needs-review' : ''}`}>
              <label htmlFor="performers">演奏家或樂團{needsReview('performers') ? <span>請檢查</span> : null}</label>
              <input id="performers" maxLength={300} name="performers" onChange={(event) => updateField('performers', event.target.value)} placeholder="例如：Martha Argerich" value={fields.performers} />
            </div>
            <div className={`form-field ${needsReview('label') ? 'needs-review' : ''}`}>
              <label htmlFor="label">唱片公司{needsReview('label') ? <span>請檢查</span> : null}</label>
              <input id="label" maxLength={120} name="label" onChange={(event) => updateField('label', event.target.value)} placeholder="例如：Deutsche Grammophon" value={fields.label} />
            </div>
            <div className={`form-field ${needsReview('catalogNumber') ? 'needs-review' : ''}`}>
              <label htmlFor="catalogNumber">唱片編號{needsReview('catalogNumber') ? <span>請檢查</span> : null}</label>
              <input id="catalogNumber" maxLength={80} name="catalogNumber" onChange={(event) => updateField('catalogNumber', event.target.value)} placeholder="例如：139 383" value={fields.catalogNumber} />
            </div>
            <div className="form-field">
              <label htmlFor="price">售價</label>
              <input id="price" maxLength={50} name="price" placeholder="例如：NT$ 1,200" />
            </div>
            <div className="form-field">
              <label htmlFor="condition">品相</label>
              <select defaultValue="品相待確認" id="condition" name="condition">
                <option>品相待確認</option>
                <option>全新未拆</option>
                <option>近全新</option>
                <option>保存良好</option>
                <option>有使用痕跡</option>
              </select>
            </div>
          </div>

          {needsIndex ? (
            <fieldset className={`index-field ${needsReview('indexLetters') ? 'needs-review' : ''}`}>
              <legend>{category === 'classical' ? '作曲家' : '演奏家／樂團'} A–Z 索引{needsReview('indexLetters') ? <span>請檢查</span> : null}</legend>
              <p>選擇姓名英文開頭的字母；有多位人物時可以多選。</p>
              <div className="admin-alphabet">
                {alphabet.map((letter) => (
                  <button
                    aria-pressed={selectedLetters.includes(letter)}
                    key={letter}
                    onClick={() => toggleLetter(letter)}
                    type="button"
                  >{letter}</button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label aria-label="同時放進新到唱片" className="new-arrival-check">
            <input defaultChecked name="newArrival" type="checkbox" />
            <span><strong>同時放進「新到唱片」</strong><small>建議保持勾選，客人會先在首頁看到。</small></span>
          </label>

          <div className="form-actions">
            <button
              className="save-draft"
              disabled={isBusy}
              onClick={() => {
                if (formRef.current) void saveRecord(formRef.current, 'draft');
              }}
              type="button"
            >
              儲存草稿
            </button>
            <button className="publish-record" disabled={isBusy} type="submit">
              {isSaving ? <LoaderCircle aria-hidden="true" /> : <Check aria-hidden="true" />}
              立即上架
            </button>
          </div>

          {submitState.type !== 'idle' ? (
            <output className={`submit-message ${submitState.type}`}>
              {submitState.type === 'saving' ? <LoaderCircle aria-hidden="true" /> : null}
              <p>{submitState.message}</p>
              {submitState.type === 'success' ? (
                <button onClick={resetForm} type="button"><RotateCcw aria-hidden="true" /> 再新增一張</button>
              ) : null}
            </output>
          ) : null}
        </section>
      </form>
    </main>
  );
}
