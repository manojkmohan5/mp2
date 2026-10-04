import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { fetchImage, formatDate, neighbors, sortImages, type NasaImage } from './images.ts'
import styles from './DetailView.module.css'

// Set by links in the list and gallery: the IDs on screen, in order, and the page to go back to.
interface LinkState {
  ids?: string[]
  from?: string
}

// Some NASA descriptions contain HTML links and entities like &amp;. Show them as plain text.
const plainText = (html: string) =>
  (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').trim()

const detailPath = (id: string) => `/image/${encodeURIComponent(id)}`

export default function DetailView({ images }: { images: NasaImage[] }) {
  const { nasaId = '' } = useParams()
  const linkState = useLocation().state as LinkState | null
  const known = images.find((image) => image.id === nasaId)
  const [lookup, setLookup] = useState<{ id: string; image?: NasaImage; failed?: boolean }>()

  // A shared link can point to any NASA image, not only the loaded ones, so fetch unknown IDs.
  useEffect(() => {
    if (known) return
    let active = true
    fetchImage(nasaId).then(
      (image) => {
        if (active) setLookup({ id: nasaId, image })
      },
      () => {
        if (active) setLookup({ id: nasaId, failed: true })
      },
    )
    return () => {
      active = false
    }
  }, [nasaId, known])

  const image = known ?? (lookup?.id === nasaId ? lookup.image : undefined)
  if (!image) {
    if (lookup?.id !== nasaId) return <p role="status">Loading image…</p>
    if (lookup.failed) {
      return (
        <>
          <title>Image unavailable · NASA Image Explorer</title>
          <h1>Couldn't load this image</h1>
          <p role="alert">
            NASA's image API didn't respond. Check your internet connection, then reload the page.{' '}
            <Link to="/">Go to search</Link>
          </p>
        </>
      )
    }
    return (
      <>
        <title>Image not found · NASA Image Explorer</title>
        <h1>Image not found</h1>
        <p>
          NASA has no image with the ID “{nasaId}”. <Link to="/">Go to search</Link>
        </p>
      </>
    )
  }

  // Opened without list context (for example, a pasted link): step through all images in the
  // Search page's default order (title A–Z), which is also where "Back to search results" goes.
  const ids = Array.isArray(linkState?.ids)
    ? linkState.ids
    : sortImages(images, 'title', 'asc').map((item) => item.id)
  const from = typeof linkState?.from === 'string' && /^\/(?!\/)/.test(linkState.from) ? linkState.from : '/'
  const pager = neighbors(ids, image.id)
  const pagerState = { ids, from }

  return (
    <article>
      <title>{`${image.title} · NASA Image Explorer`}</title>
      <div className={styles.topbar}>
        <Link to={from}>
          <span aria-hidden="true">← </span>Back to {from.startsWith('/gallery') ? 'gallery' : 'search results'}
        </Link>
        {pager && (
          <nav aria-label="Previous and next image" className={styles.pager}>
            <Link className={styles.step} to={detailPath(pager.prev)} state={pagerState}>
              <span aria-hidden="true">← </span>Previous
            </Link>
            <span>
              {pager.position} of {pager.total}
            </span>
            <Link className={styles.step} to={detailPath(pager.next)} state={pagerState}>
              Next<span aria-hidden="true"> →</span>
            </Link>
          </nav>
        )}
      </div>

      <div className={styles.layout}>
        {/* key: a new <img> per image, so Next never shows the old photo while the new one loads */}
        <img key={image.id} className={styles.photo} src={image.imageUrl} alt={image.title} />
        <div>
          <h1 className={styles.heading}>{image.title}</h1>
          <dl className={styles.facts}>
            <dt>Date</dt>
            <dd>
              <time dateTime={image.date}>{formatDate(image.date)}</time>
            </dd>
            <dt>NASA center</dt>
            <dd>{image.center}</dd>
            {image.topic && (
              <>
                <dt>Topic</dt>
                <dd>{image.topic}</dd>
              </>
            )}
            {image.credit && (
              <>
                <dt>Credit</dt>
                <dd>{plainText(image.credit)}</dd>
              </>
            )}
            {image.location && (
              <>
                <dt>Location</dt>
                <dd>{plainText(image.location)}</dd>
              </>
            )}
            <dt>NASA ID</dt>
            <dd>{image.id}</dd>
          </dl>

          {image.keywords.length > 0 && (
            <>
              <h2>Keywords</h2>
              <ul className={styles.keywords}>
                {image.keywords.map((keyword) => (
                  <li key={keyword}>
                    <Link to={`/?q=${encodeURIComponent(keyword)}`}>{keyword}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2>Description</h2>
          <p className={styles.description}>{plainText(image.description) || 'No description provided.'}</p>
          <p>
            <a href={`https://images.nasa.gov/details/${encodeURIComponent(image.id)}`} target="_blank" rel="noreferrer">
              View on images.nasa.gov<span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </p>
        </div>
      </div>

      {/* Previous/Next keep focus on the button, so announce the new image to screen readers. */}
      {pager && (
        <p className="visually-hidden" role="status">
          {`${image.title}, image ${pager.position} of ${pager.total}`}
        </p>
      )}
    </article>
  )
}
