import { Fragment, useEffect, useMemo, useState } from 'react'

const BASE = import.meta.env.BASE_URL
const DEFAULT_IMG = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREUb6gYA6ne8sBfhrmaNRS5OVSKkkG68_AeMBL15BF4Q&s=10'
const FALLBACK = BASE + 'placeholder.svg'
const PER_PAGE = 24

// hash может прийти percent-кодированным (#/g/%D1%82...) — декодируем и сравниваем с id
const hashId = () => {
  const m = location.hash.match(/^#\/g\/(.+)$/)
  if (!m) return undefined
  try { return decodeURIComponent(m[1]) } catch { return m[1] }
}
const players = g => g.playersMin ? (g.playersMax && g.playersMax !== g.playersMin ? `${g.playersMin}–${g.playersMax}` : g.playersMin) : '—'

function Cover({ game, className }) {
  const first = game.image || DEFAULT_IMG
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
  const [openId, setOpenId] = useState(hashId())
  const [page, setPage] = useState(1)

  const close = () => { history.pushState(null, '', location.pathname + location.search); setOpenId(undefined) }

  useEffect(() => { fetch(BASE + 'games.json').then(r => r.json()).then(setGames) }, [])
  useEffect(() => {
    const h = () => setOpenId(hashId())
    const k = e => e.key === 'Escape' && close()
    addEventListener('hashchange', h); addEventListener('keydown', k)
    return () => { removeEventListener('hashchange', h); removeEventListener('keydown', k) }
  }, [])
  // при смене фильтров — на первую страницу
  useEffect(() => { setPage(1) }, [q, count, diff, genre])

  const genres = useMemo(() => [...new Set(games.flatMap(g => g.genres))].sort(), [games])
  const list = useMemo(() => games.filter(g =>
    (!q || (g.name + g.description + g.publisher).toLowerCase().includes(q.toLowerCase())) &&
    (!count || (g.playersMin <= +count && +count <= (g.playersMax || g.playersMin))) &&
    (!diff || g.difficulty === +diff) &&
    (!genre || g.genres.includes(genre))
  ), [games, q, count, diff, genre])

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const cur = Math.min(page, pages)
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE)

  const open = games.find(g => g.id === openId)

  const goto = p => { setPage(p); window.scrollTo(0, 0) }
  // номера страниц: первая, последняя и соседние с текущей, между ними «…»
  const nums = [...new Set([1, pages, cur - 1, cur, cur + 1].filter(p => p >= 1 && p <= pages))].sort((a, b) => a - b)

  return (
    <>
      <header className="hero">
        <h1>Игротека</h1>
        <p>{games.length ? `${games.length} настолок. Найдите игру под вашу компанию.` : 'Загружаем игры…'}</p>
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
          <select value={genre} onChange={e => setGenre(e.target.value)}>
            <option value="">Любой жанр</option>
            {genres.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
      </header>

      <main>
        {games.length > 0 && list.length === 0 && <p className="empty">Ничего не найдено. Попробуйте убрать один из фильтров.</p>}
        <div className="grid">
          {shown.map(g => (
            <a key={g.id} className="card" href={`#/g/${g.id}`}>
              <Cover game={g} className="cover" />
              <div className="body">
                <h2>{g.name}</h2>
                <div className="meta"><span>{players(g)} игр.</span><span>{g.timeLabel || '—'}</span>{g.difficulty && <Dots n={g.difficulty} />}</div>
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
              {open.publisher && <p className="pub">{open.publisher}</p>}
              <div className="tags">{open.genres.map(t => <button key={t} onClick={() => { setGenre(t); close() }}>{t}</button>)}</div>
              <dl>
                <div><dt>Игроки</dt><dd>{players(open)}</dd></div>
                <div><dt>Партия</dt><dd>{open.timeLabel || '—'}</dd></div>
                <div><dt>Освоение</dt><dd>{open.learn || '—'}</dd></div>
                <div><dt>Сложность</dt><dd>{open.difficulty ? <Dots n={open.difficulty} /> : '—'}</dd></div>
              </dl>
              <p>{open.description}</p>
              {open.rulesUrl.startsWith('http') && <a className="btn" href={open.rulesUrl} target="_blank" rel="noreferrer">Читать правила</a>}
            </div>
          </article>
        </div>
      )}
    </>
  )
}
