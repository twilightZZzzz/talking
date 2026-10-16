# Спецификация v2 — источник правды для разработки

Дополняет [ARCHITECTURE.md](ARCHITECTURE.md) и заменяет его там, где они расходятся. Решения 16.10.2026 (владелец отдал UX на усмотрение разработки).

## 1. Что изменилось в продукте

1. **Нет лимита 15 минут.** Ритуал дня (утро 15 / экспресс 7) — это стартовая программа, а не потолок. Можно заниматься сколько угодно: свободные дубли, упражнения из библиотеки, персональный план. Всё засчитывается в XP, минуты, серию и статистику.
2. **Цель дня в минутах** (настраивается, по умолчанию 15, диапазон 5–120). Это цель, не ограничение. После выполнения цели прогресс продолжает копиться.
3. **Профиль проблем речи** (у каждого аккаунта свой). Каждый разобранный дубль добавляет «события проблем» (паразиты, темп, разгон вместо вывода, уходы в сторону, пропуски каркаса и т.д.). Из них считается профиль: что мешает сильнее всего, что улучшается, какие паразиты твои любимые. На основе профиля:
   - рекомендуются упражнения из библиотеки;
   - ИИ составляет персональный план упражнений (с твоими паразитами, твоими цитатами);
   - челлендж дня выбирается под главную проблему;
   - разбор дубля проверяет хронические проблемы и даёт задание под них.
4. **Мультиаккаунт.** Каждый пользователь видит только своё (RLS). Опциональный allowlist `ALLOWED_EMAILS` (пусто = вход всем).
5. **Свой стиль**, а не копия Duolingo: см. §7.

## 2. Информационная архитектура

Нижний таб-бар (мобайл) / боковая колонка (≥ 900px):

| Таб | Путь | Содержание |
|---|---|---|
| Сегодня | `/` | Солнце цели дня (минуты), серия, XP/уровень. Ритуал дня (5 шагов, утро/экспресс). Челлендж дня. «Для тебя» — 2 упражнения из профиля. Кнопка «Свободный дубль». |
| Практика | `/practice` | «Дубль на тему» (любая тема, своя или случайная), «Мой план» (ИИ-план из профиля, кнопка обновить), библиотека упражнений по категориям с фильтром по проблемной зоне. |
| Прогресс | `/progress` | Календарь 8 недель (по минутам), минуты за 14 дней, паразиты/мин за 14 дней, проблемные зоны (шкала + тренд + топ слов-паразитов), достижения, история дублей. |
| Профиль | `/profile` | Цель дня, режим по умолчанию, тема, таймзона, «мои проблемы» (самооценка), импорт из старой версии, экспорт, статус ИИ, выход. |

Полноэкранные (без таб-бара):
- `/login` — email → 6 цифр.
- `/onboarding` — первый вход: выбор своих проблем (чекбоксы из каталога) + цель дня.
- `/exercise/[id]` — экран упражнения (шаг ритуала, упражнение из библиотеки, пункт плана, свободный дубль `free`). Инструкция → таймер подготовки → запись (если речевое) → разбор → «Ещё дубль» / «Готово».
- `/takes/[id]` — полный разбор дубля.
- `/day-done` — празднование после «Сохранить день» (может быть модалкой).

## 3. Каталог проблем (`src/domain/problems/catalog.ts`)

| code | Название | Источник | Как измеряется |
|---|---|---|---|
| `fillers` | Слова-паразиты | код | паразитов в минуту; severity = min(1, fpm/6) |
| `pace_fast` | Тараторю | код | > 165 сл/мин; severity растёт до 200 |
| `pace_slow` | Слишком медленно | код | < 105 сл/мин; severity растёт до 80 |
| `few_pauses` | Нет пауз | код | пауз > 0.7с в минуту < 2 |
| `slow_start` | Разгон вместо вывода | ИИ | первая фраза — не вывод |
| `detours` | Уходы в сторону | ИИ | число уходов |
| `frame_gaps` | Пропуск пунктов каркаса | ИИ / код | доля пропущенных пунктов |
| `frame_order` | Сбит порядок мысли | ИИ | |
| `run_on` | Предложения-цепочки | ИИ | «и… и ещё… а вот…» |
| `weak_ending` | Нет вывода в конце | ИИ | |
| `vague` | Нет конкретики | ИИ | нет примеров, цифр, фактов |
| `repetitions` | Повторы слов | код | одно и то же значимое слово ≥3 раз за 20 слов |

Событие: `{ code, severity 0..1, evidence: { quote?, t?, words?: string[] , value?: number } }`.

