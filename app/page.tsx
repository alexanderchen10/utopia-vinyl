'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronDown,
  Disc3,
  Heart,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  LanguageSwitcher,
  useSiteLanguage,
} from '@/components/site/language-switcher';
import {
  initialRecords,
  isSpecialPrice,
  type VinylRecord,
} from '@/lib/catalog';
import { copy } from '@/lib/site-copy';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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
  const [language, setLanguage] = useSiteLanguage();
  const text = copy[language];
  const [records, setRecords] = useState<VinylRecord[]>(initialRecords);
  const [selected, setSelected] = useState('home');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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
      ? record.newArrival
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
        ? record.newArrival
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
                  ? 'Shopping bag, currently empty'
                  : '購物袋，目前沒有商品'
              }
              disabled
              size="icon"
              variant="ghost"
            >
              <ShoppingBag />
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
        <section className="landing-hero shell" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="eyebrow">{text.home.landingEyebrow}</p>
            <h1 id="landing-title">{text.home.landingTitle}</h1>
            <p className="landing-message">{text.home.landingMessage}</p>
            <a className="landing-cta" href="#about">
              {text.home.landingCta}
              <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="landing-hero-mark">
            <Image
              alt={text.home.logoAlt}
              className="landing-logo"
              height={1024}
              src="/utopia-vinyl.png"
              width={1536}
            />
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
                          ? records.filter((record) => record.newArrival).length
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
            <div className="review-grid">
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
