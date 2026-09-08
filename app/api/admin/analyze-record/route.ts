import { env } from 'cloudflare:workers';

import { authorizeAdmin, isSameOriginRequest } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

const modelName = '@cf/meta/llama-4-scout-17b-16e-instruct';
const maximumImageBytes = 800_000;
const maximumDailyRequests = 10;
const allowedCategories = new Set(['classical', 'jazz', 'pop', 'taiwan']);
const responseHeaders = { 'Cache-Control': 'no-store' };

const recordSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    composers: { type: 'string' },
    performers: { type: 'string' },
    label: { type: 'string' },
    catalogNumber: { type: 'string' },
    category: { type: 'string', enum: ['classical', 'jazz', 'pop', 'taiwan'] },
    indexLetters: {
      type: 'array',
      items: { type: 'string', pattern: '^[A-Z]$' },
      maxItems: 8,
    },
    fieldConfidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'number', minimum: 0, maximum: 1 },
        composers: { type: 'number', minimum: 0, maximum: 1 },
        performers: { type: 'number', minimum: 0, maximum: 1 },
        label: { type: 'number', minimum: 0, maximum: 1 },
        catalogNumber: { type: 'number', minimum: 0, maximum: 1 },
        category: { type: 'number', minimum: 0, maximum: 1 },
        indexLetters: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['title', 'composers', 'performers', 'label', 'catalogNumber', 'category', 'indexLetters'],
    },
    coverCorners: {
      type: 'object',
      additionalProperties: false,
      properties: {
        topLeft: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
          required: ['x', 'y'],
        },
        topRight: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
          required: ['x', 'y'],
        },
        bottomRight: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
          required: ['x', 'y'],
        },
        bottomLeft: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
          required: ['x', 'y'],
        },
      },
      required: ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'],
    },
    coverCornersConfidence: { type: 'number', minimum: 0, maximum: 1 },
    notes: { type: 'array', items: { type: 'string' }, maxItems: 3 },
  },
  required: [
    'title',
    'composers',
    'performers',
    'label',
    'catalogNumber',
    'category',
    'indexLetters',
    'fieldConfidence',
    'coverCorners',
    'coverCornersConfidence',
    'notes',
  ],
} as const;

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: responseHeaders });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function textValue(value: unknown, maximumLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function confidenceValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function pointValue(value: unknown) {
  if (!value || typeof value !== 'object') return { x: 0, y: 0 };
  const point = value as { x?: unknown; y?: unknown };
  return {
    x: confidenceValue(point.x),
    y: confidenceValue(point.y),
  };
}

function parseResponse(response: unknown) {
  let candidate: unknown = response;
  if (typeof response === 'string') {
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace <= firstBrace) throw new Error('AI response did not contain JSON');
    candidate = JSON.parse(response.slice(firstBrace, lastBrace + 1));
  }
  if (!candidate || typeof candidate !== 'object') throw new Error('AI response was not an object');

  const record = candidate as Record<string, unknown>;
  const confidence = record.fieldConfidence && typeof record.fieldConfidence === 'object'
    ? record.fieldConfidence as Record<string, unknown>
    : {};
  const corners = record.coverCorners && typeof record.coverCorners === 'object'
    ? record.coverCorners as Record<string, unknown>
    : {};
  const category = textValue(record.category, 20);
  const notes = Array.isArray(record.notes)
    ? record.notes.map((note) => textValue(note, 140)).filter(Boolean).slice(0, 3)
    : [];

  return {
    title: textValue(record.title, 180),
    composers: textValue(record.composers, 300),
    performers: textValue(record.performers, 300),
    label: textValue(record.label, 120),
    catalogNumber: textValue(record.catalogNumber, 80),
    category: allowedCategories.has(category) ? category : null,
    indexLetters: Array.isArray(record.indexLetters)
      ? [...new Set(record.indexLetters
          .map((letter) => textValue(letter, 1).toUpperCase())
          .filter((letter) => /^[A-Z]$/.test(letter)))]
      : [],
    fieldConfidence: {
      title: confidenceValue(confidence.title),
      composers: confidenceValue(confidence.composers),
      performers: confidenceValue(confidence.performers),
      label: confidenceValue(confidence.label),
      catalogNumber: confidenceValue(confidence.catalogNumber),
      category: confidenceValue(confidence.category),
      indexLetters: confidenceValue(confidence.indexLetters),
    },
    coverCorners: {
      topLeft: pointValue(corners.topLeft),
      topRight: pointValue(corners.topRight),
      bottomRight: pointValue(corners.bottomRight),
      bottomLeft: pointValue(corners.bottomLeft),
    },
    coverCornersConfidence: confidenceValue(record.coverCornersConfidence),
    notes,
  };
}

function isFreeLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /3036|429|rate.?limit|neuron|daily allocation/i.test(message);
}

async function reserveDailyRequest() {
  const day = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  return env.DB.prepare(
    `INSERT INTO admin_ai_usage (usage_day, request_count, updated_at)
      VALUES (?, 1, ?)
      ON CONFLICT(usage_day) DO UPDATE SET
        request_count = request_count + 1,
        updated_at = excluded.updated_at
      WHERE request_count < ?
      RETURNING request_count`,
  ).bind(day, now, maximumDailyRequests).first<{ request_count: number }>();
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ message: '辨識要求無效，請重新整理頁面。' }, 403);
  }

  const auth = await authorizeAdmin(request);
  if (!auth.ok) return json({ message: auth.message }, auth.status);
  if (!env.AI) {
    return json({ message: '自動辨識尚未啟用，您仍可以手動填寫。' }, 503);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 1_250_000) {
    return json({ message: '照片太大，請重新選擇照片。' }, 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ message: '無法讀取照片，請重新選擇。' }, 400);
  }

  const image = formData.get('image');
  if (!(image instanceof File) || image.size === 0 || image.size > maximumImageBytes) {
    return json({ message: '請重新選擇有效的封面照片。' }, 400);
  }
  if (image.type !== 'image/jpeg') {
    return json({ message: '照片格式處理失敗，請重新選擇。' }, 400);
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  if (!isJpeg(bytes)) return json({ message: '這個檔案不是有效的唱片照片。' }, 400);

  let reservation: { request_count: number } | null;
  try {
    reservation = await reserveDailyRequest();
  } catch (error) {
    console.error(JSON.stringify({ event: 'record_ai_usage_reservation_failed', error: String(error) }));
    return json({ message: '自動辨識暫時無法使用，您仍可以手動填寫。' }, 503);
  }
  if (!reservation) {
    return json({ message: '今日的免費自動辨識次數已用完，請手動填寫，明天可再使用。' }, 429);
  }

  const prompt = `You are reading one photograph of a vinyl record cover for a careful store cataloguer.

Extract only information visibly supported by the photograph. Never invent missing names or numbers. Preserve the language and spelling printed on the cover. Return an empty string for any field that is not visible.

Field rules:
- title: a concise record or album title.
- composers: composer names only, separated by " ・ ".
- performers: soloists, conductors, orchestras, bands, or groups, separated by " ・ ". Include the role only when it is printed or very clear.
- label: the record company or label.
- catalogNumber: the printed catalogue number. Never confuse a year, price, or track number for it.
- category: classical for classical repertoire, jazz for jazz, taiwan for Taiwanese-language or Taiwan-focused records, otherwise pop.
- indexLetters: for classical use the Latin surname initials of composers; for jazz use performer or group initials; otherwise return an empty array.
- fieldConfidence: score each proposed field from 0 to 1. A blank field must have confidence 0.
- coverCorners: normalized x/y coordinates from 0 to 1 for the four outer corners of the square record sleeve, in the full photograph. If the sleeve edge is unclear, use the full image corners and give low confidence.
- notes: up to three short Traditional Chinese warnings about uncertain or missing information. Do not discuss price or condition.

Return JSON only.`;

  try {
    const result = await env.AI.run(modelName, {
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read this vinyl record cover and prepare the store fields.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${bytesToBase64(bytes)}` } },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: recordSchema },
      max_tokens: 700,
      temperature: 0,
    });
    const parsed = parseResponse(result.response);
    return json({
      message: '已讀取封面資料，請在上架前檢查。',
      record: parsed,
      remainingToday: Math.max(0, maximumDailyRequests - reservation.request_count),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'record_ai_analysis_failed', error: String(error) }));
    if (isFreeLimitError(error)) {
      return json({ message: '今日的 Cloudflare 免費辨識額度已用完，請手動填寫。' }, 429);
    }
    return json({ message: '自動辨識沒有讀取成功，請手動填寫或重試。' }, 502);
  }
}
