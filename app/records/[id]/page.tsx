'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  Heart,
  Minus,
  Plus,
  Search,
  ShoppingBag,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  LanguageSwitcher,
  useSiteLanguage,
} from '@/components/site/language-switcher';
import { formatStorePrice, initialRecords, type VinylRecord } from '@/lib/catalog';
import { categoryNames, copy } from '@/lib/site-copy';

const navigation = [
  { id: 'home', key: 'home' },
  { id: 'new-arrivals', key: 'newArrivals' },
  { id: 'special-prices', key: 'specialPrices' },
  { id: 'classical', key: 'classical', submenuKey: 'classical' },
  { id: 'jazz', key: 'jazz', submenuKey: 'jazz' },
  { id: 'pop', key: 'pop' },
  { id: 'taiwan', key: 'taiwan' },
];

export default function RecordPage() {
  const [language, setLanguage] = useSiteLanguage();
  const text = copy[language];
  const params = useParams<{ id: string }>();
  const recordId = params?.id;
  const [records, setRecords] = useState<VinylRecord[]>(initialRecords);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [purchaseMessage, setPurchaseMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/records')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load records');
        return (await response.json()) as { records?: VinylRecord[] };
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.records)) setRecords(data.records);
      })
      .catch(() => {
        // The two built-in records remain available if storage cannot be reached.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const record = records.find((item) => item.id === recordId);
  const relatedRecords = useMemo(
    () =>
      records
        .filter((item) => item.id !== recordId)
        .sort(
          (a, b) =>
            Number(b.category === record?.category) -
            Number(a.category === record?.category),
        )
        .slice(0, 4),
    [record?.category, recordId, records],
  );

  return (
    <main id="top">
      <div className="announcement">
        <p>{text.announcement}</p>
      </div>

      <header className="site-header product-site-header">
        <div className="utility-row shell">
          <Link className="wordmark" href="/" aria-label={text.home.ariaHome}>
            <Image
              alt={text.home.logoAlt}
              className="brand-logo"
              height={1024}
              priority
              src="/utopia-vinyl.png"
              width={1536}
            />
          </Link>

          <form action="/" className="search-box" method="get">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="record-search">
              {text.home.searchLabel}
            </label>
            <input
              id="record-search"
              name="q"
              placeholder={text.home.searchPlaceholder}
              type="search"
            />
          </form>

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
                <Link
                  href={item.id === 'home' ? '/' : `/?collection=${item.id}`}
                >
                  <span>{text.nav[item.key as keyof typeof text.nav]}</span>
                  <small>
                    {text.navSub[item.key as keyof typeof text.navSub]}
                  </small>
                  {item.submenuKey ? <ChevronDown aria-hidden="true" /> : null}
                </Link>
              </div>
            ))}
          </div>
        </nav>
      </header>

      {record ? (
        <>
          <div
            className="product-breadcrumb shell"
            aria-label={text.detail.breadcrumb}
          >
            <Link href="/">{text.detail.home}</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/?collection=${record.category}`}>
              {categoryNames[language][record.category]}
            </Link>
            <span aria-hidden="true">/</span>
            <span>{record.title}</span>
          </div>

          <section
            className="product-detail shell"
            aria-labelledby="product-title"
          >
            <div className="product-image-stage">
              <div className="product-image-frame">
                <Image
                  alt={text.home.coverAlt(record.title)}
                  height={1254}
                  priority
                  sizes="(max-width: 760px) 100vw, 52vw"
                  src={record.image}
                  width={1254}
                />
              </div>
              <p>{text.detail.coverCaption}</p>
            </div>

            <div className="product-information">
              <div className="product-heading">
                {record.newArrival ? (
                  <span className="product-badge">{text.detail.newBadge}</span>
                ) : null}
                <p>
                  {text.detail.categoryMusic(
                    categoryNames[language][record.category],
                  )}
                </p>
                <h1 id="product-title">{record.title}</h1>
              </div>

              <div className="product-credit">
                <h2>{text.detail.composer}</h2>
                <p>{record.composers || text.detail.organizing}</p>
              </div>
              <div className="product-credit">
                <h2>{text.detail.performer}</h2>
                <p>{record.performers || text.detail.organizing}</p>
              </div>

              <dl className="product-facts">
                <div>
                  <dt>{text.detail.label}</dt>
                  <dd>{record.label || text.detail.organizing}</dd>
                </div>
                <div>
                  <dt>{text.detail.catalogNumber}</dt>
                  <dd>{record.catalogNumber || text.detail.organizing}</dd>
                </div>
                <div>
                  <dt>{text.detail.condition}</dt>
                  <dd>{record.condition}</dd>
                </div>
              </dl>

              {record.conditionNotes ? (
                <dl className="product-condition-notes">
                  <dt>{text.detail.conditionNotes}</dt>
                  <dd>{record.conditionNotes}</dd>
                </dl>
              ) : null}

              <div className="product-price-row">
                <strong>{formatStorePrice(record.price)}</strong>
                <span>{text.detail.shipping}</span>
                <span aria-hidden="true">/</span>
                <span>{text.detail.purchaseInfo}</span>
              </div>

              <div className="purchase-row">
                <div
                  className="quantity-control"
                  aria-label={text.detail.quantity}
                >
                  <button
                    aria-label={text.detail.decrease}
                    disabled={quantity === 1}
                    onClick={() =>
                      setQuantity((value) => Math.max(1, value - 1))
                    }
                    type="button"
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <output aria-live="polite">{quantity}</output>
                  <button
                    aria-label={text.detail.increase}
                    onClick={() =>
                      setQuantity((value) => Math.min(9, value + 1))
                    }
                    type="button"
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
                <button
                  className="purchase-button"
                  onClick={() =>
                    setPurchaseMessage(text.detail.purchaseMessage)
                  }
                  type="button"
                >
                  {text.detail.addToBag}
                </button>
                <button
                  aria-label={text.detail.favoriteComing}
                  className="product-heart"
                  disabled
                  type="button"
                >
                  <Heart aria-hidden="true" />
                </button>
              </div>
              {purchaseMessage ? (
                <output className="purchase-message">{purchaseMessage}</output>
              ) : null}
            </div>
          </section>

          {relatedRecords.length ? (
            <section
              className="related-products shell"
              aria-labelledby="related-title"
            >
              <div className="related-heading">
                <div>
                  <p className="eyebrow">{text.detail.relatedEyebrow}</p>
                  <h2 id="related-title">{text.detail.relatedTitle}</h2>
                </div>
                <Link href="/">
                  {text.detail.viewAll}
                  <ArrowLeft aria-hidden="true" />
                </Link>
              </div>
              <div className="related-grid">
                {relatedRecords.map((item) => (
                  <article className="related-card" key={item.id}>
                    <Link
                      href={`/records/${item.id}`}
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
                        window.location.assign(`/records/${item.id}`);
                      }}
                    >
                      <div className="related-cover">
                        <Image
                          alt={text.home.coverAlt(item.title)}
                          height={1254}
                          sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 25vw"
                          src={item.image}
                          width={1254}
                        />
                      </div>
                      <p>{item.composers}</p>
                      <h3>{item.title}</h3>
                      <span>{item.price}</span>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="product-state shell" aria-live="polite">
          {loading ? (
            <>
              <p className="eyebrow">{text.detail.loadingEyebrow}</p>
              <h1>{text.detail.loadingTitle}</h1>
            </>
          ) : (
            <>
              <p className="eyebrow">{text.detail.missingEyebrow}</p>
              <h1>{text.detail.missingTitle}</h1>
              <p>{text.detail.missingHint}</p>
              <Link href="/">{text.detail.returnAll}</Link>
            </>
          )}
        </section>
      )}

      <footer>
        <div className="shell footer-inner">
          <Link
            className="wordmark footer-brand"
            href="/"
            aria-label={text.home.ariaHome}
          >
            <Image
              alt={text.home.logoAlt}
              className="brand-logo footer-logo"
              height={1024}
              src="/utopia-vinyl.png"
              width={1536}
            />
          </Link>
          <p>{text.home.footer}</p>
          <p className="copyright">{text.home.copyright}</p>
        </div>
      </footer>
    </main>
  );
}
