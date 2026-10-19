'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Heart,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  LanguageSwitcher,
  useSiteLanguage,
} from '@/components/site/language-switcher';
import {
  initialRecords,
  isSpecialPrice,
  formatStorePrice,
  type VinylRecord,
} from '@/lib/catalog';
import { copy } from '@/lib/site-copy';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function isCurrentMonth(createdAt: string | undefined, now: Date | null) {
  if (!now) return true;
  if (!createdAt) return false;
  const created = new Date(createdAt);
  return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
}

const navigation = [
  { id: 'home', key: 'home', accent: true },
  { id: 'new-arrivals', key: 'newArrivals' },
  { id: 'special-prices', key: 'specialPrices' },
  {
    id: 'classical',
    key: 'classical',
    submenuKey: 'classical',
  },
  {
    id: 'jazz',
    key: 'jazz',
    submenuKey: 'jazz',
  },
  { id: 'pop', key: 'pop' },
  { id: 'taiwan', key: 'taiwan' },
];

export default function Home() {
  const reviewTrackRef = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useSiteLanguage();
  const text = copy[language];
  const [records, setRecords] = useState<VinylRecord[]>(initialRecords);
  const [selected, setSelected] = useState('home');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details' | 'review' | 'confirmed'>('cart');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [checkoutKey, setCheckoutKey] = useState('');
  const [customer, setCustomer] = useState({ name:'', email:'', phone:'', address:'', note:'', privacyConsent:false });
  const [confirmation, setConfirmation] = useState<{order_number:string;payment_deadline:string;subtotal_twd:number;bank:string;account:string;note:string} | null>(null);
  const selectedNav =
    navigation.find((item) => item.id === selected) ?? navigation[0];
  const selectedNavLabel = text.nav[selectedNav.key as keyof typeof text.nav];
  const selectedNavSubtitle =
    text.navSub[selectedNav.key as keyof typeof text.navSub];
  const collectionTitle =
    selected === 'home' ? text.nav.newArrivals : selectedNavLabel;
  const collectionSubtitle =
    selected === 'home' ? text.navSub.newArrivals : selectedNavSubtitle;
  const hasAlphabet = selected === 'classical' || selected === 'jazz';
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const selectedCategoryRecords = records.filter((record) =>
    selected === 'home' || selected === 'new-arrivals'
      ? record.newArrival && isCurrentMonth(record.createdAt, now)
      : selected === 'special-prices'
        ? isSpecialPrice(record)
        : record.category === selected,
  );
  const availableLetters = new Set(
    selectedCategoryRecords.flatMap((record) => record.indexLetters),
  );
  const filteredRecords = records.filter((record) => {
    const matchesCollection =
      selected === 'home' || selected === 'new-arrivals'
        ? record.newArrival && isCurrentMonth(record.createdAt, now)
        : selected === 'special-prices'
          ? isSpecialPrice(record)
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

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('utopia-vinyl-cart') ?? '[]') as unknown;
      if (Array.isArray(stored)) setCartIds(stored.filter((id): id is string => typeof id === 'string'));
    } catch {
      setCartIds([]);
    } finally {
      setCartReady(true);
    }
  }, []);

  useEffect(() => {
    if (cartReady) window.localStorage.setItem('utopia-vinyl-cart', JSON.stringify(cartIds));
  }, [cartIds, cartReady]);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const nextMonth = now
    ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
    : null;
  const remaining = nextMonth && now ? Math.max(0, nextMonth.getTime() - now.getTime()) : 0;
  const countdown = {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining / 3_600_000) % 24),
    minutes: Math.floor((remaining / 60_000) % 60),
  };
  const cartRecords = cartIds.flatMap((id) => {
    const record = records.find((item) => item.id === id);
    return record ? [record] : [];
  });
  const cartSubtotal = cartRecords.reduce((sum, record) => {
    const price = Number(record.price.replace(/[^0-9.]/g, ''));
    return sum + (Number.isFinite(price) ? price : 0);
  }, 0);

  function selectCollection(id: string) {
    setSelected(id);
    setSelectedLetter(null);
    if (id === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document
        .querySelector('.collection-heading')
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function beginCheckout() {
    setCheckoutMessage('');
    setCheckoutKey(crypto.randomUUID());
    setCheckoutStep('details');
  }

  async function placeOrder() {
    setCheckoutBusy(true);
    setCheckoutMessage('');
    try {
      const response = await fetch('/api/orders', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ recordIds:cartIds, idempotencyKey:checkoutKey, customer }),
      });
      const result = await response.json() as {message?:string;order?:{order_number:string;payment_deadline:string;subtotal_twd:number};paymentInstructions?:{bank:string;account:string;note:string}};
      if (!response.ok || !result.order || !result.paymentInstructions) throw new Error(result.message || '暫時無法建立訂單。');
      setConfirmation({...result.order, ...result.paymentInstructions});
      setCartIds([]);
      setCheckoutStep('confirmed');
      void fetch('/api/records').then(async (res) => await res.json() as {records?:VinylRecord[]}).then((data) => { if (Array.isArray(data.records)) setRecords(data.records); });
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : '暫時無法建立訂單。');
    } finally { setCheckoutBusy(false); }
  }

  return (
    <main id="top">
      <div className="announcement">
        <p>{text.announcement}</p>
      </div>

      <header className="site-header">
        <div className="utility-row shell">
          <a className="wordmark" href="#top" aria-label={text.home.ariaHome}>
            <Image
              alt={text.home.logoAlt}
              className="brand-logo"
              height={1024}
              priority
              src="/utopia-vinyl.png"
              width={1536}
            />
          </a>

          <label className="search-box">
            <Search aria-hidden="true" />
            <span className="sr-only">{text.home.searchLabel}</span>
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={text.home.searchPlaceholder}
              type="search"
              value={searchQuery}
            />
          </label>

          <div className="header-actions">
            <span className="store-locale-status">台灣商店 · TWD · 繁體中文</span>
            <LanguageSwitcher language={language} onChange={setLanguage} />
            <Button
              aria-label={language === 'en' ? 'Favorites' : '我的收藏'}
              disabled
              size="icon"
              variant="ghost"
            >
              <Heart />
            </Button>
            <Button
              aria-label={
                language === 'en'
                  ? `Shopping cart, ${cartRecords.length} items`
                  : `購物車，目前 ${cartRecords.length} 張唱片`
              }
              className="cart-trigger"
              onClick={() => setCartOpen(true)}
              size="icon"
              variant="ghost"
            >
              <ShoppingBag />
              {cartRecords.length ? <span>{cartRecords.length}</span> : null}
            </Button>
          </div>
        </div>

        <nav className="category-nav" aria-label={text.home.mainNav}>
          <div className="category-inner shell">
            {navigation.map((item) => (
              <div className="nav-item" key={item.id}>
                <button
                  aria-current={selected === item.id ? 'page' : undefined}
                  className={item.accent ? 'accent-link' : ''}
                  onClick={() => selectCollection(item.id)}
                  type="button"
                >
                  <span>{text.nav[item.key as keyof typeof text.nav]}</span>
                  <small>
                    {text.navSub[item.key as keyof typeof text.navSub]}
                  </small>
                  {item.submenuKey ? <ChevronDown aria-hidden="true" /> : null}
                </button>
                {item.submenuKey ? (
                  <div className="nav-popover">
                    <p>
                      {
                        text.navPopover[
                          item.submenuKey as keyof typeof text.navPopover
                        ]
                      }
                    </p>
                    <div
                      className="mini-alphabet"
                      aria-label={`${text.nav[item.key as keyof typeof text.nav]} A to Z`}
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

      {selected === 'home' ? (
        <section className="landing-hero" aria-labelledby="landing-title">
          <Image
            alt="黑膠唱片在唱盤上播放"
            className="landing-hero-image"
            fill
            priority
            sizes="100vw"
            src="/coverpagevinyl-hero.jpg"
          />
          <div className="landing-hero-shade" aria-hidden="true" />
          <div className="landing-hero-inner shell">
            <div className="landing-hero-copy">
              <p className="eyebrow">{text.home.landingEyebrow}</p>
              <h1 id="landing-title">{text.home.landingTitle}</h1>
              <p className="landing-message">{text.home.landingMessage}</p>
              <a className="landing-cta" href="#about">
                {text.home.landingCta}
                <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {selected === 'home' ? (
        <section className="about-section shell" id="about">
          <div className="about-index">
            <p className="eyebrow">{text.home.aboutEyebrow}</p>
            <span>2009—2026</span>
          </div>
          <div className="about-copy">
            <h2>{text.home.aboutTitle}</h2>
            <p>{text.home.aboutBody}</p>
            <div className="about-timeline">
              {text.home.aboutTimeline.map(([year, detail], index) => (
                <article className="about-event" key={year}>
                  <span className="about-year">{year}</span>
                  <div className="about-event-copy">
                    {index === 0 ? (
                      <>
                        <Image
                          alt={text.home.aboutImageAlt}
                          className="about-history-image"
                          height={70}
                          src="/utopia-vinyl-2009.png"
                          width={238}
                        />
                        <small>{text.home.aboutImageCaption}</small>
                      </>
                    ) : null}
                    <p>{detail}</p>
                  </div>
                </article>
              ))}
            </div>
            <a className="landing-cta" href="/?collection=new-arrivals">
              {text.home.aboutCta}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      ) : (
        <>
          <section className="collection-heading shell" id="new-arrivals">
            <p className="eyebrow">{text.home.collectionEyebrow}</p>
            <div className="title-line">
              <div>
                <h1>{collectionTitle}</h1>
                <p>{collectionSubtitle}</p>
              </div>
              <span className="count-pill">
                {text.home.count(filteredRecords.length)}
              </span>
            </div>
            {selected === 'home' || selected === 'new-arrivals' ? (
              <div className="monthly-countdown" aria-label="距離下個月新到唱片更新時間">
                <span>每月更新・本月新到倒數</span>
                <div><strong>{countdown.days}</strong><small>天</small></div>
                <i aria-hidden="true">:</i>
                <div><strong>{String(countdown.hours).padStart(2, '0')}</strong><small>時</small></div>
                <i aria-hidden="true">:</i>
                <div><strong>{String(countdown.minutes).padStart(2, '0')}</strong><small>分</small></div>
              </div>
            ) : null}
          </section>

          <div className="catalog shell">
            <aside className="filters" aria-label="唱片篩選">
              <div className="filter-title">
                <span>{text.home.browse}</span>
                <SlidersHorizontal aria-hidden="true" />
              </div>
              <div className="filter-group">
                <h2>{text.home.category}</h2>
                {navigation
                  .filter((item) => item.id !== 'home')
                  .map((item) => (
                    <button
                      aria-pressed={selected === item.id}
                      key={item.id}
                      onClick={() => selectCollection(item.id)}
                      type="button"
                    >
                      {item.id === 'classical'
                        ? text.home.classicalMusic
                        : item.id === 'jazz'
                          ? text.home.jazzMusic
                          : text.nav[item.key as keyof typeof text.nav]}{' '}
                      <span>
                        {item.id === 'new-arrivals'
                          ? records.filter((record) => record.newArrival && isCurrentMonth(record.createdAt, now)).length
                          : item.id === 'special-prices'
                            ? records.filter(isSpecialPrice).length
                            : records.filter(
                                (record) => record.category === item.id,
                              ).length}
                      </span>
                    </button>
                  ))}
              </div>
              <div className="filter-group">
                <h2>{text.home.nameIndex}</h2>
                <p>{text.home.indexDescription}</p>
                <div className="alphabet" aria-label={text.home.indexAria}>
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
                <p>{text.home.results(filteredRecords.length)}</p>
                <button disabled type="button">
                  {text.home.sort} <ChevronDown aria-hidden="true" />
                </button>
              </div>

              {filteredRecords.length ? (
                <div className="product-grid">
                  {filteredRecords.map((record) => (
                    <article className="record-card" key={record.id}>
                      <Link
                        aria-label={text.home.viewDetails(record.title)}
                        className="record-card-link"
                        href={`/records/${record.id}`}
                        onClick={(event) => {
                          if (
                            event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          ) {
                            return;
                          }

                          event.preventDefault();
                          window.location.assign(`/records/${record.id}`);
                        }}
                      >
                        <div className="record-cover">
                          <Image
                            alt={text.home.coverAlt(record.title)}
                            height={1254}
                            sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 36vw"
                            src={record.image}
                            width={1254}
                          />
                          {record.newArrival ? (
                            <span>{text.home.newBadge}</span>
                          ) : null}
                        </div>
                        <div className="record-details">
                          <p className="record-composer">{record.composers}</p>
                          <h2>{record.title}</h2>
                          <p className="record-performers">
                            {record.performers}
                          </p>
                          <dl>
                            <div>
                              <dt>{text.home.label}</dt>
                              <dd>{record.label}</dd>
                            </div>
                            <div>
                              <dt>{text.home.catalogNumber}</dt>
                              <dd>{record.catalogNumber}</dd>
                            </div>
                          </dl>
                          <div className="record-status">
                            <strong>{formatStorePrice(record.price)}</strong>
                            <span>{record.condition} · 庫存 1</span>
                          </div>
                        </div>
                      </Link>
                      <button
                        className="add-to-cart"
                        disabled={cartIds.includes(record.id) || !/[0-9]/.test(record.price)}
                        onClick={() => {
                          setCartIds((current) => current.includes(record.id) ? current : [...current, record.id]);
                          setCartOpen(true);
                        }}
                        type="button"
                      >
                        {cartIds.includes(record.id)
                          ? language === 'en' ? 'In cart' : '已加入購物車'
                          : language === 'en' ? 'Add to cart' : '加入購物車'}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-catalog">
                  <div className="record-icon" aria-hidden="true">
                    <Disc3 />
                  </div>
                  <p className="eyebrow">{text.home.emptyEyebrow}</p>
                  <h2 id="empty-title">
                    {normalizedSearch
                      ? text.home.noSearch(searchQuery.trim())
                      : selectedLetter
                        ? text.home.noLetter(selectedLetter)
                        : text.home.emptyTitle}
                  </h2>
                  <p>
                    {normalizedSearch
                      ? text.home.searchHint
                      : text.home.emptyHint(selectedNavLabel)}
                  </p>
                  <Button className="notify-button" disabled>
                    {text.home.emptyButton(selectedNavLabel)}
                  </Button>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {selected === 'home' ? (
        <section className="reviews-section" aria-labelledby="reviews-title">
          <div className="shell">
            <div className="reviews-heading">
              <div>
                <p className="eyebrow">{text.home.reviewsEyebrow}</p>
                <h2 id="reviews-title">{text.home.reviewsTitle}</h2>
              </div>
              <p>{text.home.reviewsIntro}</p>
            </div>
            <div className="review-carousel-controls" aria-label="評論輪播控制">
              <button
                aria-label="上一則評論"
                onClick={() =>
                  reviewTrackRef.current?.scrollBy({ left: -360, behavior: 'smooth' })
                }
                type="button"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                aria-label="下一則評論"
                onClick={() =>
                  reviewTrackRef.current?.scrollBy({ left: 360, behavior: 'smooth' })
                }
                type="button"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
            <div className="review-grid" ref={reviewTrackRef}>
              {text.home.reviews.map(([quote, author]) => (
                <figure className="review-card" key={author}>
                  <blockquote>{quote}</blockquote>
                  <figcaption>
                    <span className="review-stars" aria-label={text.home.stars}>
                      ★★★★★
                    </span>
                    <cite>{author}</cite>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {cartOpen ? (
        <div className="cart-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <aside aria-label={language === 'en' ? 'Shopping cart' : '購物車'} aria-modal="true" className="cart-drawer" role="dialog">
            <header><div><span>{language === 'en' ? 'Your selection' : '您的選擇'}</span><h2>{language === 'en' ? 'Shopping cart' : '購物車'}</h2></div><button aria-label={language === 'en' ? 'Close cart' : '關閉購物車'} onClick={() => setCartOpen(false)} type="button"><X aria-hidden="true" /></button></header>
            {checkoutStep === 'cart' && cartRecords.length ? (
              <div className="cart-items">{cartRecords.map((record) => <article key={record.id}><div className="cart-cover"><Image alt={`${record.title} 封面`} fill sizes="76px" src={record.image} /></div><div><small>{record.composers}</small><strong>{record.title}</strong><span>{formatStorePrice(record.price)}</span></div><button aria-label={`${language === 'en' ? 'Remove' : '移除'} ${record.title}`} onClick={() => setCartIds((current) => current.filter((id) => id !== record.id))} type="button"><X aria-hidden="true" /></button></article>)}</div>
            ) : checkoutStep === 'details' ? (
              <form className="checkout-form" onSubmit={(event) => { event.preventDefault(); setCheckoutMessage(''); setCheckoutStep('review'); }}>
                <h3>聯絡與寄送資料</h3>
                <label>姓名<input required value={customer.name} onChange={(event) => setCustomer({...customer,name:event.target.value})} /></label>
                <label>電子郵件<input required type="email" value={customer.email} onChange={(event) => setCustomer({...customer,email:event.target.value})} /></label>
                <label>電話<input required value={customer.phone} onChange={(event) => setCustomer({...customer,phone:event.target.value})} /></label>
                <label>完整寄送地址<textarea required rows={4} value={customer.address} onChange={(event) => setCustomer({...customer,address:event.target.value})} /></label>
                <label>訂單備註（選填）<textarea rows={2} value={customer.note} onChange={(event) => setCustomer({...customer,note:event.target.value})} /></label>
                <label className="privacy-check"><input required type="checkbox" checked={customer.privacyConsent} onChange={(event) => setCustomer({...customer,privacyConsent:event.target.checked})} /> 我同意僅為處理本訂單而蒐集以上資料。</label>
                <div className="checkout-actions"><button type="button" onClick={() => setCheckoutStep('cart')}>返回</button><button type="submit">檢查訂單</button></div>
              </form>
            ) : checkoutStep === 'review' ? (
              <div className="checkout-review"><h3>確認訂單</h3><p>{customer.name} · {customer.phone}</p><p>{customer.address}</p><ul>{cartRecords.map((record) => <li key={record.id}><span>{record.title}</span><strong>{formatStorePrice(record.price)}</strong></li>)}</ul><div><span>總計</span><strong>NT$ {cartSubtotal.toLocaleString('en-US')}</strong></div>{checkoutMessage ? <p className="checkout-error">{checkoutMessage}</p> : null}<div className="checkout-actions"><button type="button" onClick={() => setCheckoutStep('details')}>修改資料</button><button disabled={checkoutBusy} onClick={() => void placeOrder()} type="button">{checkoutBusy ? '建立訂單中…' : '送出訂單並保留唱片'}</button></div><small>送出後保留 48 小時。所有唱片會一次保留；若其中一張已無法購買，整筆訂單不會成立。</small></div>
            ) : checkoutStep === 'confirmed' && confirmation ? (
              <div className="order-confirmation"><span>訂單已建立（測試模式）</span><h3>{confirmation.order_number}</h3><p>請於 {new Date(confirmation.payment_deadline).toLocaleString('zh-TW')} 前完成轉帳。</p><dl><div><dt>銀行</dt><dd>{confirmation.bank}</dd></div><div><dt>帳號</dt><dd>{confirmation.account}</dd></div><div><dt>金額</dt><dd>NT$ {confirmation.subtotal_twd.toLocaleString('en-US')}</dd></div></dl><strong>{confirmation.note}</strong><button onClick={() => { setCheckoutStep('cart'); setConfirmation(null); setCartOpen(false); }} type="button">完成</button></div>
            ) : <div className="cart-empty"><ShoppingBag aria-hidden="true" /><p>{language === 'en' ? 'Your cart is empty.' : '購物車目前沒有唱片。'}</p></div>}
            {checkoutStep === 'cart' ? <footer className="cart-summary"><div><span>{language === 'en' ? 'Subtotal' : '小計'}</span><strong>NT$ {cartSubtotal.toLocaleString('en-US')}</strong></div><button disabled={!cartRecords.length} onClick={beginCheckout} type="button">{language === 'en' ? 'Checkout' : '前往結帳'}</button><small>每張唱片庫存只有 1。送出訂單後會保留 48 小時；目前使用測試銀行資料，不會收取真實款項。</small></footer> : null}
          </aside>
        </div>
      ) : null}

      <footer>
        <div className="shell footer-inner">
          <a
            className="wordmark footer-brand"
            href="#top"
            aria-label={text.home.ariaHome}
          >
            <Image
              alt={text.home.logoAlt}
              className="brand-logo footer-logo"
              height={1024}
              src="/utopia-vinyl.png"
              width={1536}
            />
          </a>
          <p>{text.home.footer}</p>
          <p className="copyright">{text.home.copyright}</p>
        </div>
      </footer>
    </main>
  );
}
