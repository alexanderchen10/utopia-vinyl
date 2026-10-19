import { env } from 'cloudflare:workers';

import { initialRecords } from '@/lib/catalog';
import { listPublishedRecords } from '@/lib/server/catalog-store';
import { expireOverdueOrders } from '@/lib/server/orders';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await expireOverdueOrders(env.DB);
    const records = await listPublishedRecords(env.DB);
    return Response.json({ records });
  } catch (error) {
    console.error('Unable to read the record catalog', error);
    return Response.json(
      { records: initialRecords },
      { headers: { 'X-Utopia-Storage': 'fallback' } },
    );
  }
}
