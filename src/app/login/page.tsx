'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/client/supabase-browser';
import { Mascot } from '@/components/ui/Mascot';
import s from './login.module.css';

export default function LoginPage() {
  const [step, setStep] = useState<'start' | 'email' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // ошибка из /auth/callback приходит в ?error=
  const [error, setError] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('error'),
  );
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  async function google() {
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (error) {
      setBusy(false);
      setError(/not enabled|unsupported provider/i.test(error.message) ? 'Вход через Google ещё не включён в Supabase' : humanize(error.message));
    }
  }

  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setError('Проверь email');
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: em, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setError(humanize(error.message));
    setStep('code');
    setWait(45);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(value = code) {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.verifyOtp({ email: email.trim().toLowerCase(), token: value, type: 'email' });
    if (error) {
      setBusy(false);
      setCode('');
      return setError(humanize(error.message));
    }
    window.location.href = '/';
  }

  return (
    <main className={s.wrap}>
      <div className={s.hero}>
        <Mascot mood={step === 'code' ? 'wow' : 'happy'} size={120} bob />
        <div className="bubble" style={{ maxWidth: 220 }}>
          {step === 'code' ? 'Код уже в почте. Жду!' : 'Привет! Я Мик. Каждый день — на шаг яснее.'}
        </div>
      </div>
      <h1 className={s.title}>Утренняя речь</h1>
      {step === 'start' ? (
        <div className="stack">
          <button className="btn btn-lg btn-block" onClick={() => void google()} disabled={busy}>
            <GoogleIcon /> {busy ? 'Открываю Google…' : 'Войти через Google'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep('email')}>
            Войти по коду из письма
          </button>
        </div>
      ) : step === 'email' ? (
        <form className="stack" onSubmit={sendCode}>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'Отправляю…' : 'Получить код'}
          </button>
          <p className="muted small" style={{ textAlign: 'center' }}>
            Пришлём 6 цифр. Пароль не нужен.
          </p>
        </form>
      ) : (
        <div className="stack">
          <p className="muted">
            Отправили 6 цифр на <b style={{ color: 'var(--fg)' }}>{email}</b>
          </p>
          <div className={s.cells} onClick={() => codeRef.current?.focus()}>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={s.cell} data-active={i === code.length && !busy}>
                {code[i] ?? ''}
              </span>
            ))}
            <input
              ref={codeRef}
              className={s.hidden}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              aria-label="Код из письма"
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                if (v.length === 6) void verify(v);
              }}
            />
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || code.length !== 6} onClick={() => void verify()}>
            {busy ? 'Проверяю…' : 'Войти'}
          </button>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setStep('start'); setCode(''); setError(null); }}>
              Другой email
            </button>
            <button className="btn btn-ghost btn-sm" disabled={wait > 0 || busy} onClick={() => void sendCode()}>
              {wait > 0 ? `Ещё раз через ${wait}` : 'Отправить ещё раз'}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function humanize(msg: string) {
  if (/rate|too many|seconds/i.test(msg)) return 'Слишком часто. Подожди минуту и попробуй снова.';
  if (/expired|invalid|token/i.test(msg)) return 'Код не подошёл или устарел. Запроси новый.';
  if (/signups? not allowed|not allowed/i.test(msg)) return 'Для этого email вход закрыт.';
  return msg;
}
