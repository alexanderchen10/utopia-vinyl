'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronDown,
  Disc3,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { initialRecords, type VinylRecord } from '@/lib/catalog';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const navigation = [
  { id: 'new-arrivals', label: '新到唱片', subtitle: '最新入庫', accent: true },
  {
    id: 'classical',
    label: '古典',
    subtitle: '按作曲家索引',
    submenu: '依作曲家英文字母瀏覽',
  },
  {
    id: 'jazz',
    label: '爵士',
    subtitle: '按演奏家／樂團索引',
    submenu: '依演奏家或樂團英文字母瀏覽',
  },
  { id: 'pop', label: '流行', subtitle: '流行音樂' },
  { id: 'taiwan', label: '臺灣黑膠', subtitle: '臺灣之聲' },
];

export default function Home() {
  const [records, setRecords] = useState<VinylRecord[]>(initialRecords);
  const [selected, setSelected] = useState('new-arrivals');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const selectedNav =
    navigation.find((item) => item.id === selected) ?? navigation[0];
  const hasAlphabet = selected === 'classical' || selected === 'jazz';
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const selectedCategoryRecords = records.filter(
    (record) => record.category === selected,
  );
  const availableLetters = new Set(
    selectedCategoryRecords.flatMap((record) => record.indexLetters),
  );
  const filteredRecords = records.filter((record) => {
    const matchesCollection =
      selected === 'new-arrivals'
        ? record.newArrival
        : record.category === selected;
    const matchesLetter =
      !selectedLetter || record.indexLetters.includes(selectedLetter);
    const searchText = [
      record.title,
      record.composers,
      record.performers,
      record.label,
      record.catalogNumber,
    ]
      .join(' ')
      .toLocaleLowerCase();

    return (
      matchesCollection &&
      matchesLetter &&
      (!normalizedSearch || searchText.includes(normalizedSearch))
    );
  });

  useEffect(() => {
    let cancelled = false;
    const navigationFrame = window.requestAnimationFrame(() => {
      const query = new URLSearchParams(window.location.search);
      const requestedCollection = query.get('collection');
      const requestedSearch = query.get('q');

      if (navigation.some((item) => item.id === requestedCollection)) {
        setSelected(requestedCollection as string);
      }
      if (requestedSearch) setSearchQuery(requestedSearch);
    });

    fetch('/api/records')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load records');
        return (await response.json()) as { records?: VinylRecord[] };
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.records)) setRecords(data.records);
      })
      .catch(() => {
        // Keep the built-in records visible if storage is temporarily unavailable.
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(navigationFrame);
    };
  }, []);

  function selectCollection(id: string) {
    setSelected(id);
    setSelectedLetter(null);
    setMobileOpen(false);
    document
      .querySelector('.collection-heading')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <main id="top">
      <div className="announcement">
        <p>滿 NT$2,000 享免運・黑膠唱片專門店</p>
      </div>

      <header className="site-header">
        <div className="utility-row shell">
          <Button
            aria-expanded={mobileOpen}
            aria-label="開啟選單"
            className="mobile-menu"
            onClick={() => setMobileOpen((open) => !open)}
            size="icon"
            variant="ghost"
          >
            <Menu />
          </Button>

          <a className="wordmark" href="#top" aria-label="Utopia Vinyl 首頁">
            <Image
              alt="Utopia Vinyl 黑膠理想國"
              className="brand-logo"
              height={1024}
              priority
              src="/utopia-vinyl.png"
              width={1536}
            />
          </a>

          <label className="search-box">
            <Search aria-hidden="true" />
            <span className="sr-only">搜尋唱片</span>
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜尋作曲家、演奏家或樂團"
              type="search"
              value={searchQuery}
            />
          </label>

          <div className="header-actions">
            <Button aria-label="我的收藏" disabled size="icon" variant="ghost">
              <Heart />
            </Button>
            <Button
              aria-label="購物袋，目前沒有商品"
              disabled
              size="icon"
              variant="ghost"
            >
              <ShoppingBag />
            </Button>
          </div>
        </div>

        <nav
          className={`category-nav ${mobileOpen ? 'is-open' : ''}`}
          aria-label="主要分類"
        >
          <div className="category-inner shell">
            {navigation.map((item) => (
              <div className="nav-item" key={item.label}>
                <button
                  aria-current={selected === item.id ? 'page' : undefined}
                  className={item.accent ? 'accent-link' : ''}
                  onClick={() => selectCollection(item.id)}
                  type="button"
                >
                  <span>{item.label}</span>
                  <small>{item.subtitle}</small>
                  {item.submenu ? <ChevronDown aria-hidden="true" /> : null}
                </button>
                {item.submenu ? (
                  <div className="nav-popover">
                    <p>{item.submenu}</p>
                    <div
                      className="mini-alphabet"
                      aria-label={`${item.label} A 到 Z`}
                    >
                      {alphabet.map((letter) => (
                        <button
                          key={letter}
                          onClick={() => {
                            selectCollection(item.id);
                            setSelectedLetter(letter);
                          }}
                          type="button"
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </nav>
      </header>

      <section className="collection-heading shell" id="new-arrivals">
        <p className="eyebrow">精選收藏</p>
        <div className="title-line">
          <div>
            <h1>{selectedNav.label}</h1>
            <p>{selectedNav.subtitle}</p>
          </div>
          <span className="count-pill">{filteredRecords.length} 張唱片</span>
        </div>
        <p className="intro">
          歡迎來到 Utopia
          Vinyl。請盡情瀏覽，享受尋找唱片的樂趣。我們擁有豐富的黑膠唱片收藏，自
          2009 年起營業至今。
        </p>
      </section>

      <div className="catalog shell">
        <aside className="filters" aria-label="唱片篩選">
          <div className="filter-title">
            <span>瀏覽方式</span>
            <SlidersHorizontal aria-hidden="true" />
          </div>
          <div className="filter-group">
            <h2>分類</h2>
            {navigation.slice(1).map((item) => (
              <button
                aria-pressed={selected === item.id}
                key={item.id}
                onClick={() => selectCollection(item.id)}
                type="button"
              >
                {item.label}
                {item.id === 'classical' || item.id === 'jazz'
                  ? '音樂'
                  : ''}{' '}
                <span>
                  {
                    records.filter((record) => record.category === item.id)
                      .length
                  }
                </span>
              </button>
            ))}
          </div>
          <div className="filter-group">
            <h2>姓名索引</h2>
            <p>古典依作曲家，爵士依演奏家或樂團排列。</p>
            <div className="alphabet" aria-label="A 到 Z 索引">
              {alphabet.map((letter) => (
                <button
                  aria-pressed={selectedLetter === letter}
                  disabled={!hasAlphabet || !availableLetters.has(letter)}
                  key={letter}
                  onClick={() => setSelectedLetter(letter)}
                  type="button"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="products" aria-label="唱片列表">
          <div className="product-toolbar">
            <p>顯示 {filteredRecords.length} 項結果</p>
            <button disabled type="button">
              依上架日期排序 <ChevronDown aria-hidden="true" />
            </button>
          </div>

          {filteredRecords.length ? (
            <div className="product-grid">
              {filteredRecords.map((record) => (
                <article className="record-card" key={record.id}>
                  <Link
                    aria-label={`查看 ${record.title} 唱片詳情`}
                    className="record-card-link"
                    href={`/records/${record.id}`}
                  >
                    <div className="record-cover">
                      <Image
                        alt={`${record.title} 唱片封面`}
                        height={1254}
                        sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 36vw"
                        src={record.image}
                        width={1254}
                      />
                      {record.newArrival ? <span>新到</span> : null}
                    </div>
                    <div className="record-details">
                      <p className="record-composer">{record.composers}</p>
                      <h2>{record.title}</h2>
                      <p className="record-performers">{record.performers}</p>
                      <dl>
                        <div>
                          <dt>唱片公司</dt>
                          <dd>{record.label}</dd>
                        </div>
                        <div>
                          <dt>編號</dt>
                          <dd>{record.catalogNumber}</dd>
                        </div>
                      </dl>
                      <div className="record-status">
                        <strong>{record.price}</strong>
                        <span>{record.condition}</span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-catalog">
              <div className="record-icon" aria-hidden="true">
                <Disc3 />
              </div>
              <p className="eyebrow">尚未找到唱片</p>
              <h2 id="empty-title">
                {normalizedSearch
                  ? `找不到符合「${searchQuery.trim()}」的唱片`
                  : selectedLetter
                    ? `${selectedLetter} 區尚未有唱片`
                    : '唱片正在入櫃'}
              </h2>
              <p>
                {normalizedSearch
                  ? '請嘗試搜尋其他作曲家、演奏家、樂團或唱片編號。'
                  : `「${selectedNav.label}」已經準備好迎接第一批收藏。加入唱片後，它們會以清楚的大封面網格顯示在這裡。`}
              </p>
              <Button className="notify-button" disabled>
                {selectedNav.label}會顯示在這裡
              </Button>
            </div>
          )}
        </section>
      </div>

      <section className="browse-strip">
        <div className="shell browse-inner">
          <p>
            <span>01</span> 古典音樂按作曲家 A–Z
          </p>
          <p>
            <span>02</span> 爵士音樂按演奏家／樂團 A–Z
          </p>
          <p>
            <span>03</span> 流行與臺灣黑膠獨立分類
          </p>
        </div>
      </section>

      <footer>
        <div className="shell footer-inner">
          <a
            className="wordmark footer-brand"
            href="#top"
            aria-label="Utopia Vinyl 首頁"
          >
            <Image
              alt="Utopia Vinyl 黑膠理想國"
              className="brand-logo footer-logo"
              height={1024}
              src="/utopia-vinyl.png"
              width={1536}
            />
          </a>
          <p>自 2009 年起，為愛樂人收藏每一種聲音。</p>
          <p className="copyright">© 2026 Utopia Vinyl・版權所有</p>
        </div>
      </footer>
    </main>
  );
}