Профиль: для каждого кода `score 0..100` = взвешенное среднее severity по событиям последних 60 дней с полураспадом 10 дней × 100; `trend` = среднее за 7 дней − среднее за предыдущие 21 (отрицательно = лучше); `count`; `lastSeen`. Самооценка из онбординга даёт стартовый вес (score 40, вес как у 2 событий), пока данных мало. Плюс `topFillers`: слова-паразиты с частотой.

## 4. Геймификация v2 (`src/domain/gamification`)

XP считается чистой функцией из истории (как `calc()` в legacy), ничего не хранится счётчиком.

| Событие | XP |
|---|---|
| Шаг ритуала отмечен | 10 |
| Упражнение из библиотеки/плана выполнено | 10 (+5 если ≥ 5 мин) |
| Дубль разобран | 15 |
| Следующий дубль того же дня лучше предыдущего по паразитам/мин | +10 |
| «Сохранить день» (самооценка) | 20 |
| Челлендж выполнен | 25 |
| Полный утренний ритуал | 30 |
| Рекорд по паразитам (ручной итог дня меньше прошлого минимума) | 30 |
| Цель дня по минутам выполнена | 20 |

- Сумма дня × множитель серии `min(1.5, 1 + (streak−1)·0.1)` (как legacy). Лимита в день нет.
- **Активный день** (для серии и календаря): сохранён день ИЛИ ≥ 5 минут практики ИЛИ ≥ 1 разобранный дубль.
- Календарь: 0 — пусто, 1 — активен, 2 — цель дня выполнена.
- Цель недели: 5 активных дней.
- Уровни: legacy 8 + 3 новых: `[0 Новичок, 150 Разговорчивый, 400 Собранный, 800 Чёткий, 1400 Уверенный, 2200 Спикер, 3200 Оратор, 4500 Голос эфира, 6000 Трибун, 8000 Мастер слова, 10500 Легенда]`. Открытия по уровню как в legacy (подготовка 30→20→10, без бумажки, тема-сюрприз).
- Достижения: 12 из legacy (проверять по всей истории) + `micro` «Под микроскопом» (10 разобранных дублей), `metronome` «Метроном» (3 дня подряд темп 120–150 по лучшему дублю дня), `marathon` «Марафонец» (60 мин практики за день), `own_path` «Своя дорога» (5 упражнений из персонального плана), `hunter` «Охотник на паразитов» (паразиты/мин за последние 7 дней на 50% ниже, чем за первые 7 дней с разборами), `hour10` «10 часов речи» (суммарно 600 мин). Открытые не снимаются.

Минуты практики: у каждой активности `duration_s`. Шаг ритуала = номинал шага (3/2/5/3/2 мин), упражнение = номинал или фактическое время таймера (что больше 0), дубль = длительность записи.

## 5. Данные (миграция `supabase/migrations/0001_init.sql`)

```
profiles(user_id pk→auth.users, timezone text default 'Asia/Yekaterinburg', daily_goal_min int default 15,
         default_mode text default 'full', theme text default 'system', self_problems text[] default '{}',
         onboarded bool default false, created_at, updated_at)
sessions(id uuid pk, user_id, date date, unique(user_id,date),
         mode text, topic_id text, custom_topic text, frame_id text, challenge_id text, twister_id text, content_version int,
         steps_done int[] default '{}', breath int,
         fillers int, clarity smallint, challenge_done bool, note text,
         saved_at timestamptz, saved_hour smallint, full bool default false, updated_at)
activities(id uuid pk (клиент генерирует), user_id, date date, kind text check in
         ('ritual_step','drill','take','day_saved','legacy'), ref text, duration_s int default 0,
         meta jsonb default '{}', created_at)   -- unique(user_id, date, kind, ref) для ritual_step
takes(id uuid pk, user_id, session_date date, take_no int, context text ('ritual','free','drill','plan'),
      exercise_id text, topic text, frame_id text, challenge_id text,
      source text ('record','upload'), audio_path text, mime text, duration_s numeric,
      status text default 'created', failed_stage text, error text, locked_until timestamptz,
      transcript text, words jsonb, metrics jsonb, feedback jsonb, fillers_excluded int[] default '{}',
      asr_model text, llm_model text, prompt_version text, created_at, analyzed_at)
problem_events(id bigserial, user_id, take_id uuid null, code text, severity real, evidence jsonb, created_at)
coach_plans(id uuid pk, user_id, created_at, source text ('ai','rules'), profile jsonb, items jsonb, done text[] default '{}')
achievements(user_id, code, unlocked_at timestamptz, source text default 'calc', pk(user_id, code))
```
RLS на всех: `user_id = auth.uid()` (select/insert/update/delete). GRANT для `authenticated`. Бакет `audio` приватный, путь `{user_id}/{take_id}.{ext}`, политики по первому сегменту.

## 6. API (route handlers, Node runtime)

