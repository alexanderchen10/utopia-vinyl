'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, LockKeyhole } from 'lucide-react';

type LoginState =
  | { type: 'idle'; message: '' }
  | { type: 'loading' | 'error'; message: string };

export default function VinylLoginPage() {
  const [state, setState] = useState<LoginState>({ type: 'idle', message: '' });

  async function login(event: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState({ type: 'loading', message: '正在登入…' });

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: data.get('email'),
          password: data.get('password'),
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || '暫時無法登入。');
      window.location.assign('/admin');
    } catch (error) {
      setState({
        type: 'error',
        message: error instanceof Error ? error.message : '暫時無法登入。',
      });
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <Link className="login-logo" href="/" aria-label="回到 Utopia Vinyl 商店">
          <Image alt="Utopia Vinyl 黑膠理想國" height={1024} priority src="/utopia-vinyl.png" width={1536} />
        </Link>
        <div className="login-lock"><LockKeyhole aria-hidden="true" /></div>
        <p className="login-eyebrow">UTOPIA VINYL 私人管理</p>
        <h1 id="login-title">登入新增唱片</h1>
        <p className="login-intro">輸入管理電子郵件和密碼，就可以開始新增唱片。</p>

        <form className="login-form" onSubmit={(event) => { void login(event); }}>
          <label htmlFor="admin-email">電子郵件</label>
          <input
            autoComplete="username"
            defaultValue="alexanderchen905@gmail.com"
            id="admin-email"
            inputMode="email"
            name="email"
            required
            type="email"
          />
          <label htmlFor="admin-password">密碼</label>
          <input
            autoComplete="current-password"
            id="admin-password"
            name="password"
            required
            type="password"
          />
          <button disabled={state.type === 'loading'} type="submit">
            {state.type === 'loading' ? <LoaderCircle aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
            {state.type === 'loading' ? '正在登入…' : '登入'}
          </button>
        </form>

        {state.type === 'error' ? <p className="login-error" role="alert">{state.message}</p> : null}
        <Link className="login-back" href="/"><ArrowLeft aria-hidden="true" /> 回到商店</Link>
      </section>
    </main>
  );
}
