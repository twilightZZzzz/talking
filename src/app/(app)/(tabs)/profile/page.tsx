'use client';

import { useState } from 'react';
import { useApp } from '@/client/store';
import { supabaseBrowser } from '@/client/supabase-browser';
import type { Mode, ProblemCode, Theme } from '@/domain/types';
import { PROBLEMS } from '@/domain/problems/catalog';
import { Mascot } from '@/components/ui/Mascot';
import { Icon } from '@/components/ui/Icon';

const GOALS = [5, 10, 15, 20, 30, 45, 60, 90];

export default function ProfilePage() {
  const { state, patchProfile, toast, reload, syncStatus } = useApp();
  const p = state.profile;
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<null | Record<string, number | boolean>>(null);
  const [busy, setBusy] = useState(false);

  function toggleProblem(c: ProblemCode) {
    const set = new Set(p.self_problems);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    patchProfile({ self_problems: [...set] });
  }

  async function runImport(dryRun: boolean) {
    setBusy(true);
    try {
      const r = await fetch('/api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code.trim(), dryRun }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Не удалось импортировать');
      if (dryRun) setPreview(j);
      else {
        setPreview(null);
        setCode('');
        toast(`Импортировано дней: ${j.newDays}`, 'mint');
        await reload();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ошибка импорта');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (syncStatus === 'pending' || syncStatus === 'offline') {
      if (!confirm('Есть несохранённые на сервере изменения. Всё равно выйти?')) return;
    }
    await supabaseBrowser().auth.signOut();
    try {
      localStorage.removeItem('rech-state-v2');
      localStorage.removeItem('rech-queue-v2');
    } catch {}
    window.location.href = '/login';
  }

  return (
    <>
      <header className="row" style={{ flexWrap: 'nowrap' }}>
        <Mascot mood="happy" size={64} />
        <div>
          <h1>Профиль</h1>
          <p className="muted small">{state.email}</p>
        </div>
      </header>

      <section className="card">
        <h2>Цель дня</h2>
        <p className="small muted">Сколько минут практики в день считать «выполнено». Это не потолок — больше можно всегда.</p>
        <div className="row" style={{ gap: 6 }}>
          {GOALS.map((g) => (
            <button key={g} className={`btn btn-sm ${p.daily_goal_min === g ? 'btn-sun' : ''}`} onClick={() => patchProfile({ daily_goal_min: g })}>
              {g} мин
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Режим по умолчанию</h2>
        <div className="seg">
          {(
            [
              ['full', 'Утро · 15 мин'],
              ['exp', 'Экспресс · 7 мин'],
            ] as [Mode, string][]
          ).map(([m, l]) => (
            <button key={m} aria-pressed={p.default_mode === m} onClick={() => patchProfile({ default_mode: m })}>
              {l}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Тема оформления</h2>
        <div className="seg">
          {(
            [
              ['system', 'Как в системе'],
              ['light', 'Светлая'],
              ['dark', 'Тёмная'],
            ] as [Theme, string][]
          ).map(([t, l]) => (
            <button key={t} aria-pressed={p.theme === t} onClick={() => patchProfile({ theme: t })}>
              {l}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Что мне мешает</h2>
        <p className="small muted">Твоя самооценка — стартовая точка. Дальше профиль уточняют разборы дублей.</p>
        <div className="row" style={{ gap: 6 }}>
          {PROBLEMS.map((pr) => {
            const on = p.self_problems.includes(pr.code);
            return (
              <button key={pr.code} className={`chip ${on ? 'chip-lilac' : ''}`} style={{ cursor: 'pointer' }} aria-pressed={on} onClick={() => toggleProblem(pr.code)}>
                {on ? '✓ ' : ''}
                {pr.title}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Часовой пояс</h2>
        <p className="small muted">По нему считается, когда начинается новый день.</p>
        <select className="input" value={p.timezone} onChange={(e) => patchProfile({ timezone: e.target.value })}>
          {TZ.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>ИИ-разбор</h2>
        <div className="row">
          <span className={`chip ${state.aiStatus.transcription === 'mock' ? 'chip-sun' : 'chip-mint'}`}>
            Распознавание: {state.aiStatus.transcription === 'groq' ? 'Groq Whisper' : 'демо'}
          </span>
          <span className={`chip ${state.aiStatus.llm === 'mock' ? 'chip-sun' : 'chip-mint'}`}>
            Тренер: {state.aiStatus.llm === 'anthropic' ? 'Claude' : state.aiStatus.llm === 'groq' ? 'Groq' : 'демо'}
          </span>
        </div>
        {(state.aiStatus.llm === 'mock' || state.aiStatus.transcription === 'mock') && (
          <p className="small muted">
            Демо-режим: без ключей разбор строится на примере. Добавь <code>GROQ_API_KEY</code> (и при желании <code>ANTHROPIC_API_KEY</code>) в <code>.env.local</code> и перезапусти сервер.
          </p>
        )}
      </section>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Импорт из старой версии</summary>
        <p className="small muted">Открой старую страницу → «Перенос прогресса» → «Скопировать код прогресса» и вставь сюда.</p>
        <textarea className="input" style={{ fontFamily: 'monospace', fontSize: 12 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код прогресса" />
        {preview && (
          <div className="card card-flat" style={{ background: 'var(--sky-soft)' }}>
            <b>Будет импортировано</b>
            <span className="small">
              Новых дней: {String(preview.newDays)} · уже есть: {String(preview.existingDays)} · достижений: {String(preview.achievements)} · отмеченных шагов: {String(preview.steps)}
            </span>
          </div>
        )}
        <div className="row">
          <button className="btn btn-sm" disabled={!code.trim() || busy} onClick={() => void runImport(true)}>
            Проверить
          </button>
          <button className="btn btn-sm btn-primary" disabled={!preview || busy} onClick={() => void runImport(false)}>
            Импортировать
          </button>
        </div>
      </details>

      <section className="card">
        <h2>Данные</h2>
        <div className="row">
          <a className="btn btn-sm" href="/api/export" download>
            <Icon name="download" size={16} /> Экспорт в JSON
          </a>
          <button className="btn btn-sm btn-berry" onClick={() => void logout()}>
            <Icon name="logout" size={16} /> Выйти
          </button>
        </div>
      </section>
    </>
  );
}

const TZ = [
  'Europe/Kaliningrad',
  'Europe/Moscow',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Novosibirsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Asia/Magadan',
  'Asia/Kamchatka',
  'Europe/Minsk',
  'Europe/Kyiv',
  'Asia/Almaty',
  'Asia/Tbilisi',
  'Asia/Dubai',
  'Europe/Istanbul',
  'Europe/Berlin',
  'Europe/London',
  'Asia/Bangkok',
  'America/New_York',
];
