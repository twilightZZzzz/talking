import { FRAMES, TOPICS } from '../content';
import { problemInfo } from '../problems/catalog';
import type { Exercise, PlanItem, ProblemCode, ProblemProfile } from '../types';

export const EXERCISES: Exercise[] = [
  // ---- 5 шагов ритуала из legacy ----
  {
    id: 'ritual-0',
    title: 'Разминка рта',
    category: 'warmup',
    minutes: 3,
    targets: [],
    speaking: false,
    instructions: [
      '«Лопата» и «иголка»: широкий язык на нижней губе 5 сек, затем узкий острый вперёд 5 сек. ×5',
      '«Часики»: кончик языка из угла в угол рта. ×15',
      'Губы: «трубочка» — «улыбка» с силой. ×15',
      'Пробка: зажми ручку зубами и прочитай скороговорку 3 раза, потом без ручки ещё 2 раза, каждый раз чуть быстрее.',
    ],
    success: 'Скороговорка без ручки произнесена чисто и чуть быстрее, чем с ручкой.',
  },
  {
    id: 'ritual-1',
    title: 'Дыхание и голос',
    category: 'breath',
    minutes: 2,
    targets: ['pace_fast'],
    speaking: false,
    instructions: [
      'Вдох носом в живот на 4 счёта, выдох на «ссс» ровно и долго. ×5',
      'На одном выдохе считай вслух «раз, два, три…» спокойно. Побей свой рекорд.',
      'Мычание «ммм» с закрытым ртом, почувствуй вибрацию в губах.',
    ],
    success: 'Досчитал на одном выдохе до числа не меньше прошлого рекорда.',
  },
  {
    id: 'ritual-2',
    title: 'Мысль по каркасу',
    category: 'structure',
    minutes: 5,
    targets: ['fillers', 'slow_start', 'frame_gaps', 'frame_order', 'detours'],
    speaking: true,
    take_s: 90,
    prep_s: 30,
    needs_topic: true,
    needs_frame: true,
    instructions: [
      'Набросай на бумаге по одному слову на каждый пункт каркаса.',
      'Начни с вывода одной фразой. Сначала главное, потом детали.',
      'Говори 90 секунд на камеру. Хочешь сказать «э» — замолчи на секунду.',
      'Второй дубль: та же тема за 60 секунд.',
    ],
    success: 'Первая фраза — вывод, прошёл все пункты каркаса по порядку, на «э» ставил паузу.',
  },
  {
    id: 'ritual-3',
    title: 'Разбор записи',
    category: 'structure',
    minutes: 3,
    targets: ['fillers'],
    speaking: false,
    instructions: [
      'Пересмотри второй дубль и честно посчитай паразитов.',
      'Оцени, насколько понятно с первого раза: 1 — каша, 5 — чётко.',
      'Запиши, где ушёл в сторону и почему.',
    ],
    success: 'Записаны число паразитов, оценка ясности и одно место, где ушёл в сторону.',
  },
  {
    id: 'ritual-4',
    title: 'Пересказ вслух',
    category: 'retell',
    minutes: 2,
    targets: ['frame_gaps', 'slow_start'],
    speaking: true,
    take_s: 60,
    instructions: [
      'Открой любую статью или пост по своей теме. Прочитай абзац глазами.',
      'Закрой текст и перескажи вслух в 3 предложения: о чём, главное, что из этого следует.',
    ],
    success: 'Пересказ уместился ровно в 3 предложения, без подглядывания в текст.',
  },

  // ---- разминка ----
  {
    id: 'warm-ladder',
    title: 'Скороговорка лесенкой',
    category: 'warmup',
    minutes: 3,
    targets: ['pace_fast'],
    speaking: false,
    instructions: [
      'Выбери скороговорку и прочитай её медленно, отчётливо проговаривая каждую согласную.',
      'Повтори 3 раза, каждый раз на 10% быстрее, но без смазанных слогов.',
      'Как только слог смазался — вернись на прошлую скорость и повтори ещё дважды.',
    ],
    success: 'Скороговорка чисто произнесена три раза подряд на самой быстрой скорости.',
  },
  {
    id: 'warm-cork',
    title: 'Пробка',
    category: 'warmup',
    minutes: 3,
    targets: ['fillers'],
    speaking: false,
    instructions: [
      'Зажми ручку или пробку зубами, как удила.',
      'Прочитай вслух абзац любого текста, стараясь, чтобы было понятно каждое слово.',
      'Вынь пробку и прочитай тот же абзац ещё раз. Почувствуй, как легче работает рот.',
    ],
    success: 'С пробкой понятно каждое слово, без пробки речь чётче, чем в первом чтении.',
  },
  {
    id: 'warm-voice-slides',
    title: 'Голосовые горки',
    category: 'warmup',
    minutes: 2,
    targets: ['pace_slow', 'few_pauses'],
    speaking: false,
    instructions: [
      'На выдохе протяни «а-а-а» вверх от низкого тона к высокому и обратно. ×5',
      'Повтори с «о», «у», «и».',
      'Скажи вслух: «Сегодня я говорю чётко» — сначала шёпотом, потом тихо, потом в полный голос.',
    ],
    success: 'Голос не срывается на переходах, последняя фраза звучит ровно и в полную громкость.',
  },

  // ---- дыхание ----
  {
    id: 'breath-exhale',
    title: 'Длинный выдох',
    category: 'breath',
    minutes: 2,
    targets: ['pace_fast', 'few_pauses'],
    speaking: false,
    instructions: [
      'Встань прямо. Вдох носом на 4 счёта в живот.',
      'Выдох на «ссс» ровно и без дрожи. Засеки время.',
      'Повтори 5 раз, каждый раз пробуй продлить выдох на 1–2 секунды.',
    ],
    success: 'Последний выдох на 3 секунды дольше первого.',
  },
  {
    id: 'breath-pause-breath',
    title: 'Вдох вместо «э»',
    category: 'breath',
    minutes: 3,
    targets: ['fillers', 'few_pauses'],
    speaking: true,
    take_s: 60,
    prep_s: 15,
    needs_topic: true,
    instructions: [
      'Говори по теме 60 секунд.',
      'Каждый раз, когда хочется сказать «э» или «ну», молча вдохни носом и продолжи.',
      'Вдох должен быть слышным на записи: он заменяет паразита.',
    ],
    success: 'Минимум 5 пауз с вдохом и не больше 2 слов-паразитов за дубль.',
  },
  {
    id: 'breath-whisper',
    title: 'Шёпот-опора',
    category: 'breath',
    minutes: 3,
    targets: ['pace_fast', 'fillers'],
    speaking: false,
    instructions: [
      'Положи ладонь на живот. Прочитай абзац шёпотом, каждое слово чётко.',
      'Прочитай тот же абзац вполголоса, сохраняя опору на выдох из живота.',
      'Прочитай в полный голос, не меняя темпа и не поднимая плечи.',
    ],
    success: 'Три прохода одним темпом, плечи неподвижны, голос не садится к концу фразы.',
  },
  {
    id: 'breath-count-phrase',
    title: 'Фраза на одном выдохе',
    category: 'breath',
    minutes: 2,
    targets: ['run_on', 'pace_slow'],
    speaking: false,
    instructions: [
      'Прочитай вслух три предложения из текста, делая вдох только на точках.',
      'Если воздуха не хватает до точки, предложение слишком длинное: разбей его на два.',
      'Перескажи эти же три предложения своими словами, также дыша на точках.',
    ],
    success: 'Каждое предложение произнесено на одном выдохе, без вдоха посередине.',
  },

  // ---- каркасы и структура ----
  {
    id: 'str-prep-fast',
    title: 'Каркас PREP на скорость',
    category: 'structure',
    minutes: 4,
    targets: ['frame_gaps', 'frame_order', 'slow_start'],
    speaking: true,
    take_s: 60,
    prep_s: 20,
    needs_topic: true,
    instructions: [
      'Возьми тему. За 20 секунд придумай позицию, причину и один пример.',
      'Скажи за 60 секунд: позиция, причина, пример, повтор позиции.',
      'Каждый пункт — одно-два предложения. Не отступай от порядка.',
    ],
    success: 'Все четыре пункта прозвучали по порядку, последняя фраза повторяет первую.',
  },
  {
    id: 'str-conclusion-10',
    title: 'Вывод за 10 секунд',
    category: 'structure',
    minutes: 3,
    targets: ['slow_start', 'weak_ending'],
    speaking: true,
    take_s: 30,
    prep_s: 10,
    needs_topic: true,
    instructions: [
      'Получи тему и сразу, без подготовки, скажи главный вывод одной фразой.',
      'Уложись в 10 секунд и 12 слов. Никаких «ну, в общем».',
      'После вывода сделай паузу и добавь одну причину. Всё.',
    ],
    success: 'Вывод прозвучал в первые 10 секунд, не длиннее 12 слов, без вступления.',
  },
  {
    id: 'str-one-thought',
    title: 'Одна мысль — одно предложение',
    category: 'structure',
    minutes: 3,
    targets: ['run_on', 'detours'],
    speaking: true,
    take_s: 60,
    prep_s: 15,
    needs_topic: true,
    instructions: [
      'Говори на тему 60 секунд.',
      'Каждое предложение — одна мысль и не длиннее 15 слов.',
      'Закончил предложение — остановись на секунду. Не склеивай через «и», «а», «ну».',
    ],
    success: 'На записи нет предложений длиннее 15 слов и нет предложений, начинающихся с «и».',
  },
  {
    id: 'str-elevator-30',
    title: 'Лифт-питч 30 сек',
    category: 'structure',
    minutes: 3,
    targets: ['slow_start', 'vague', 'weak_ending'],
    speaking: true,
    take_s: 30,
    prep_s: 30,
    instructions: [
      'Расскажи, чем ты занимаешься и чем ты полезен, будто вы вместе едете в лифте.',
      'Структура: кто тебе нужен, что ты ему даёшь, один результат с цифрой, что сделать дальше.',
      'Ровно 30 секунд. Закончи действием: «напиши мне» или «давай созвонимся».',
    ],
    success: 'Уложился в 30 секунд, есть цифра, последняя фраза — действие.',
  },
  {
    id: 'str-three-points',
    title: 'Три пункта без шпаргалки',
    category: 'structure',
    minutes: 4,
    targets: ['frame_gaps', 'frame_order', 'repetitions'],
    speaking: true,
    take_s: 75,
    prep_s: 20,
    needs_topic: true,
    instructions: [
      'Начни с числа: «Есть три вещи…».',
      'Назови каждый пункт одним словом и сразу объясни его одним предложением.',
      'Закончи короткой фразой-итогом. Бумагу не смотри.',
    ],
    success: 'Названо число, три пункта по порядку, итог одной фразой.',
  },
  {
    id: 'str-ppr',
    title: 'Проблема — причина — решение',
    category: 'structure',
    minutes: 4,
    targets: ['frame_order', 'vague'],
    speaking: true,
    take_s: 90,
    prep_s: 30,
    needs_topic: true,
    instructions: [
      'Возьми тему и сформулируй проблему одним предложением.',
      'Назови одну причину, а не пять. Затем одно конкретное решение с шагом на сегодня.',
      'Говори 90 секунд, держи порядок: проблема, причина, решение.',
    ],
    success: 'Три блока по порядку, в решении названо конкретное действие.',
  },
  {
    id: 'str-last-line',
    title: 'Финальная фраза',
    category: 'structure',
    minutes: 3,
    targets: ['weak_ending'],
    speaking: true,
    take_s: 45,
    prep_s: 15,
    needs_topic: true,
    instructions: [
      'Расскажи тему за 45 секунд.',
      'Заранее придумай последнюю фразу: вывод или призыв.',
      'Скажи её отчётливо, замолчи на 2 секунды и закончи запись. Без «ну вот, в общем».',
    ],
    success: 'После последней фразы нет ни одного слова, перед ней слышна пауза.',
  },

  // ---- паузы ----
  {
    id: 'pause-stop-word',
    title: 'Стоп-слово',
    category: 'pauses',
    minutes: 4,
    targets: ['fillers'],
    speaking: true,
    take_s: 60,
    prep_s: 10,
    needs_topic: true,
    instructions: [
      'Выбери одного главного паразита. Скажи его себе вслух: это твоё стоп-слово.',
      'Говори на тему. Сказал стоп-слово — хлопни в ладоши и замолчи на 2 секунды.',
      'Только после паузы продолжай. Не извиняйся и не комментируй.',
    ],
    success: 'Стоп-слово прозвучало не больше 2 раз, и каждый раз после него была пауза.',
  },
  {
    id: 'pause-pencil',
    title: 'Чтение с паузами по карандашу',
    category: 'pauses',
    minutes: 4,
    targets: ['few_pauses', 'run_on'],
    speaking: false,
    instructions: [
      'Возьми абзац текста и карандаш. Поставь вертикальную черту после каждой запятой и две черты после точки.',
      'Прочитай вслух. Одна черта — пауза на счёт «раз», две черты — на счёт «раз-два».',
      'Прочитай ещё раз, но поставь паузы в других местах: перед ключевыми словами.',
    ],
    success: 'Паузы выдержаны во всех отмеченных местах, ни разу не поторопился.',
  },
  {
    id: 'pause-silence-3',
    title: 'Три секунды тишины',
    category: 'pauses',
    minutes: 3,
    targets: ['fillers', 'few_pauses'],
    speaking: true,
    take_s: 60,
    prep_s: 10,
    needs_topic: true,
    instructions: [
      'Говори на тему 60 секунд.',
      'После каждого второго предложения молча пережди 3 секунды. Считай про себя «раз, два, три».',
      'Не заполняй тишину звуками. Тишина — часть речи.',
    ],
    success: 'На записи минимум 4 паузы по 2–3 секунды и ни одного «э» внутри пауз.',
  },
  {
    id: 'pause-before-key',
    title: 'Пауза перед главным',
    category: 'pauses',
    minutes: 3,
    targets: ['few_pauses', 'weak_ending'],
    speaking: true,
    take_s: 60,
    prep_s: 15,
    needs_topic: true,
    instructions: [
      'Заранее выбери одну самую важную фразу в своей речи.',
      'Перед ней сделай паузу в секунду, скажи фразу медленнее остальных и сделай паузу после.',
      'Остальное говори в обычном темпе.',
    ],
    success: 'Главная фраза обрамлена паузами и произнесена заметно медленнее остального.',
  },

  // ---- темп ----
  {
    id: 'pace-metronome-130',
    title: 'Метроном 130',
    category: 'pace',
    minutes: 4,
    targets: ['pace_fast', 'pace_slow'],
    speaking: true,
    take_s: 60,
    prep_s: 10,
    needs_topic: true,
    instructions: [
      'Включи метроном на 130 ударов в минуту: слово на каждый удар или два.',
      'Говори на тему, подстраивая слова под такт. Не ускоряйся, когда увлёкся.',
      'Метроном можно выключить в последние 20 секунд и удержать темп самому.',
    ],
    success: 'Темп в записи 120–150 слов в минуту.',
  },
  {
    id: 'pace-slow-read',
    title: 'Медленное чтение',
    category: 'pace',
    minutes: 3,
    targets: ['pace_fast'],
    speaking: false,
    instructions: [
      'Прочитай вслух абзац так медленно, что это кажется странным.',
      'Каждое слово — отдельно, на каждой запятой вдох.',
      'Прочитай ещё раз чуть быстрее. Это и есть твой рабочий темп.',
    ],
    success: 'Второе чтение быстрее первого, но каждое слово остаётся различимым.',
  },
  {
    id: 'pace-contrast',
    title: 'Быстро — медленно',
    category: 'pace',
    minutes: 3,
    targets: ['pace_fast', 'pace_slow', 'few_pauses'],
    speaking: true,
    take_s: 60,
    prep_s: 15,
    needs_topic: true,
    instructions: [
      'Рассказывай тему. Подводку и пример говори в обычном темпе.',
      'Три ключевые фразы произноси вдвое медленнее и с паузой перед ними.',
      'Следи, чтобы разница в темпе была слышна на записи.',
    ],
    success: 'Три ключевые фразы звучат заметно медленнее остального рассказа.',
  },
  {
    id: 'pace-energy',
    title: 'Энергичный темп',
    category: 'pace',
    minutes: 3,
    targets: ['pace_slow'],
    speaking: true,
    take_s: 60,
    prep_s: 15,
    needs_topic: true,
    instructions: [
      'Заготовь вывод и два аргумента ещё до старта: останавливаться на поиске слов нельзя.',
      'Говори на тему так, как говоришь с другом о том, что тебе интересно.',
      'Не тяни окончания и не прерывайся на «ну…» в поисках фразы.',
    ],
    success: 'Темп в записи выше 115 слов в минуту без роста паразитов.',
  },

  // ---- импровизация ----
  {
    id: 'impro-surprise-60',
    title: 'Тема-сюрприз 60 сек',
    category: 'impro',
    minutes: 3,
    targets: ['slow_start', 'fillers', 'detours'],
    speaking: true,
    take_s: 60,
    prep_s: 5,
    needs_topic: true,
    instructions: [
      'Тема открывается только на старте таймера. Подготовки нет.',
      'Первой фразой дай вывод, даже если не уверен. Потом одна причина и один пример.',
      'Говори до конца таймера, не сбегая в сторону.',
    ],
    success: 'Первая фраза — вывод, дубль прошёл без пауз длиннее 5 секунд и без вторых историй.',
  },
  {
    id: 'impro-object-30',
    title: 'Предмет за 30 секунд',
    category: 'impro',
    minutes: 2,
    targets: ['vague', 'fillers'],
    speaking: true,
    take_s: 30,
    prep_s: 0,
    instructions: [
      'Возьми любой предмет рядом: ручку, кружку, телефон.',
      'Расскажи за 30 секунд, зачем он нужен и чем он лучше аналога. Три конкретных факта.',
      'Не используй слова «такой», «типа», «как бы».',
    ],
    success: 'Названы три конкретных факта, без слов «такой», «типа», «как бы».',
  },
  {
    id: 'impro-why-chain',
    title: 'Цепочка «почему»',
    category: 'impro',
    minutes: 4,
    targets: ['vague', 'frame_order'],
    speaking: true,
    take_s: 90,
    prep_s: 15,
    needs_topic: true,
    instructions: [
      'Назови позицию по теме одной фразой.',
      'Задай себе вслух «почему?» и ответь одной фразой. Повтори три раза.',
      'В конце собери цепочку в один вывод.',
    ],
    success: 'Три «почему» подряд, каждый ответ — одно предложение, в конце общий вывод.',
  },
  {
    id: 'impro-no-fillers-60',
    title: 'Минута без «э»',
    category: 'impro',
    minutes: 3,
    targets: ['fillers'],
    speaking: true,
    take_s: 60,
    prep_s: 10,
    needs_topic: true,
    instructions: [
      'Говори 60 секунд на тему. Паразитов быть не должно.',
      'Если запнулся — молчи, пока не найдёшь следующую фразу. Тишина лучше «э».',
      'Не ускоряйся, чтобы спрятать паузы.',
    ],
    success: 'Не больше 1 паразита за дубль.',
  },
  {
    id: 'impro-concrete',
    title: 'Конкретика: цифра, имя, случай',
    category: 'impro',
    minutes: 4,
    targets: ['vague', 'repetitions'],
    speaking: true,
    take_s: 60,
    prep_s: 20,
    needs_topic: true,
    instructions: [
      'Расскажи по теме, но запрети себе слова «много», «разные», «всякое».',
      'Включи в рассказ одно число, одно имя или название и один случай из жизни.',
      'Каждый общий тезис подкрепляй примером.',
    ],
    success: 'Есть число, имя или название и один реальный случай, слов «много» и «разные» нет.',
  },

  // ---- пересказ ----
  {
    id: 'retell-3',
    title: 'Пересказ в 3 предложения',
    category: 'retell',
    minutes: 3,
    targets: ['run_on', 'detours', 'weak_ending'],
    speaking: true,
    take_s: 45,
    prep_s: 0,
    instructions: [
      'Прочитай короткую статью или пост (1–2 абзаца) и закрой её.',
      'Перескажи ровно тремя предложениями: о чём, главное, что из этого следует.',
      'Каждое предложение короче 15 слов. Не добавляй четвёртое.',
    ],
    success: 'Ровно три предложения, последнее — вывод.',
  },
  {
    id: 'retell-podcast',
    title: 'Пересказ подкаста',
    category: 'retell',
    minutes: 6,
    targets: ['frame_gaps', 'detours', 'vague'],
    speaking: true,
    take_s: 120,
    prep_s: 0,
    instructions: [
      'Послушай 3–5 минут подкаста или видео по своей теме, без заметок.',
      'Остановись и перескажи в 120 секунд: главная мысль, три аргумента, один пример, вывод.',
      'Назови хотя бы одно число или имя из услышанного.',
    ],
    success: 'Пересказ содержит главную мысль, три аргумента, пример и вывод.',
  },
  {
    id: 'retell-own-day',
    title: 'Вчерашний день по каркасу',
    category: 'retell',
    minutes: 3,
    targets: ['frame_order', 'run_on'],
    speaking: true,
    take_s: 60,
    prep_s: 10,
    instructions: [
      'Расскажи про вчерашний день по каркасу «было — стало — как».',
      'Было: с чего начал. Стало: чем закончил. Как: одно решение, которое всё изменило.',
      'Одно предложение — одна мысль. Не перечисляй всё подряд.',
    ],
    success: 'Три блока по порядку, ни одно предложение не длиннее 15 слов.',
  },
];

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

