const targetStoredImageBytes = 700_000;
const longestPreparedSide = 1400;
const scanSide = 1200;

export type CoverPoint = { x: number; y: number };

export type CoverCorners = {
  topLeft: CoverPoint;
  topRight: CoverPoint;
  bottomRight: CoverPoint;
  bottomLeft: CoverPoint;
};

export type PreparedRecordImages = {
  original: File;
  scan: File;
};

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('無法處理這張照片。')),
      'image/jpeg',
      quality,
    );
  });
}

async function canvasToStoredFile(canvas: HTMLCanvasElement, baseName: string) {
  let workingCanvas = canvas;
  let bestBlob: Blob | null = null;

  while (workingCanvas.width >= 480 && workingCanvas.height >= 480) {
    for (const quality of [0.86, 0.78, 0.7, 0.62]) {
      const blob = await canvasToJpeg(workingCanvas, quality);
      bestBlob = blob;
      if (blob.size <= targetStoredImageBytes) {
        return new File([blob], `${baseName}.jpg`, {
          lastModified: Date.now(),
          type: 'image/jpeg',
        });
      }
    }

    const resized = document.createElement('canvas');
    resized.width = Math.round(workingCanvas.width * 0.84);
    resized.height = Math.round(workingCanvas.height * 0.84);
    const resizedContext = resized.getContext('2d');
    if (!resizedContext) throw new Error('無法處理這張照片。');
    resizedContext.drawImage(workingCanvas, 0, 0, resized.width, resized.height);
    workingCanvas = resized;
  }

  if (!bestBlob || bestBlob.size > targetStoredImageBytes) {
    throw new Error('照片處理後仍然太大，請換一張照片再試。');
  }

  return new File([bestBlob], `${baseName}.jpg`, {
    lastModified: Date.now(),
    type: 'image/jpeg',
  });
}

function drawWithGentleCleanup(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
) {
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.filter = 'brightness(1.015) contrast(1.035) saturate(1.01)';
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  context.filter = 'none';
}

export async function prepareRecordPhoto(file: File): Promise<PreparedRecordImages> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'record-cover';
    const originalScale = Math.min(1, longestPreparedSide / Math.max(bitmap.width, bitmap.height));
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = Math.max(1, Math.round(bitmap.width * originalScale));
    originalCanvas.height = Math.max(1, Math.round(bitmap.height * originalScale));
    const originalContext = originalCanvas.getContext('2d');
    if (!originalContext) throw new Error('無法處理這張照片。');
    originalContext.fillStyle = '#ffffff';
    originalContext.fillRect(0, 0, originalCanvas.width, originalCanvas.height);
    originalContext.drawImage(bitmap, 0, 0, originalCanvas.width, originalCanvas.height);

    const cropSize = Math.min(bitmap.width, bitmap.height);
    const cropX = Math.round((bitmap.width - cropSize) / 2);
    const cropY = Math.round((bitmap.height - cropSize) / 2);
    const outputSize = Math.min(scanSide, cropSize);
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = outputSize;
    scanCanvas.height = outputSize;
    const scanContext = scanCanvas.getContext('2d');
    if (!scanContext) throw new Error('無法處理這張照片。');
    drawWithGentleCleanup(
      scanContext,
      bitmap,
      cropX,
      cropY,
      cropSize,
      cropSize,
      outputSize,
      outputSize,
    );

    const [original, scan] = await Promise.all([
      canvasToStoredFile(originalCanvas, `${baseName}-original`),
      canvasToStoredFile(scanCanvas, `${baseName}-scan`),
    ]);
    return { original, scan };
  } finally {
    bitmap.close();
  }
}

function isFinitePoint(point: CoverPoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

export function isUsableCoverCorners(corners: CoverCorners) {
  const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  if (!points.every(isFinitePoint)) return false;

  const area = Math.abs(points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0)) / 2;

  return area >= 0.18 &&
    corners.topLeft.x < corners.topRight.x &&
    corners.bottomLeft.x < corners.bottomRight.x &&
    corners.topLeft.y < corners.bottomLeft.y &&
    corners.topRight.y < corners.bottomRight.y;
}

function solveLinearSystem(rows: number[][]) {
  const size = rows.length;
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-10) throw new Error('無法自動校正封面。');

    for (let index = column; index <= size; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= size; index += 1) {
        rows[row][index] -= factor * rows[column][index];
      }
    }
  }
  return rows.map((row) => row[size]);
}

function destinationToSourceHomography(corners: CoverCorners) {
  const destinations = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const sources = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  const rows: number[][] = [];

  destinations.forEach(({ x, y }, index) => {
    const source = sources[index];
    rows.push([x, y, 1, 0, 0, 0, -source.x * x, -source.x * y, source.x]);
    rows.push([0, 0, 0, x, y, 1, -source.y * x, -source.y * y, source.y]);
  });
  return solveLinearSystem(rows);
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round((value - 128) * 1.035 + 130)));
}

export async function createPerspectiveScan(sourceFile: File, corners: CoverCorners) {
  if (!isUsableCoverCorners(corners)) throw new Error('封面邊緣不夠清楚。');
  const bitmap = await createImageBitmap(sourceFile, { imageOrientation: 'from-image' });

  try {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = bitmap.width;
    sourceCanvas.height = bitmap.height;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) throw new Error('無法處理這張照片。');
    sourceContext.drawImage(bitmap, 0, 0);
    const sourcePixels = sourceContext.getImageData(0, 0, bitmap.width, bitmap.height).data;

    const outputSize = Math.min(scanSide, Math.max(720, Math.min(bitmap.width, bitmap.height)));
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputSize;
    outputCanvas.height = outputSize;
    const outputContext = outputCanvas.getContext('2d');
    if (!outputContext) throw new Error('無法處理這張照片。');
    const outputImage = outputContext.createImageData(outputSize, outputSize);
    const target = outputImage.data;
    const homography = destinationToSourceHomography(corners);

    for (let outputY = 0; outputY < outputSize; outputY += 1) {
      const y = outputY / Math.max(1, outputSize - 1);
      for (let outputX = 0; outputX < outputSize; outputX += 1) {
        const x = outputX / Math.max(1, outputSize - 1);
        const divisor = homography[6] * x + homography[7] * y + 1;
        const normalizedSourceX = (homography[0] * x + homography[1] * y + homography[2]) / divisor;
        const normalizedSourceY = (homography[3] * x + homography[4] * y + homography[5]) / divisor;
        const sourceX = Math.max(0, Math.min(bitmap.width - 1, Math.round(normalizedSourceX * (bitmap.width - 1))));
        const sourceY = Math.max(0, Math.min(bitmap.height - 1, Math.round(normalizedSourceY * (bitmap.height - 1))));
        const sourceIndex = (sourceY * bitmap.width + sourceX) * 4;
        const outputIndex = (outputY * outputSize + outputX) * 4;
        target[outputIndex] = clampChannel(sourcePixels[sourceIndex]);
        target[outputIndex + 1] = clampChannel(sourcePixels[sourceIndex + 1]);
        target[outputIndex + 2] = clampChannel(sourcePixels[sourceIndex + 2]);
        target[outputIndex + 3] = 255;
      }
    }

    outputContext.putImageData(outputImage, 0, 0);
    const baseName = sourceFile.name.replace(/-original\.jpg$/i, '').replace(/\.[^.]+$/, '') || 'record-cover';
    return canvasToStoredFile(outputCanvas, `${baseName}-scan`);
  } finally {
    bitmap.close();
  }
}
