'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Activity, AppState, CoachPlan, ISODate, Profile, Session, TakeSummary } from '@/domain/types';
import type { SyncOp, SyncResponse } from '@/domain/sync';
import { dailyContent, trainingDate } from '@/domain/calendar';
import { computeStats, type Stats } from '@/domain/gamification/calc';
import { checkAchievements, ACHIEVEMENTS } from '@/domain/gamification/achievements';
import { levelFor } from '@/domain/gamification/levels';
import { buildProfile } from '@/domain/problems/events';
import { CONTENT_VERSION } from '@/domain/content';
import type { ProblemProfile } from '@/domain/types';

const CACHE_KEY = 'rech-state-v2';
const QUEUE_KEY = 'rech-queue-v2';

type QueuedOp = SyncOp & { op_id: string };
export type ToastKind = 'ink' | 'sun' | 'mint';
interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}
export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error';

const ls = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
  del(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

function blankSession(date: ISODate, profile: Profile, pp: ProblemProfile | null): Session {
  const c = dailyContent(date, { profileScores: pp?.scores });
  return {
    date,
    mode: profile.default_mode,
    topic_id: c.topic_id,
    custom_topic: null,
    frame_id: c.frame_id,
    challenge_id: c.challenge_id,
    twister_id: c.twister_id,
    content_version: CONTENT_VERSION,
    steps_done: [],
    breath: null,
    fillers: null,
    clarity: null,
    challenge_done: null,
    note: null,
    saved_at: null,
    saved_hour: null,
    full: false,
  };
}

interface Ctx {
  state: AppState;
  today: ISODate;
  session: Session;
  stats: Stats;
  problems: ProblemProfile;
  syncStatus: SyncStatus;
  toasts: Toast[];
  toast: (text: string, kind?: ToastKind) => void;
  patchSession: (fields: Partial<Omit<Session, 'date'>>, date?: ISODate) => void;
  patchProfile: (fields: Partial<Omit<Profile, 'user_id'>>) => void;
  addActivity: (a: Omit<Activity, 'id' | 'created_at' | 'date'> & { id?: string; date?: ISODate }) => Activity;
  removeActivity: (id: string) => void;
  toggleStep: (i: number) => void;
  upsertTake: (t: TakeSummary) => void;
  setPlan: (p: CoachPlan) => void;
  markPlanDone: (itemId: string) => void;
  reload: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp вне AppProvider');
  return c;
}

const STEP_MIN = [3, 2, 5, 3, 2];

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => new Date());
  const queue = useRef<QueuedOp[]>([]);
  const flushing = useRef(false);
  const toastId = useRef(0);
  const announced = useRef<Set<string>>(new Set());

  const toast = useCallback((text: string, kind: ToastKind = 'ink') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ---------- загрузка ----------
  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (r.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Не удалось загрузить данные');
      const s = (await r.json()) as AppState;
      // применяем неотправленные операции поверх серверного состояния
      const merged = queue.current.reduce(applyOp, s);
      setState(merged);
      ls.set(CACHE_KEY, s);
      setLoadError(null);
    } catch (e) {
      const cached = ls.get<AppState>(CACHE_KEY);
      if (cached) {
        setState((cur) => cur ?? queue.current.reduce(applyOp, cached));
        setSyncStatus('offline');
      } else setLoadError(e instanceof Error ? e.message : 'Нет связи');
    }
  }, []);

  // ---------- синхронизация ----------
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const flush = useCallback(async () => {
    if (flushing.current || !queue.current.length) {
      if (!queue.current.length) setSyncStatus('synced');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    flushing.current = true;
    setSyncStatus('pending');
    const batch = queue.current.slice(0, 100);
    try {
      const r = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ops: batch }),
      });
      if (r.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!r.ok) throw new Error('sync');
      const res = (await r.json()) as SyncResponse;
      const done = new Set([...res.applied, ...res.failed.map((f) => f.op_id)]);
      queue.current = queue.current.filter((o) => !done.has(o.op_id));
      ls.set(QUEUE_KEY, queue.current);
      setSyncStatus(res.failed.length ? 'error' : queue.current.length ? 'pending' : 'synced');
      if (res.failed.length) console.warn('sync failed', res.failed);
    } catch {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      flushing.current = false;
    }
    if (queue.current.length && navigator.onLine) setTimeout(() => void flushRef.current(), 1500);
  }, []);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    queue.current = ls.get<QueuedOp[]>(QUEUE_KEY) ?? [];
    const cached = ls.get<AppState>(CACHE_KEY);
    if (cached) setState(queue.current.reduce(applyOp, cached));
    void reload().then(() => flush());
    const onFocus = () => {
      setNow(new Date());
      void flush();
    };
    const onOnline = () => void flush();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', onOnline);
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', onOnline);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enqueue = useCallback(
    (op: SyncOp) => {
      const q: QueuedOp = { ...op, op_id: uuid() } as QueuedOp;
      queue.current = [...queue.current, q];
      ls.set(QUEUE_KEY, queue.current);
      setState((s) => (s ? applyOp(s, q) : s));
      setSyncStatus('pending');
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void flush(), 400);
    },
    [flush],
  );

  // ---------- производные ----------
  const tz = state?.profile.timezone ?? 'Asia/Yekaterinburg';
  const today = trainingDate(now, tz);
  const problems = useMemo(
    () =>
      state
        ? buildProfile(state.problemEvents, state.profile.self_problems, now)
        : { scores: [], topFillers: [], takesAnalyzed: 0 },
    [state, now],
  );
  const session = useMemo(() => {
    if (!state) return null;
    return state.sessions.find((s) => s.date === today) ?? blankSession(today, state.profile, problems);
  }, [state, today, problems]);
  const stats = useMemo(
    () =>
      state
        ? computeStats({
            sessions: state.sessions,
            activities: state.activities,
            takes: state.takes,
            today,
            dailyGoalMin: state.profile.daily_goal_min,
          })
        : null,
    [state, today],
  );

  // достижения: открываем новые и поздравляем
  useEffect(() => {
    if (!state || !stats) return;
    const have = new Set(state.achievements.map((a) => a.code));
    const got = checkAchievements(stats, { sessions: state.sessions, activities: state.activities, takes: state.takes, today, dailyGoalMin: state.profile.daily_goal_min });
    const fresh = got.filter((c) => !have.has(c) && !announced.current.has(c));
    if (!fresh.length) return;
    fresh.forEach((code, i) => {
      announced.current.add(code);
      const a = ACHIEVEMENTS.find((x) => x.id === code);
      setTimeout(() => toast(`Достижение: ${a?.title ?? code}`, 'sun'), 600 + i * 900);
      enqueue({ op: 'achievement.unlock', code, unlocked_at: new Date().toISOString() });
    });
  }, [state, stats, today, toast, enqueue]);

  // уровень: поздравление при росте
  const prevLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!stats) return;
    const lv = levelFor(stats.xp).index;
    if (prevLevel.current !== null && lv > prevLevel.current) toast(`Новый уровень: ${levelFor(stats.xp).name}!`, 'sun');
    prevLevel.current = lv;
  }, [stats, toast]);

  // ---------- действия ----------
  const patchSession = useCallback(
    (fields: Partial<Omit<Session, 'date'>>, date?: ISODate) => {
      const d = date ?? today;
      // первая запись дня фиксирует задание дня
      const exists = state?.sessions.some((s) => s.date === d);
      const base = !exists && session && d === today ? { ...session, date: undefined } : {};
      const { date: _omit, ...rest } = base as Partial<Session>;
      void _omit;
      enqueue({ op: 'session.patch', date: d, fields: { ...rest, ...fields } });
    },
    [enqueue, today, state, session],
  );

  const patchProfile = useCallback((fields: Partial<Omit<Profile, 'user_id'>>) => enqueue({ op: 'profile.patch', fields }), [enqueue]);

  const addActivity = useCallback<Ctx['addActivity']>(
    (a) => {
      const act: Activity = { ...a, meta: a.meta ?? {}, id: a.id ?? uuid(), date: a.date ?? today, created_at: new Date().toISOString() } as Activity;
      enqueue({ op: 'activity.upsert', activity: act });
      return act;
    },
    [enqueue, today],
  );

  const removeActivity = useCallback((id: string) => enqueue({ op: 'activity.delete', id }), [enqueue]);

  const toggleStep = useCallback(
    (i: number) => {
      if (!state || !session) return;
      const done = session.steps_done.includes(i);
      const steps = done ? session.steps_done.filter((x) => x !== i) : [...session.steps_done, i].sort();
      patchSession({ steps_done: steps });
      const existing = state.activities.find((a) => a.kind === 'ritual_step' && a.date === today && a.ref === String(i));
      if (done && existing) removeActivity(existing.id);
      if (!done && !existing) {
        addActivity({ kind: 'ritual_step', ref: String(i), duration_s: STEP_MIN[i] * 60, meta: {} });
        toast('+10 XP', 'mint');
      }
    },
    [state, session, today, patchSession, addActivity, removeActivity, toast],
  );

  const upsertTake = useCallback((t: TakeSummary) => {
    setState((s) => (s ? { ...s, takes: [t, ...s.takes.filter((x) => x.id !== t.id)] } : s));
  }, []);

  const setPlan = useCallback((p: CoachPlan) => setState((s) => (s ? { ...s, plan: p } : s)), []);
  const markPlanDone = useCallback(
    (itemId: string) => {
      if (!state?.plan) return;
      enqueue({ op: 'plan.done', plan_id: state.plan.id, item_id: itemId });
    },
    [enqueue, state],
  );

  if (!state || !session || !stats) {
    if (loadError)
      return (
        <div style={{ padding: 24, display: 'grid', gap: 12, maxWidth: 420, margin: '15vh auto', textAlign: 'center' }}>
          <h2>Не получилось загрузить</h2>
          <p className="muted">{loadError}</p>
          <button className="btn btn-primary" onClick={() => void reload()}>
            Повторить
          </button>
        </div>
      );
    return <>{fallback}</>;
  }

  const value: Ctx = {
    state,
    today,
    session,
    stats,
    problems,
    syncStatus,
    toasts,
    toast,
    patchSession,
    patchProfile,
    addActivity,
    removeActivity,
    toggleStep,
    upsertTake,
    setPlan,
    markPlanDone,
    reload,
  };
  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'sun' ? 'toast-sun' : t.kind === 'mint' ? 'toast-mint' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}

