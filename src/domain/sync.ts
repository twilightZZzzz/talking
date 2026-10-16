// Контракт POST /api/sync. Каждая операция идемпотентна.
import type { Activity, ISODate, Profile, Session } from './types';

export type SyncOp =
  | { op: 'profile.patch'; fields: Partial<Omit<Profile, 'user_id'>> }
  | { op: 'session.patch'; date: ISODate; fields: Partial<Omit<Session, 'date'>> }
  | { op: 'activity.upsert'; activity: Activity }
  | { op: 'activity.delete'; id: string }
  | { op: 'achievement.unlock'; code: string; unlocked_at: string }
  | { op: 'plan.done'; plan_id: string; item_id: string };

export interface SyncRequest {
  ops: (SyncOp & { op_id: string })[];
}
export interface SyncResponse {
  applied: string[]; // op_id
  failed: { op_id: string; error: string }[];
}
