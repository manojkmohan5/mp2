import { useEffect, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { formatDate, searchImages, sortImages, type NasaImage, type SortKey, type SortOrder } from './images.ts'
import styles from './ListView.module.css'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'date', label: 'Date' },
  { key: 'center', label: 'NASA center' },
]

export default function ListView({ images }: { images: NasaImage[] }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const searchBox = useRef<HTMLInputElement>(null)
  const query = params.get('q') ?? ''
  const sort = SORT_OPTIONS.find((option) => option.key === params.get('sort'))?.key ?? 'title'
  const order: SortOrder = params.get('order') === 'desc' ? 'desc' : 'asc'

  // Search and sort live in the URL, so Back from a detail page restores them.
  // Start from the browser's URL, not `params`: React Router renders URL changes as
  // low-priority updates, so `params` can lag behind quick back-to-back changes.
  // Replace instead of push, so typing doesn't fill the Back button history.
  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(window.location.search)
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }

  // For the same reason the search box isn't bound to `query` (that dropped fast keystrokes).
  // When the URL changes another way, such as the Search link, show the new query in the box.
  useEffect(() => {
    const box = searchBox.current
    if (box && box !== document.activeElement) box.value = query
  }, [query])

  const results = sortImages(searchImages(images, query), sort, order)
  // The detail page steps through exactly this list with Previous and Next.
  const linkState = { ids: results.map((image) => image.id), from: location.pathname + location.search }

  return (
    <>
      <title>Search · NASA Image Explorer</title>
      <h1>Search NASA images</h1>
      <p className={styles.intro}>
        {images.length} NASA photos: Apollo on the Moon, Mars rovers, Hubble, and Earth from space.
      </p>

      <div className={styles.controls}>
        <label className={styles.search}>
          Search by title or keyword
          <input
            ref={searchBox}
            type="search"
            name="q"
            defaultValue={query}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder="Try moon, rover or nebula"
          />
        </label>
        <label>
          Sort by
          <select name="sort" value={sort} onChange={(event) => setParam('sort', event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort order
          <select name="order" value={order} onChange={(event) => setParam('order', event.target.value)}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>

      <p role="status" className={styles.count}>
        {results.length} {results.length === 1 ? 'result' : 'results'}
      </p>

      {results.length === 0 ? (
        <p>No images match “{query}”. Try a different word.</p>
      ) : (
        <ol className={styles.list}>
          {results.map((image) => (
            <li key={image.id}>
              <Link className={styles.row} to={`/image/${encodeURIComponent(image.id)}`} state={linkState}>
                <img className={styles.thumb} src={image.thumbUrl} alt={image.title} loading="lazy" decoding="async" />
                <span className={styles.text}>
                  <span className={styles.title}>{image.title}</span>
                  <span className={styles.meta}>
                    <time dateTime={image.date}>{formatDate(image.date)}</time> · {image.center} · {image.topic}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