| Метод | Путь | Что |
|---|---|---|
| GET | `/api/state` | bootstrap: profile, сессии и активности за 400 дней, сводки дублей (без words), problem events за 60 дней, текущий план, achievements, aiStatus |
| POST | `/api/sync` | пакет операций `{ops:[...]}`: `profile.patch`, `session.patch {date, fields}`, `activity.upsert {...}`, `activity.delete {id}`, `achievement.unlock {code}`; идемпотентно |
| POST | `/api/takes` | создать дубль (id от клиента), вернуть `uploadUrl` + `path` для прямой загрузки в Storage |
| POST | `/api/takes/[id]/transcribe` | Groq Whisper (или mock) → words → метрики → problem events (кодовые) → status `transcribed` |
| POST | `/api/takes/[id]/feedback` | LLM → zod → feedback + problem events (ИИ) → status `done`, удалить аудио, создать activity `take` |
| GET/PATCH | `/api/takes/[id]` | получить; PATCH `fillers_excluded` |
| POST | `/api/coach/plan` | новый персональный план (LLM или правила) |
| POST | `/api/import` | импорт legacy base64 |
| GET | `/api/export` | экспорт JSON |

Провайдеры ИИ:
- Транскрипция: `GROQ_API_KEY` → Groq `whisper-large-v3`; иначе mock.
- LLM: `LLM_PROVIDER=anthropic|groq` (по умолчанию: anthropic если есть `ANTHROPIC_API_KEY`, иначе groq если есть `GROQ_API_KEY`, иначе mock). Anthropic `claude-sonnet-5-5`; Groq `openai/gpt-oss-120b`.
- Mock-режим: реалистичный фиктивный транскрипт и разбор, чтобы весь UX работал без ключей. В UI — плашка «Демо-режим ИИ».

## 7. Визуальная идентичность — «Утренняя речь»

Ярко и весело, геймифицированно, но **своё**: «стикерный» стиль — тёплый кремовый фон, чернильная обводка, жёсткая смещённая тень, рассветная палитра, широкий дисплейный шрифт.

- Фон `--bg #FFF6EA` (крем), поверхность `--surface #FFFFFF`, чернила `--ink #1F1A33` (текст, обводки 2.5px, тени).
- Тень-«стикер»: `box-shadow: 0 4px 0 var(--ink)` (не цветная грань, как у Duolingo, а чернильная). Нажатие: `translateY(3px)`, тень 1px.
- Акценты: `--sun #FFB938` (XP, солнце цели), `--coral #FF6A3D` (primary-действия), `--mint #22C29A` (успех, выполнено), `--sky #4D9DFF` (запись, информация), `--berry #FF4D7E` (паразиты, ошибки), `--lilac #9C7BFF` (достижения, ИИ-план).
- Тёмная тема: фон `#16131F`, поверхность `#221E30`, чернила-обводки `#0B0912`, текст `#F4EFFF`, акценты те же (чуть светлее).
- Шрифты (из legacy — это часть идентичности): **Unbounded** 600/800 для заголовков и крупных цифр, **Onest** 400/500/700 для текста. Через `next/font/google`, subsets `cyrillic`, `latin`.
- Фирменные мотивы:
  - **Солнце цели дня** — круг, который «встаёт» и наполняется лучами по мере минут практики.
  - **Звуковая волна** — полосы-прогрессы сделаны из вертикальных «столбиков волны».
  - **Пузыри речи** — подсказки маскота и цитаты в карточках-облачках с хвостиком.
  - Значки достижений — стикеры с лёгким поворотом.
- Маскот **Мик** — SVG-компонент: круглый микрофон-персонаж, тело `--sky`, сетка-купол чернильная, обводка чернилами, большие глаза. Настроения: `happy`, `think`, `wow`, `cheer`, `sleep`, `coach`.
- Тон текстов: тренер — прямо, коротко, на «ты».

## 8. Структура кода

```
src/app/(tabs)/{page.tsx, practice/, progress/, profile/}   — таб-экраны
src/app/{login, onboarding, exercise/[id], takes/[id]}/
src/app/api/...
src/components/ui/        — Button, Card, Sticker, Bubble, ProgressWave, SunGoal, Mascot, TabBar, TopStats, Sheet, Toast
src/components/<feature>/ — экраны и блоки
src/domain/               — чистый TS (без React/Next), покрыт vitest
  content/  calendar/  gamification/  speech/  problems/  exercises/  types.ts
src/client/               — store (useApp), sync-очередь, media (recorder, extract-audio, upload)
src/server/               — supabase (server/admin клиенты), auth guard, ai/ (transcribe, llm, feedback, plan, mock), repo
src/proxy.ts              — обновление сессии Supabase, редирект на /login
```