// ---------- рекомендации ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const scoreOf = (profile: ProblemProfile, code: ProblemCode) =>
  profile.scores.find((s) => s.code === code)?.score ?? 0;

/** Упражнения под профиль: сумма score целевых проблем + разнообразие категорий. Детерминированно по seed. Шаги ритуала не рекомендуются. */
export function recommendExercises(
  profile: ProblemProfile,
  opts: { exclude?: string[]; count: number; seed: number },
): Exercise[] {
  const rng = mulberry32(opts.seed);
  const skip = new Set(opts.exclude ?? []);
  const pool = EXERCISES.filter((e) => !e.id.startsWith('ritual-') && !skip.has(e.id)).map((e) => ({
    e,
    base: 1 + e.targets.reduce((s, c) => s + scoreOf(profile, c), 0),
    jitter: rng(),
  }));
  const picked: Exercise[] = [];
  const catCount = new Map<string, number>();
  while (picked.length < opts.count && pool.length) {
    let bi = 0;
    let bv = -Infinity;
    pool.forEach((p, i) => {
      const v = p.base * Math.pow(0.55, catCount.get(p.e.category) ?? 0) * (0.85 + 0.3 * p.jitter);
      if (v > bv) {
        bv = v;
        bi = i;
      }
    });
    const [p] = pool.splice(bi, 1);
    picked.push(p.e);
    catCount.set(p.e.category, (catCount.get(p.e.category) ?? 0) + 1);
  }
  return picked;
}

