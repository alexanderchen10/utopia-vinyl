'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Camera, Check, ImagePlus, LoaderCircle, LockKeyhole, LogOut, RotateCcw } from 'lucide-react';

import { categoryLabels, type RecordCategory, type RecordStatus } from '@/lib/catalog';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const acceptedImages = ['image/jpeg', 'image/png', 'image/webp'];
const maximumOriginalImageBytes = 20 * 1024 * 1024;
const targetStoredImageBytes = 700_000;

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('無法處理這張照片。')),
      'image/jpeg',
      quality,
    );
  });
}

async function prepareImage(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const initialScale = Math.min(1, 1500 / longestSide);
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));
    let bestBlob: Blob | null = null;

    while (width >= 480 && height >= 480) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('無法處理這張照片。');

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of [0.84, 0.76, 0.68, 0.6]) {
        const blob = await canvasToJpeg(canvas, quality);
        bestBlob = blob;
        if (blob.size <= targetStoredImageBytes) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'record-cover';
          return new File([blob], `${baseName}.jpg`, {
            lastModified: Date.now(),
            type: 'image/jpeg',
          });
        }
      }

      width = Math.round(width * 0.82);
      height = Math.round(height * 0.82);
    }

    if (!bestBlob || bestBlob.size > targetStoredImageBytes) {
      throw new Error('照片處理後仍然太大，請換一張照片再試。');
    }

    return new File([bestBlob], 'record-cover.jpg', {
      lastModified: Date.now(),
      type: 'image/jpeg',
    });
  } finally {
    bitmap.close();
  }
}

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
  const [imagePreview, setImagePreview] = useState('');
  const [originalImageName, setOriginalImageName] = useState('');
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
  const [category, setCategory] = useState<RecordCategory>('classical');
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle', message: '' });
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

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
    setSubmitState({ type: 'idle', message: '' });

    try {
      const preparedFile = await prepareImage(file);
      if (imageRequestRef.current !== requestId) return;

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const previewUrl = URL.createObjectURL(preparedFile);
      previewUrlRef.current = previewUrl;
      setImagePreview(previewUrl);
      setImageFile(preparedFile);
      setOriginalImageName(file.name);
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
    setCategory('classical');
    setSelectedLetters([]);
    setImageFile(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setImagePreview('');
    setOriginalImageName('');
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
    setCategory('classical');
    setSelectedLetters([]);
    setImageFile(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setImagePreview('');
    setOriginalImageName('');
    setIsOptimizing(false);
    setFileInputKey((key) => key + 1);
    setSubmitState({ type: 'success', message });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isSaving = submitState.type === 'saving';
  const isBusy = isSaving || isOptimizing;
  const needsIndex = category === 'classical' || category === 'jazz';

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
            className={`photo-drop ${imagePreview ? 'has-photo' : ''} ${isDragging ? 'is-dragging' : ''}`}
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
                <span>稍等一下，照片會自動縮小。</span>
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
            <div className="photo-ready"><Check aria-hidden="true" /> 照片已整理完成：{originalImageName}</div>
          ) : (
            <p className="photo-tip">小提醒：把唱片放正、光線照亮，拍出完整正方形封面最好看。</p>
          )}
        </section>

        <section className="details-column" aria-labelledby="details-title">
          <div className="section-number">02</div>
          <div className="section-heading">
            <div>
              <p>基本資料</p>
              <h2 id="details-title">這張唱片是什麼？</h2>
            </div>
          </div>

          <div className="form-field full-field">
            <label htmlFor="title">唱片名稱 <em>必填</em></label>
            <input id="title" maxLength={180} name="title" placeholder="例如：Chopin Piano Concertos" required />
          </div>

          <fieldset className="category-field">
            <legend>分類 <em>必填</em></legend>
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
            <div className="form-field">
              <label htmlFor="composers">作曲家</label>
              <input id="composers" maxLength={300} name="composers" placeholder="例如：蕭邦、李斯特" />
            </div>
            <div className="form-field">
              <label htmlFor="performers">演奏家或樂團</label>
              <input id="performers" maxLength={300} name="performers" placeholder="例如：Martha Argerich" />
            </div>
            <div className="form-field">
              <label htmlFor="label">唱片公司</label>
              <input id="label" maxLength={120} name="label" placeholder="例如：Deutsche Grammophon" />
            </div>
            <div className="form-field">
              <label htmlFor="catalogNumber">唱片編號</label>
              <input id="catalogNumber" maxLength={80} name="catalogNumber" placeholder="例如：139 383" />
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
            <fieldset className="index-field">
              <legend>{category === 'classical' ? '作曲家' : '演奏家／樂團'} A–Z 索引</legend>
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
