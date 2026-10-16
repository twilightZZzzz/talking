# Утренняя речь v2

Тренажёр речи: ежедневный ритуал, запись дублей, разбор от ИИ, профиль проблем и персональный план. Практика без лимита.

## Запуск локально

Нужны Node 20+, Docker Desktop, Supabase CLI.

```bash
npm install
supabase start          # Postgres, Auth, Storage, почта (Mailpit)
cp .env.example .env.local   # вставь ключи из `supabase status`
npm run dev             # http://localhost:3000
```

- Вход по коду: письма локально приходят в Mailpit — http://127.0.0.1:54324
- Без ключей ИИ работает демо-режим (примерный разбор). Для настоящего разбора добавь в `.env.local`:
  - `GROQ_API_KEY` — распознавание речи (Groq Whisper large v3) и, если нет ключа Anthropic, разбор (gpt-oss-120b);
  - `ANTHROPIC_API_KEY` — разбор и персональный план на Claude Sonnet 5.5 (опционально).
- Если `docker pull` зависает на macOS — это помощник учётных данных Docker Desktop ждёт доступ к связке ключей. Обход: `DOCKER_CONFIG=<папка с config.json без credsStore> supabase start`.

## Проверки

```bash
npm test                # vitest: домен, сервер, медиа
npx tsc --noEmit
npm run lint
```

## Деплой (Vercel + Supabase Cloud)

1. Supabase: новый проект → `supabase link --project-ref <ref>` → `supabase db push` (миграции из `supabase/migrations`).
   В Auth → Email: включить OTP (шаблон письма с `{{ .Token }}`, см. `supabase/templates/otp.html`), Site URL = домен Vercel.
2. Vercel: импортировать репозиторий, env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `ALLOWED_EMAILS` (по желанию).

## Документы

- [docs/SPEC-v2.md](docs/SPEC-v2.md) — продукт, данные, API, стиль (источник правды)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — архитектура и решения
- [docs/astra-review.md](docs/astra-review.md) — архитектурное ревью