// ---------- план без ИИ ----------

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

function whyFor(code: ProblemCode, profile: ProblemProfile): string {
  const info = problemInfo(code);
  const sc = profile.scores.find((s) => s.code === code);
  const top = profile.topFillers[0];
  switch (code) {
    case 'fillers':
      if (top) {
        const second = profile.topFillers[1];
        return `Твой главный паразит — «${top.word}» (${top.count} ${plural(top.count, 'раз', 'раза', 'раз')} в последних разборах)${
          second ? `, следом «${second.word}»` : ''
        }. Это упражнение учит ставить паузу на его месте.`;
      }
      return 'Слова-паразиты мешают тебе сильнее всего. Это упражнение учит ставить паузу вместо «э».';
    case 'pace_fast':
      return 'Ты говоришь слишком быстро: мысль не успевает дойти до слушателя. Замедляемся.';
    case 'pace_slow':
      return 'Темп у тебя ниже нормы, слушатель теряет нить. Тренируем ровный темп 120–150.';
    case 'few_pauses':
      return 'В твоей речи мало пауз. Они подчёркивают главное и заменяют «э».';
    default:
      break;
  }
  const trend = sc && sc.trend > 5 ? ' Сейчас становится хуже, самое время поработать.' : sc && sc.trend < -5 ? ' Уже улучшается, закрепляем.' : '';
  return `${info?.title ?? code} — одна из твоих главных проблем (${sc?.score ?? 0} из 100).${trend} ${info?.tip ?? ''}`.trim();
}

