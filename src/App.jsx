import { Fragment, useEffect, useMemo, useState } from 'react'

const BASE = import.meta.env.BASE_URL
const DEFAULT_IMG = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREUb6gYA6ne8sBfhrmaNRS5OVSKkkG68_AeMBL15BF4Q&s=10'
const FALLBACK = BASE + 'placeholder.svg'
const PER_PAGE = 24
const FORM_BUG = 'https://docs.google.com/forms/d/e/1FAIpQLSfsUXvNeOfWM6ovJp7oLoK1g9YcchuaqFQEQk4wC-O8kpC_bA/viewform'
const FORM_ORDER = 'https://docs.google.com/forms/d/e/1FAIpQLSfjtsGoeGJWrunl71AMuaZQ70SMXYoJi3KNEKeYK1NHFopozQ/viewform'
const GITHUB = 'https://github.com/RomanPivovaroff/boardgames_list'
// URL веб-приложения Apps Script (скрипт пишет «+» в колонку «Заказ» таблицы).
// Вставь свой /exec URL после деплоя скрипта (см. apps-script-order.gs); пока пусто — кнопки заказа скрыты.
const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL || ''

// диапазоны фильтра по времени партии (в минутах)
const TIME_BUCKETS = [
  ['0-30', 'до 30 мин'],
  ['30-60', '30–60 мин'],
  ['60-90', '60–90 мин'],
  ['90-120', '90–120 мин'],
  ['120+', 'больше 2 часов'],
]
// влезает ли игра в выбранный диапазон: для конечных — целиком внутри, для «больше 2 часов» — хотя бы частично
const timeMatch = (g, time) => {
  if (!time) return true
  const lo = g.timeMin ?? g.timeMax, hi = g.timeMax ?? g.timeMin
  if (lo == null) return false
  if (time === '120+') return (hi ?? lo) >= 120
  const [bLo, bHi] = time.split('-').map(Number)
  return lo >= bLo && (hi ?? lo) <= bHi
}

// hash может прийти percent-кодированным (#/g/%D1%82...) — декодируем и сравниваем с id
const hashId = () => {
  const m = location.hash.match(/^#\/g\/(.+)$/)
  if (!m) return undefined
  try { return decodeURIComponent(m[1]) } catch { return m[1] }
}
const players = g => g.playersMin ? (g.playersMax && g.playersMax !== g.playersMin ? `${g.playersMin}–${g.playersMax}` : g.playersMin) : '—'
const isUrl = s => !!s && s.startsWith('http')

function Cover({ game, className, noDefault }) {
  const first = game.image || (noDefault ? FALLBACK : DEFAULT_IMG)
  const [src, setSrc] = useState(first)
  useEffect(() => setSrc(first), [first])
  // картинка из таблицы → картинка по умолчанию → локальная заглушка
  const onError = () => setSrc(s => (s === FALLBACK ? s : s === DEFAULT_IMG ? FALLBACK : DEFAULT_IMG))
  return <img className={className} src={src} alt={game.name} loading="lazy" referrerPolicy="no-referrer" onError={onError} />
}

const Dots = ({ n }) => (
  <span className="dots" title={`Сложность ${n} из 5`}>
    {[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? 'on' : ''} />)}
  </span>
)

