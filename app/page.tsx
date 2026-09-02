'use client';

import { useState } from 'react';
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

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const navigation = [
  { id: 'new-arrivals', label: '新到唱片', english: 'New Arrivals', accent: true },
  { id: 'classical', label: '古典', english: 'Classical', submenu: '依作曲家 A–Z 瀏覽' },
  { id: 'jazz', label: '爵士', english: 'Jazz', submenu: '依演奏家或樂團 A–Z 瀏覽' },
  { id: 'pop', label: '流行', english: 'Pop' },
  { id: 'taiwan', label: '臺灣黑膠', english: 'Taiwan Vinyl' },
];

export default function Home() {
  const [selected, setSelected] = useState('new-arrivals');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const selectedNav = navigation.find((item) => item.id === selected) ?? navigation[0];
  const hasAlphabet = selected === 'classical' || selected === 'jazz';

  function selectCollection(id: string) {
    setSelected(id);
    setSelectedLetter(null);
    setMobileOpen(false);
    document.querySelector('.collection-heading')?.scrollIntoView({ behavior: 'smooth' });
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
            <img
              alt="Utopia Vinyl 黑膠理想國"
              className="brand-logo"
              height="1024"
              src="/utopia-vinyl.png"
              width="1536"
            />
          </a>

          <label className="search-box">
            <Search aria-hidden="true" />
            <span className="sr-only">搜尋唱片</span>
            <input placeholder="搜尋作曲家、演奏家或樂團" type="search" />
          </label>

          <div className="header-actions">
            <Button aria-label="我的收藏" disabled size="icon" variant="ghost">
              <Heart />
            </Button>
            <Button aria-label="購物袋，目前沒有商品" disabled size="icon" variant="ghost">
              <ShoppingBag />
            </Button>
          </div>
        </div>

        <nav className={`category-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="主要分類">
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
                  <small>{item.english}</small>
                  {item.submenu ? <ChevronDown aria-hidden="true" /> : null}
                </button>
                {item.submenu ? (
                  <div className="nav-popover">
                    <p>{item.submenu}</p>
                    <div className="mini-alphabet" aria-label={`${item.label} A 到 Z`}>
                      {alphabet.map((letter) => (
                        <button key={letter} onClick={() => { selectCollection(item.id); setSelectedLetter(letter); }} type="button">
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
        <p className="eyebrow">THE COLLECTION</p>
        <div className="title-line">
          <div>
            <h1>{selectedNav.label}</h1>
            <p>{selectedNav.english.toUpperCase()}</p>
          </div>
          <span className="count-pill">0 張唱片</span>
        </div>
        <p className="intro">
          歡迎來到 Utopia Vinyl。請盡情瀏覽，享受尋找唱片的樂趣。我們擁有豐富的黑膠唱片收藏，自 2009 年起營業至今。
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
              <button aria-pressed={selected === item.id} key={item.id} onClick={() => selectCollection(item.id)} type="button">
                {item.label}{item.id === 'classical' || item.id === 'jazz' ? '音樂' : ''} <span>0</span>
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
                  disabled={!hasAlphabet}
                  key={letter}
                  onClick={() => setSelectedLetter(letter)}
                  type="button"
                >{letter}</button>
              ))}
            </div>
          </div>
        </aside>

        <section className="products" aria-labelledby="empty-title">
          <div className="product-toolbar">
            <p>顯示 0 項結果</p>
            <button disabled type="button">依上架日期排序 <ChevronDown aria-hidden="true" /></button>
          </div>

          <div className="empty-catalog">
            <div className="record-icon" aria-hidden="true"><Disc3 /></div>
            <p className="eyebrow">COMING SOON</p>
            <h2 id="empty-title">{selectedLetter ? `${selectedLetter} 區尚未有唱片` : '唱片正在入櫃'}</h2>
            <p>「{selectedNav.label}」已經準備好迎接第一批收藏。加入唱片後，它們會以清楚的大封面網格顯示在這裡。</p>
            <Button className="notify-button" disabled>{selectedNav.label}會顯示在這裡</Button>
          </div>
        </section>
      </div>

      <section className="brand-story shell" aria-label="Utopia Vinyl 品牌介紹">
        <img
          alt="Utopia Vinyl 黑膠理想國金色唱片封套與黑膠唱片"
          height="1024"
          src="/utopia-vinyl.png"
          width="1536"
        />
        <div>
          <p className="eyebrow">BUILT FOR THE COLLECTION</p>
          <h2>讓每一張唱片，<br />都有自己的位置。</h2>
          <p>這個空間以收藏為主角；分類清楚、封面寬敞，也保留老唱片行那種慢慢翻找的樂趣。</p>
        </div>
      </section>

      <section className="browse-strip">
        <div className="shell browse-inner">
          <p><span>01</span> 古典音樂按作曲家 A–Z</p>
          <p><span>02</span> 爵士音樂按演奏家／樂團 A–Z</p>
          <p><span>03</span> 流行與臺灣黑膠獨立分類</p>
        </div>
      </section>

      <footer>
        <div className="shell footer-inner">
          <a className="wordmark footer-brand" href="#top" aria-label="Utopia Vinyl 首頁">
            <img
              alt="Utopia Vinyl 黑膠理想國"
              className="brand-logo footer-logo"
              height="1024"
              src="/utopia-vinyl.png"
              width="1536"
            />
          </a>
          <p>自 2009 年起，為愛樂人收藏每一種聲音。</p>
          <p className="copyright">© 2026 UTOPIA VINYL</p>
        </div>
      </footer>
    </main>
  );
}
