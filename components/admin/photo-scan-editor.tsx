'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, ScanLine } from 'lucide-react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createPerspectiveScan,
  defaultScanAdjustments,
  isUsableCoverCorners,
  type CoverCorners,
  type CoverPoint,
  type ScanAdjustments,
} from '@/lib/client/record-image';

type CornerKey = keyof CoverCorners;

const cornerLabels: Record<CornerKey, string> = {
  topLeft: '左上角',
  topRight: '右上角',
  bottomRight: '右下角',
  bottomLeft: '左下角',
};

const fullImageCorners: CoverCorners = {
  topLeft: { x: 0.02, y: 0.02 },
  topRight: { x: 0.98, y: 0.02 },
  bottomRight: { x: 0.98, y: 0.98 },
  bottomLeft: { x: 0.02, y: 0.98 },
};

function copyCorners(corners: CoverCorners): CoverCorners {
  return {
    topLeft: { ...corners.topLeft },
    topRight: { ...corners.topRight },
    bottomRight: { ...corners.bottomRight },
    bottomLeft: { ...corners.bottomLeft },
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

type PhotoScanEditorProps = {
  file: File | null;
  initialCorners?: CoverCorners | null;
  onApply: (scan: File) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function PhotoScanEditor({
  file,
  initialCorners,
  onApply,
  onOpenChange,
  open,
}: PhotoScanEditorProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [previewUrl] = useState(() => file ? URL.createObjectURL(file) : '');
  const [corners, setCorners] = useState<CoverCorners>(() => copyCorners(initialCorners ?? fullImageCorners));
  const [adjustments, setAdjustments] = useState<ScanAdjustments>(defaultScanAdjustments);
  const [dragging, setDragging] = useState<CornerKey | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function updateCorner(key: CornerKey, point: CoverPoint) {
    setCorners((current) => ({
      ...current,
      [key]: { x: clamp(point.x), y: clamp(point.y) },
    }));
  }

  function updateCornerFromPointer(key: CornerKey, clientX: number, clientY: number) {
    const surface = surfaceRef.current;
    if (!surface) return;
    const bounds = surface.getBoundingClientRect();
    updateCorner(key, {
      x: (clientX - bounds.left) / bounds.width,
      y: (clientY - bounds.top) / bounds.height,
    });
  }

  async function applyScan() {
    if (!file) return;
    if (!isUsableCoverCorners(corners)) {
      setMessage('四個角落的位置互相交叉了，請重新調整。');
      return;
    }

    setIsApplying(true);
    setMessage('');
    try {
      const scan = await createPerspectiveScan(file, corners, adjustments);
      onApply(scan);
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '暫時無法整理照片。');
    } finally {
      setIsApplying(false);
    }
  }

  function resetEditor() {
    setCorners(copyCorners(initialCorners ?? fullImageCorners));
    setAdjustments(defaultScanAdjustments);
    setMessage('');
  }

  const polygon = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ].map((point) => `${point.x * 100},${point.y * 100}`).join(' ');

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="scan-editor-dialog" showCloseButton={false}>
        <DialogHeader className="scan-editor-heading">
          <div className="scan-editor-title-icon"><ScanLine aria-hidden="true" /></div>
          <div>
            <DialogTitle>整理唱片封面</DialogTitle>
            <DialogDescription>把四個圓點拖到封面的四個角落，再調整照片色彩。</DialogDescription>
          </div>
        </DialogHeader>

        <div className="scan-editor-workspace">
          <div className="scan-editor-photo-wrap">
            {previewUrl ? (
              <div className="scan-editor-photo" ref={surfaceRef}>
                {/* A normal image keeps the uploaded photo's exact aspect ratio for corner placement. */}
                {/* oxlint-disable-next-line next/no-img-element -- natural dimensions keep drag coordinates aligned with this local preview */}
                <img
                  alt="等待調整的唱片封面"
                  draggable={false}
                  src={previewUrl}
                  style={{
                    filter: `brightness(${adjustments.brightness}) contrast(${adjustments.contrast}) saturate(${adjustments.saturation})`,
                  }}
                />
                <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <polygon points={polygon} />
                </svg>
                {(Object.keys(cornerLabels) as CornerKey[]).map((key) => {
                  const point = corners[key];
                  return (
                    <button
                      aria-label={`移動${cornerLabels[key]}`}
                      className={`scan-corner ${dragging === key ? 'is-dragging' : ''}`}
                      key={key}
                      onKeyDown={(event) => {
                        const step = event.shiftKey ? 0.03 : 0.01;
                        let next = point;
                        if (event.key === 'ArrowLeft') next = { ...point, x: point.x - step };
                        if (event.key === 'ArrowRight') next = { ...point, x: point.x + step };
                        if (event.key === 'ArrowUp') next = { ...point, y: point.y - step };
                        if (event.key === 'ArrowDown') next = { ...point, y: point.y + step };
                        if (next !== point) {
                          event.preventDefault();
                          updateCorner(key, next);
                        }
                      }}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setDragging(key);
                        updateCornerFromPointer(key, event.clientX, event.clientY);
                      }}
                      onPointerMove={(event) => {
                        if (dragging === key) updateCornerFromPointer(key, event.clientX, event.clientY);
                      }}
                      onPointerUp={(event) => {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        }
                        setDragging(null);
                      }}
                      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                      type="button"
                    >
                      <span>{cornerLabels[key]}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <p>拍照時讓手機與唱片保持平行，並使用柔和光線，可以大幅減少反光。</p>
          </div>

          <div className="scan-editor-controls">
            <label>
              <span>亮度 <strong>{Math.round(adjustments.brightness * 100)}%</strong></span>
              <input
                max="1.2"
                min="0.82"
                onChange={(event) => setAdjustments((current) => ({ ...current, brightness: Number(event.target.value) }))}
                step="0.01"
                type="range"
                value={adjustments.brightness}
              />
            </label>
            <label>
              <span>對比 <strong>{Math.round(adjustments.contrast * 100)}%</strong></span>
              <input
                max="1.25"
                min="0.82"
                onChange={(event) => setAdjustments((current) => ({ ...current, contrast: Number(event.target.value) }))}
                step="0.01"
                type="range"
                value={adjustments.contrast}
              />
            </label>
            <label>
              <span>色彩 <strong>{Math.round(adjustments.saturation * 100)}%</strong></span>
              <input
                max="1.2"
                min="0.75"
                onChange={(event) => setAdjustments((current) => ({ ...current, saturation: Number(event.target.value) }))}
                step="0.01"
                type="range"
                value={adjustments.saturation}
              />
            </label>
            <button className="scan-reset" onClick={resetEditor} type="button">
              <RotateCcw aria-hidden="true" /> 恢復原始設定
            </button>
            <div className="scan-editor-note">
              <strong>反光仍然很明顯？</strong>
              <span>請把唱片放平，關掉閃光燈，改用窗邊的柔和光線重新拍攝。單張照片無法完整還原被反光遮住的文字。</span>
            </div>
          </div>
        </div>

        {message ? <p className="scan-editor-error" role="alert">{message}</p> : null}

        <DialogFooter className="scan-editor-footer">
          <DialogClose className="scan-cancel">取消</DialogClose>
          <button
            className="scan-apply"
            disabled={isApplying || !file}
            onClick={() => { void applyScan(); }}
            type="button"
          >
            <Check aria-hidden="true" /> {isApplying ? '正在套用…' : '套用整理結果'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