export default function App() {
  const [games, setGames] = useState([])
  const [q, setQ] = useState('')
  const [count, setCount] = useState('')
  const [diff, setDiff] = useState('')
  const [genre, setGenre] = useState('')
  const [time, setTime] = useState('')
  const [ord, setOrd] = useState('')
  const [openId, setOpenId] = useState(hashId())
  const [page, setPage] = useState(1)
  const [info, setInfo] = useState(false)
  // заказы: orderedIds — подтверждённые/оптимистичные, orderState — «sending»/«failed» на время запроса
  const [orderedIds, setOrderedIds] = useState(() => new Set())
  const [orderState, setOrderState] = useState({})
  const [copied, setCopied] = useState(false)

  const base = useMemo(() => games.filter(g => !g.parentId), [games])

  const close = () => { history.pushState(null, '', location.pathname + location.search); setOpenId(undefined) }

  useEffect(() => { fetch(BASE + 'games.json').then(r => r.json()).then(setGames) }, [])
  useEffect(() => {
    const h = () => setOpenId(hashId())
    const k = e => e.key === 'Escape' && close()
    addEventListener('hashchange', h); addEventListener('keydown', k)
    return () => { removeEventListener('hashchange', h); removeEventListener('keydown', k) }
  }, [])
  // Escape закрывает окно «О сайте»
  useEffect(() => {
    if (!info) return
    const k = e => e.key === 'Escape' && setInfo(false)
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [info])
  // при смене фильтров — на первую страницу
  useEffect(() => { setPage(1) }, [q, count, diff, genre, time, ord])

  const genres = useMemo(() => [...new Set(games.flatMap(g => g.genres))].sort(), [games])
  // поиск ищет и по дополнениям — если доп совпал, показываем базовую игру
  const hay = g => (g.name + ' ' + g.publisher + ' ' + g.description + ' ' + (g.owner || '') + ' ' + (g.expansions || []).map(e => e.name + ' ' + e.description + ' ' + e.publisher).join(' ')).toLowerCase()
  const isOrdered = g => g.ordered || orderedIds.has(g.id)
  const list = useMemo(() => base.filter(g =>
    (!q || hay(g).includes(q.toLowerCase())) &&
    (!count || (g.playersMin <= +count && +count <= (g.playersMax || g.playersMin))) &&
    (!diff || g.difficulty === +diff) &&
    timeMatch(g, time) &&
    (!ord || isOrdered(g)) &&
    (!genre || g.genres.includes(genre))
  ), [base, games, q, count, diff, genre, time, ord, orderedIds])

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const cur = Math.min(page, pages)
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE)

  const open = games.find(g => g.id === openId)

  const goto = p => { setPage(p); window.scrollTo(0, 0) }
  // заказ: POST на Apps Script, который ставит «+» в колонку «Заказ»; плашка ставится сразу, без ожидания ответа
  const order = g => {
    if (!SCRIPT_URL || isOrdered(g) || orderState[g.id] === 'sending') return
    const clear = s => { const n = { ...s }; delete n[g.id]; return n }
    setOrderState(s => ({ ...s, [g.id]: 'sending' }))
    fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ name: g.name }) })
      .then(r => { if (!r.ok) throw 0; return r.json() })
      .then(j => { if (!j.ok) throw 0; setOrderedIds(prev => new Set(prev).add(g.id)); setOrderState(clear) })
      .catch(() => {
        setOrderState(s => ({ ...s, [g.id]: 'failed' }))
        setTimeout(() => setOrderState(clear), 4000)
      })
  }
  // список заказанных игр: кнопка «Скопировать список» кладёт его в буфер обмена
  const copyList = () => {
    const lines = base.filter(isOrdered).map((g, i) => `${i + 1}. ${g.name}${g.owner ? ' — ' + g.owner : ''}`)
    navigator.clipboard.writeText('Заказ на игротеку:\n' + lines.join('\n'))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
      .catch(() => {})
  }
  // номера страниц: первая, последняя и соседние с текущей, между ними «…»
  const nums = [...new Set([1, pages, cur - 1, cur, cur + 1].filter(p => p >= 1 && p <= pages))].sort((a, b) => a - b)

  return (
    <>
      <header className="hero">
        <button className="info-btn" onClick={() => setInfo(true)} aria-label="О сайте" title="О сайте">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9.5" /><line x1="12" y1="11" x2="12" y2="16.2" /><line x1="12" y1="7.6" x2="12.01" y2="7.6" /></svg>
        </button>
        <a className="logo" href="https://vk.ru/geekmo" target="_blank" rel="noreferrer" title="GEEKMÖ во ВКонтакте">
          <img src={BASE + 'logo.png'} alt="GEEKMÖ" />
        </a>
        <h1>Игротека</h1>
        <p>{base.length ? `${base.length} настолок. Найдите игру под вашу компанию.` : 'Загружаем игры…'}</p>
        <div className="filters">
          <input type="search" placeholder="Название или описание" value={q} onChange={e => setQ(e.target.value)} />
          <select value={count} onChange={e => setCount(e.target.value)}>
            <option value="">Сколько игроков</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={diff} onChange={e => setDiff(e.target.value)}>
            <option value="">Любая сложность</option>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} из 5</option>)}
          </select>
          <select value={time} onChange={e => setTime(e.target.value)} aria-label="Время партии">
            <option value="">Время партии</option>
            {TIME_BUCKETS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <select value={ord} onChange={e => setOrd(e.target.value)} aria-label="Заказ">
            <option value="">Все игры</option>
            <option value="1">Только заказанные</option>
          </select>
          <select value={genre} onChange={e => setGenre(e.target.value)}>
            <option value="">Любой жанр</option>
            {genres.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
      </header>

      <main>
        {ord === '1' && (
          <div className="ordered-bar">
            <span>Заказанных игр: {base.filter(isOrdered).length}</span>
            {base.some(isOrdered) && (
              <button className="copy-btn" onClick={copyList}>{copied ? 'Скопировано ✓' : 'Скопировать список'}</button>
            )}
          </div>
        )}
        {games.length > 0 && list.length === 0 && <p className="empty">Ничего не найдено. Попробуйте убрать один из фильтров.</p>}
        <div className="grid">
          {shown.map(g => (
            <a key={g.id} className="card" href={`#/g/${g.id}`}>
              <Cover game={g} className="cover" />
              {g.expansions?.length > 0 && <span className="exp-badge">+ {g.expansions.length} доп.</span>}
              {isOrdered(g) && <span className="ordered-badge">✓ Заказано</span>}
              <div className="body">
                <h2>{g.name}</h2>
                <div className="meta"><span>{players(g)} игр.</span><span>{g.timeLabel || '—'}</span>{g.difficulty && <Dots n={g.difficulty} />}</div>
                {g.owner && <span className="owner" title="Владелец игры">{g.owner}</span>}
              </div>
            </a>
          ))}
        </div>
        {pages > 1 && (
          <nav className="pager" aria-label="Страницы">
            <button disabled={cur === 1} onClick={() => goto(cur - 1)} aria-label="Назад">←</button>
            {nums.map((p, i) => (
              <Fragment key={p}>
                {i > 0 && p - nums[i - 1] > 1 && <span className="gap">…</span>}
                <button className={p === cur ? 'on' : ''} onClick={() => goto(p)}>{p}</button>
              </Fragment>
            ))}
            <button disabled={cur === pages} onClick={() => goto(cur + 1)} aria-label="Вперёд">→</button>
          </nav>
        )}
        {pages > 1 && <p className="total">Показано {shown.length} из {list.length} игр</p>}
      </main>

      {open && (
        <div className="overlay" onClick={close}>
          <article className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={open.name}>
            <button className="x" onClick={close} aria-label="Закрыть">×</button>
            <Cover game={open} className="modal-cover" />
            <div className="modal-body">
              <h2>{open.name}</h2>
              {open.parentId && (() => {
                const p = games.find(x => x.id === open.parentId)
                return p && (
                  <a className="back-btn" href={`#/g/${p.id}`} title={`Дополнение к игре «${p.name}»`}>
                    ← Дополнение к «{p.name}»
                  </a>
                )
              })()}
              {open.publisher && <p className="pub">{open.publisher}</p>}
              <div className="tags">{open.genres.map(t => <button key={t} onClick={() => { setGenre(t); close() }}>{t}</button>)}</div>
              <dl>
                <div><dt>Игроки</dt><dd>{players(open)}</dd></div>
                <div><dt>Партия</dt><dd>{open.timeLabel || '—'}</dd></div>
                <div><dt>Освоение</dt><dd>{open.learn || '—'}</dd></div>
                <div><dt>Сложность</dt><dd>{open.difficulty ? <Dots n={open.difficulty} /> : '—'}</dd></div>
                {open.owner && <div><dt>Владелец</dt><dd>{open.owner}</dd></div>}
              </dl>
              <p>{open.description}</p>
              {open.expansions?.length > 0 && (
                <div className="expansions">
                  <h3>Дополнения</h3>
                  {open.expansions.map(e => (
                    <a key={e.id} className="exp-card" href={`#/g/${e.id}`}>
                      <Cover game={e} className="exp-cover" noDefault />
                      <span className="exp-info">
                        <strong>{e.name}</strong>
                        {e.description && <small>{e.description}</small>}
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {(isUrl(open.rulesUrl) || isUrl(open.gameUrl) || SCRIPT_URL) && (
                <div className="btn-row">
                  {isUrl(open.rulesUrl) && <a className="btn" href={open.rulesUrl} target="_blank" rel="noreferrer">Читать правила</a>}
                  {isUrl(open.gameUrl) && <a className="btn ghost" href={open.gameUrl} target="_blank" rel="noreferrer">Подробнее об игре</a>}
                  {SCRIPT_URL && (
                    <button
                      className={'btn order-btn' + (isOrdered(open) || orderState[open.id] === 'sending' ? ' ghost' : '')}
                      disabled={isOrdered(open) || orderState[open.id] === 'sending'}
                      onClick={() => order(open)}
                    >
                      {isOrdered(open) ? '✓ Заказано' : orderState[open.id] === 'sending' ? 'Отправляем…' : orderState[open.id] === 'failed' ? 'Не вышло, попробуйте ещё раз' : 'Заказать игру'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        </div>
      )}

      {info && (
        <div className="overlay" onClick={() => setInfo(false)}>
          <article className="modal about" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="О сайте">
            <button className="x" onClick={() => setInfo(false)} aria-label="Закрыть">×</button>
            <div className="modal-body">
              <h2>О сайте</h2>
              <div className="about-block">
                <p>Нашли ошибку? Можно написать об этом тут:</p>
                <a className="btn" href={FORM_BUG} target="_blank" rel="noreferrer">Сообщить об ошибке</a>
              </div>
              <div className="about-block">
                <p>Хотите поиграть в определённую настолку? Напишите об этом в форме или нажмите кнопку «Заказать игру» в карточке игры.</p>
                <a className="btn" href={FORM_ORDER} target="_blank" rel="noreferrer">Заказать игру</a>
              </div>
              <div className="about-block">
                <p>Поучаствовать в разработке — репозиторий сайта на GitHub:</p>
                <a className="btn ghost" href={GITHUB} target="_blank" rel="noreferrer">GitHub · boardgames_list</a>
                <p className="contacts">Разработчик: <a href="https://t.me/rnpivovarov" target="_blank" rel="noreferrer">tg @rnpivovarov</a> · <a href="https://vk.ru/rnpivovarov" target="_blank" rel="noreferrer">vk rnpivovarov</a></p>
              </div>
              <p className="about-note">Сайт создан для улучшения игротек настольного клуба GEEKMÖ</p>
            </div>
          </article>
        </div>
      )}
    </>
  )
}