/** Оптимистичное применение операции к локальному состоянию (зеркало /api/sync) */
function applyOp(s: AppState, o: SyncOp): AppState {
  switch (o.op) {
    case 'profile.patch':
      return { ...s, profile: { ...s.profile, ...o.fields } };
    case 'session.patch': {
      const cur = s.sessions.find((x) => x.date === o.date);
      const next = cur ? { ...cur, ...o.fields } : ({ ...emptySession(o.date, s.profile), ...o.fields } as Session);
      return { ...s, sessions: [...s.sessions.filter((x) => x.date !== o.date), next] };
    }
    case 'activity.upsert':
      return { ...s, activities: [...s.activities.filter((a) => a.id !== o.activity.id), o.activity] };
    case 'activity.delete':
      return { ...s, activities: s.activities.filter((a) => a.id !== o.id) };
    case 'achievement.unlock':
      return s.achievements.some((a) => a.code === o.code)
        ? s
        : { ...s, achievements: [...s.achievements, { code: o.code, unlocked_at: o.unlocked_at, source: 'calc' }] };
    case 'plan.done':
      return s.plan && s.plan.id === o.plan_id && !s.plan.done.includes(o.item_id)
        ? { ...s, plan: { ...s.plan, done: [...s.plan.done, o.item_id] } }
        : s;
  }
}

function emptySession(date: ISODate, profile: Profile): Session {
  return {
    date,
    mode: profile.default_mode,
    topic_id: null,
    custom_topic: null,
    frame_id: null,
    challenge_id: null,
    twister_id: null,
    content_version: CONTENT_VERSION,
    steps_done: [],
    breath: null,
    fillers: null,
    clarity: null,
    challenge_done: null,
    note: null,
    saved_at: null,
    saved_hour: null,
    full: false,
  };
}
