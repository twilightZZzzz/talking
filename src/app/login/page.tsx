'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/client/supabase-browser';
import { Mascot } from '@/components/ui/Mascot';
import s from './login.module.css';

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

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
          {step === 'email' ? 'Привет! Я Мик. Каждый день — на шаг яснее.' : 'Код уже в почте. Жду!'}
        </div>
      </div>
      <h1 className={s.title}>Утренняя речь</h1>
      {step === 'email' ? (
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
            <button className="btn btn-ghost btn-sm" onClick={() => { setStep('email'); setCode(''); setError(null); }}>
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

function humanize(msg: string) {
  if (/rate|too many|seconds/i.test(msg)) return 'Слишком часто. Подожди минуту и попробуй снова.';
  if (/expired|invalid|token/i.test(msg)) return 'Код не подошёл или устарел. Запроси новый.';
  if (/signups? not allowed|not allowed/i.test(msg)) return 'Для этого email вход закрыт.';
  return msg;
}
