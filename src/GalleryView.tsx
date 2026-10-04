import { Link, useLocation, useSearchParams } from 'react-router'
import { filterImages, type NasaImage } from './images.ts'
import styles from './GalleryView.module.css'

/** [value, count] pairs, most common first. */
function countBy(images: NasaImage[], pick: (image: NasaImage) => string): [string, number][] {
  const counts = new Map<string, number>()
  for (const image of images) counts.set(pick(image), (counts.get(pick(image)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export default function GalleryView({ images }: { images: NasaImage[] }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const topics = params.getAll('topic')
  const centers = params.getAll('center')
  const groups = [
    { name: 'topic', legend: 'Topic', selected: topics, options: countBy(images, (image) => image.topic) },
    { name: 'center', legend: 'NASA center', selected: centers, options: countBy(images, (image) => image.center) },
  ]

  // Filters live in the URL (e.g. ?topic=Mars&topic=Hubble), so Back from a detail page restores them.
  // Start from the browser's URL, not `params`, which can lag behind quick clicks (see ListView).
  const toggle = (name: string, value: string) => {
    const next = new URLSearchParams(window.location.search)
    const values = next.getAll(name)
    next.delete(name)
    const updated = values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
    for (const v of updated) next.append(name, v)
    setParams(next, { replace: true })
  }

  const shown = filterImages(images, topics, centers)
  // The detail page steps through exactly these images with Previous and Next.
  const linkState = { ids: shown.map((image) => image.id), from: location.pathname + location.search }

  return (
    <>
      <title>Gallery · NASA Image Explorer</title>
      <h1>Gallery</h1>
      <p className={styles.intro}>Pick one or more filters. With nothing picked, you see every image.</p>

      <div className={styles.filters}>
        {groups.map((group) => (
          <fieldset key={group.name} className={styles.group}>
            <legend>{group.legend}</legend>
            {group.options.map(([value, count]) => (
              <label key={value} className={styles.chip}>
                <input
                  type="checkbox"
                  name={group.name}
                  value={value}
                  checked={group.selected.includes(value)}
                  onChange={() => toggle(group.name, value)}
                />
                {value} ({count})
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      <div className={styles.summary}>
        <p role="status">
          Showing {shown.length} of {images.length} images
        </p>
        {(topics.length > 0 || centers.length > 0) && (
          <button type="button" onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p>No images match these filters. Remove one to see more.</p>
      ) : (
        <ul className={styles.grid}>
          {shown.map((image) => (
            <li key={image.id}>
              <Link className={styles.card} to={`/image/${encodeURIComponent(image.id)}`} state={linkState}>
                <img src={image.thumbUrl} alt={image.title} loading="lazy" decoding="async" />
                <span className={styles.caption}>{image.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