/** 4 пункта персонального плана без ИИ. now — ISO момента генерации (для детерминированности не используется в выборе). */
export function rulesPlan(profile: ProblemProfile, opts: { seed: number; now: string }): PlanItem[] {
  const rng = mulberry32(opts.seed ^ 0x9e3779b9);
  const exercises = recommendExercises(profile, { count: 4, seed: opts.seed });
  return exercises.map((ex, idx) => {
    const target = [...ex.targets].sort((a, b) => scoreOf(profile, b) - scoreOf(profile, a))[0];
    const hasScore = target && scoreOf(profile, target) > 0;
    const topic = ex.needs_topic ? TOPICS[Math.floor(rng() * TOPICS.length)].text : undefined;
    const frame = ex.needs_frame ? FRAMES[Math.floor(rng() * FRAMES.length)] : undefined;
    const prefix = ex.category === 'warmup' || ex.category === 'breath' ? 'Подготовка голоса. ' : '';
    return {
      id: `plan-${opts.seed}-${idx + 1}-${ex.id}`,
      title: ex.title,
      why: hasScore
        ? whyFor(target, profile)
        : `${prefix}Базовая тренировка: ${ex.success.charAt(0).toLowerCase()}${ex.success.slice(1)}`,
      targets: ex.targets,
      minutes: ex.minutes,
      speaking: ex.speaking,
      take_s: ex.take_s,
      topic,
      frame_id: frame?.id,
      instructions: ex.instructions,
      success: ex.success,
      base_exercise_id: ex.id,
    };
  });
}
