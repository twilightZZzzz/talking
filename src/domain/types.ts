// Общие типы домена. Контракт между domain/, server/ и UI — меняй осознанно.

export type ISODate = string; // 'YYYY-MM-DD' в таймзоне профиля
export type Mode = 'full' | 'exp';
export type Theme = 'system' | 'light' | 'dark';

export type ProblemCode =
  | 'fillers'
  | 'pace_fast'
  | 'pace_slow'
  | 'few_pauses'
  | 'slow_start'
  | 'detours'
  | 'frame_gaps'
  | 'frame_order'
  | 'run_on'
  | 'weak_ending'
  | 'vague'
  | 'repetitions';

export interface Profile {
  user_id: string;
  timezone: string;
  daily_goal_min: number;
  default_mode: Mode;
  theme: Theme;
  self_problems: ProblemCode[];
  onboarded: boolean;
}

export interface Session {
  date: ISODate;
  mode: Mode;
  topic_id: string | null;
  custom_topic: string | null;
  frame_id: string | null;
  challenge_id: string | null;
  twister_id: string | null;
  content_version: number;
  steps_done: number[];
  breath: number | null;
  // итог дня (null = не оценено)
  fillers: number | null;
  clarity: number | null;
  challenge_done: boolean | null;
  note: string | null;
  saved_at: string | null;
  saved_hour: number | null;
  full: boolean;
}

export type ActivityKind = 'ritual_step' | 'drill' | 'take' | 'day_saved' | 'legacy';

export interface Activity {
  id: string;
  date: ISODate;
  kind: ActivityKind;
  /** ritual_step: '0'..'4'; drill: id упражнения; take: id дубля */
  ref: string;
  duration_s: number;
  meta: {
    /** drill из персонального плана */
    plan?: boolean;
    /** take: паразитов в минуту, темп — для XP и достижений */
    fpm?: number;
    wpm?: number;
    fillers?: number;
    [k: string]: unknown;
  };
  created_at: string;
}

// ---------- Речь ----------

export interface Word {
  w: string;
  start: number;
  end: number;
}

export interface FillerHit {
  /** индекс первого слова в words */
  i: number;
  /** нормализованная форма: 'э', 'ну', 'как бы'… */
  word: string;
  t: number;
  /** спорное употребление («два типа», «это значит, что») */
  doubtful: boolean;
}

export interface SpeechMetrics {
  duration_s: number;
  speech_s: number;
  word_count: number;
  wpm: number;
  fillers: FillerHit[];
  fillers_count: number; // без doubtful
  fpm: number; // fillers_count в минуту речи
  pauses: { t: number; len: number }[]; // > 0.7с внутри речи
  pauses_per_min: number;
  repetitions: { word: string; count: number; t: number }[];
}

export interface ProblemEvent {
  code: ProblemCode;
  severity: number; // 0..1
  evidence: { quote?: string; t?: number; words?: string[]; value?: number };
  created_at: string;
  take_id?: string | null;
}

export interface ProblemScore {
  code: ProblemCode;
  score: number; // 0..100
  trend: number; // <0 = лучше
  count: number;
  lastSeen: string | null;
}

export interface ProblemProfile {
  scores: ProblemScore[]; // по убыванию score
  topFillers: { word: string; count: number }[];
  takesAnalyzed: number;
}

// ---------- Разбор ИИ ----------

export interface Feedback {
  clarity: number | null; // 1..5, null если мало данных
  clarity_reason: string;
  opening: { is_conclusion: boolean | null; quote: string; comment: string };
  frame: { point_id: string; point: string; present: boolean; quote: string; comment: string }[];
  frame_order_ok: boolean | null;
  detours: { t: number; quote: string; comment: string }[];
  challenge: { done: boolean | null; comment: string };
  vs_previous: string | null;
  issues: { code: ProblemCode; severity: 1 | 2 | 3; quote: string; comment: string }[];
  strengths: string[];
  main_issue: string;
  next_task: string;
  rewrite_opening: string;
}

export type TakeStatus =
  | 'created'
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'analyzing'
  | 'done'
  | 'failed';

export type TakeContext = 'ritual' | 'free' | 'drill' | 'plan';

export interface Take {
  id: string;
  session_date: ISODate;
  take_no: number;
  context: TakeContext;
  exercise_id: string | null;
  topic: string | null;
  frame_id: string | null;
  challenge_id: string | null;
  source: 'record' | 'upload';
  duration_s: number | null;
  status: TakeStatus;
  failed_stage: string | null;
  error: string | null;
  transcript: string | null;
  words: Word[] | null;
  metrics: SpeechMetrics | null;
  feedback: Feedback | null;
  fillers_excluded: number[];
  created_at: string;
  analyzed_at: string | null;
}

/** Сводка дубля для истории и геймификации (без words) */
export type TakeSummary = Omit<Take, 'words' | 'transcript'>;

// ---------- Контент и упражнения ----------

export interface Frame {
  id: string;
  name: string;
  points: { id: string; mark: string; text: string }[];
}

export interface Challenge {
  id: string;
  title: string;
  hint: string;
  targets: ProblemCode[];
  /** можно ли оценить по транскрипту */
  assessable: boolean;
}

export type ExerciseCategory =
  | 'warmup' // артикуляция, скороговорки
  | 'breath' // дыхание и голос
  | 'structure' // каркасы
  | 'pauses' // паузы вместо «э»
  | 'pace' // темп
  | 'impro' // импровизация
  | 'retell'; // пересказ

export interface Exercise {
  id: string;
  title: string;
  category: ExerciseCategory;
  minutes: number;
  targets: ProblemCode[];
  /** речевое — с записью дубля и разбором */
  speaking: boolean;
  /** длительность дубля, сек (для речевых) */
  take_s?: number;
  prep_s?: number;
  instructions: string[];
  /** критерий успеха, проверяемый */
  success: string;
  /** нужна тема (подставляется случайная или своя) */
  needs_topic?: boolean;
  /** нужен каркас */
  needs_frame?: boolean;
}

export interface PlanItem {
  id: string;
  title: string;
  why: string; // почему это тебе: ссылка на проблему/цитату
  targets: ProblemCode[];
  minutes: number;
  speaking: boolean;
  take_s?: number;
  topic?: string;
  frame_id?: string;
  instructions: string[];
  success: string;
  /** упражнение библиотеки, на котором основано */
  base_exercise_id?: string;
}

export interface CoachPlan {
  id: string;
  created_at: string;
  source: 'ai' | 'rules';
  items: PlanItem[];
  done: string[];
}

export interface Achievement {
  code: string;
  unlocked_at: string;
  source: 'calc' | 'legacy';
}

export interface AiStatus {
  transcription: 'groq' | 'mock';
  llm: 'anthropic' | 'groq' | 'mock';
}

/** Полное состояние, которое отдаёт /api/state */
export interface AppState {
  profile: Profile;
  sessions: Session[];
  activities: Activity[];
  takes: TakeSummary[];
  problemEvents: ProblemEvent[];
  plan: CoachPlan | null;
  achievements: Achievement[];
  aiStatus: AiStatus;
  email: string;
}
