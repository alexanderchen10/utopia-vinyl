export type RecordCategory = 'classical' | 'jazz' | 'pop' | 'taiwan';

export type RecordStatus = 'draft' | 'published';

export type VinylRecord = {
  id: string;
  title: string;
  composers: string;
  performers: string;
  category: RecordCategory;
  indexLetters: string[];
  label: string;
  catalogNumber: string;
  image: string;
  newArrival: boolean;
  price: string;
  condition: string;
  status?: RecordStatus;
  createdAt?: string;
};

export const categoryLabels: Record<RecordCategory, string> = {
  classical: '古典',
  jazz: '爵士',
  pop: '流行',
  taiwan: '臺灣黑膠',
};

export const initialRecords: VinylRecord[] = [
  {
    id: 'janos-starker-most-beautiful-melodies',
    title: 'The Most Beautiful Melodies',
    composers: '巴赫・海頓・舒伯特・聖桑・馬替奴・舒曼・布洛赫・韋伯',
    performers: 'János Starker 大提琴・Shuku Iwasaki 鋼琴',
    category: 'classical',
    indexLetters: ['B', 'H', 'S', 'M', 'W'],
    label: 'DENON PCM Recording',
    catalogNumber: 'GK-7041-HQ',
    image: '/records/janos-starker-most-beautiful-melodies.jpeg',
    newArrival: true,
    price: '價格待定',
    condition: '品相待確認',
    status: 'published',
    createdAt: '2026-09-02T00:00:00.000Z',
  },
  {
    id: 'chopin-liszt-piano-concertos',
    title: 'Chopin & Liszt: Piano Concertos No. 1',
    composers: '蕭邦・李斯特',
    performers: 'Martha Argerich 鋼琴・Claudio Abbado 指揮・London Symphony Orchestra',
    category: 'classical',
    indexLetters: ['C', 'L'],
    label: 'Deutsche Grammophon',
    catalogNumber: '139 383',
    image: '/records/chopin-liszt-piano-concertos.jpeg',
    newArrival: true,
    price: '價格待定',
    condition: '品相待確認',
    status: 'published',
    createdAt: '2026-09-03T00:00:00.000Z',
  },
];

export function normalizeIndexLetters(value: string | string[]) {
  const source = Array.isArray(value) ? value.join('') : value;
  return Array.from(
    new Set(source.toUpperCase().match(/[A-Z]/g) ?? []),
  ).sort();
}
