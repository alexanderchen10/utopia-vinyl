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
  categoryLabels,
  initialRecords,
  type VinylRecord,
} from '@/lib/catalog';

const navigation = [
  { id: 'new-arrivals', label: '新到唱片', subtitle: '最新入庫' },
  { id: 'classical', label: '古典', subtitle: '按作曲家索引', submenu: true },
  { id: 'jazz', label: '爵士', subtitle: '按演奏家／樂團索引', submenu: true },
  { id: 'pop', label: '流行', subtitle: '流行音樂' },
  { id: 'taiwan', label: '臺灣黑膠', subtitle: '臺灣之聲' },
];

export default function RecordPage() {
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
        <p>滿 NT$2,000 享免運・黑膠唱片專門店</p>
      </div>

      <header className="site-header product-site-header">
        <div className="utility-row shell">
          <Link className="wordmark" href="/" aria-label="Utopia Vinyl 首頁">
            <Image
              alt="Utopia Vinyl 黑膠理想國"
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
              搜尋唱片
            </label>
            <input
              id="record-search"
              name="q"
              placeholder="搜尋作曲家、演奏家或樂團"
              type="search"
            />
          </form>

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
          className="category-nav"
          aria-label="主要分類"
        >
          <div className="category-inner shell">
            {navigation.map((item) => (
              <div className="nav-item" key={item.id}>
                <Link href={`/?collection=${item.id}`}>
                  <span>{item.label}</span>
                  <small>{item.subtitle}</small>
                  {item.submenu ? <ChevronDown aria-hidden="true" /> : null}
                </Link>
              </div>
            ))}
          </div>
        </nav>
      </header>

      {record ? (
        <>
          <div className="product-breadcrumb shell" aria-label="麵包屑導覽">
            <Link href="/">首頁</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/?collection=${record.category}`}>
              {categoryLabels[record.category]}
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
                  alt={`${record.title} 唱片封面`}
                  height={1254}
                  priority
                  sizes="(max-width: 760px) 100vw, 52vw"
                  src={record.image}
                  width={1254}
                />
              </div>
              <p>唱片封面實拍</p>
            </div>

            <div className="product-information">
              <div className="product-heading">
                {record.newArrival ? (
                  <span className="product-badge">新到唱片</span>
                ) : null}
                <p>{categoryLabels[record.category]}音樂</p>
                <h1 id="product-title">{record.title}</h1>
              </div>

              <div className="product-credit">
                <h2>作曲家</h2>
                <p>{record.composers || '資料整理中'}</p>
              </div>
              <div className="product-credit">
                <h2>演奏家／樂團</h2>
                <p>{record.performers || '資料整理中'}</p>
              </div>

              <dl className="product-facts">
                <div>
                  <dt>唱片公司</dt>
                  <dd>{record.label || '資料整理中'}</dd>
                </div>
                <div>
                  <dt>唱片編號</dt>
                  <dd>{record.catalogNumber || '資料整理中'}</dd>
                </div>
                <div>
                  <dt>唱片品相</dt>
                  <dd>{record.condition}</dd>
                </div>
              </dl>

              <div className="product-price-row">
                <strong>{record.price}</strong>
                <span>運送資訊</span>
                <span aria-hidden="true">/</span>
                <span>購買說明</span>
              </div>

              <div className="purchase-row">
                <div className="quantity-control" aria-label="選擇數量">
                  <button
                    aria-label="減少數量"
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
                    aria-label="增加數量"
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
                    setPurchaseMessage(
                      '線上購物功能正在準備中，之後會在這裡開放購買。',
                    )
                  }
                  type="button"
                >
                  加入購物袋
                </button>
                <button
                  aria-label="收藏功能即將推出"
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
                  <p className="eyebrow">更多收藏</p>
                  <h2 id="related-title">你可能也喜歡</h2>
                </div>
                <Link href="/">
                  查看全部唱片
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
                          alt={`${item.title} 唱片封面`}
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
              <p className="eyebrow">正在尋找唱片</p>
              <h1>唱片資料載入中</h1>
            </>
          ) : (
            <>
              <p className="eyebrow">找不到唱片</p>
              <h1>這張唱片目前不在架上</h1>
              <p>它可能已經下架，或網址已經變更。</p>
              <Link href="/">返回全部唱片</Link>
            </>
          )}
        </section>
      )}

      <footer>
        <div className="shell footer-inner">
          <Link
            className="wordmark footer-brand"
            href="/"
            aria-label="Utopia Vinyl 首頁"
          >
            <Image
              alt="Utopia Vinyl 黑膠理想國"
              className="brand-logo footer-logo"
              height={1024}
              src="/utopia-vinyl.png"
              width={1536}
            />
          </Link>
          <p>自 2009 年起，為愛樂人收藏每一種聲音。</p>
          <p className="copyright">© 2026 Utopia Vinyl・版權所有</p>
        </div>
      </footer>
    </main>
  );
}
