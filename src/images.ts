import axios from 'axios'
import { useEffect, useState } from 'react'

/** One NASA image, reduced to the fields this app shows. */
export interface NasaImage {
  id: string
  title: string
  date: string // ISO 8601, e.g. 1969-07-20T00:00:00Z
  center: string
  topic: string
  keywords: string[]
  description: string
  credit?: string
  location?: string
  thumbUrl: string
  imageUrl: string
}

export type SortKey = 'title' | 'date' | 'center'
export type SortOrder = 'asc' | 'desc'

// The parts of https://images-api.nasa.gov/search responses that this app reads.
interface SearchItem {
  data: {
    nasa_id: string
    title: string
    date_created: string
    center?: string
    keywords?: string[]
    description?: string
    photographer?: string
    secondary_creator?: string
    location?: string
  }[]
  links?: { href: string; rel: string; width?: number }[]
}

interface SearchResponse {
  collection: { items: SearchItem[] }
}

const SEARCH_URL = 'https://images-api.nasa.gov/search'
// Search terms chosen to return mission photos rather than event photos
// (plain "mars" mostly returns a festival in Mars, Pennsylvania).
const TOPICS = [
  { name: 'Apollo', q: 'apollo lunar surface' },
  { name: 'Mars', q: 'mars rover' },
  { name: 'Hubble', q: 'hubble' },
  { name: 'Earth', q: 'earth from space' },
]
const PER_TOPIC = 125
const TIMEOUT_MS = 15_000 // a stalled API falls back to the saved copy instead of loading forever

// A few NASA file names contain spaces.
const fixUrl = (href: string) => href.replaceAll(' ', '%20')

function toImage(item: SearchItem, topic: string): NasaImage | undefined {
  const data = item.data[0]
  const links = item.links ?? []
  const preview = links.find((link) => link.rel === 'preview')?.href
  if (!data || !preview) return undefined
  // Only sizes listed in `links` exist; guessing other sizes returns 403. Some images have no
  // large or medium size; then use the original file if it's a web format and not huge.
  const big =
    links.find((link) => link.href.includes('~large.')) ??
    links.find((link) => link.href.includes('~medium.')) ??
    links.find((link) => link.rel === 'canonical' && /\.(jpe?g|png)$/i.test(link.href) && (link.width ?? Infinity) <= 2000)
  return {
    id: data.nasa_id,
    // Some titles have stray spaces or line breaks, which would put them first in an A–Z sort.
    title: data.title.replace(/\s+/g, ' ').trim(),
    date: data.date_created,
    center: data.center ?? 'Unknown',
    topic,
    keywords: [...new Set(data.keywords ?? [])],
    description: data.description ?? '',
    credit: data.photographer ?? data.secondary_creator,
    location: data.location,
    thumbUrl: fixUrl(preview),
    imageUrl: fixUrl(big?.href ?? preview),
  }
}

/** Turns one search response per topic into a single list without duplicates. */
function collect(responses: SearchResponse[]): NasaImage[] {
  const byId = new Map<string, NasaImage>()
  responses.forEach((response, i) => {
    for (const item of response.collection.items) {
      const image = toImage(item, TOPICS[i].name)
      if (image && !byId.has(image.id)) byId.set(image.id, image)
    }
  })
  return [...byId.values()]
}

interface Loaded {
  images: NasaImage[]
  saved: boolean // true when showing the saved copy because NASA's API failed
}

let cache: Promise<Loaded> | undefined

/** Loads all topics once per visit. Falls back to a saved copy if NASA's API is down. */
export function loadImages(): Promise<Loaded> {
  if (!cache) {
    cache = Promise.all(
      TOPICS.map(({ q }) =>
        axios
          .get<SearchResponse>(SEARCH_URL, {
            params: { q, media_type: 'image', page_size: PER_TOPIC },
            timeout: TIMEOUT_MS,
          })
          .then((response) => response.data),
      ),
    )
      .then((responses) => ({ images: collect(responses), saved: false }))
      // The saved copy was made on 2026-10-04 with these same queries. Re-save it if TOPICS change.
      .catch(() =>
        axios
          .get<SearchResponse[]>(`${import.meta.env.BASE_URL}nasa-saved.json`)
          .then((response) => ({ images: collect(response.data), saved: true })),
      )
    cache.catch(() => {
      cache = undefined // lets "Try again" fetch again
    })
  }
  return cache
}

/** Fetches one image by NASA ID, for links to images outside the loaded set. */
export async function fetchImage(id: string): Promise<NasaImage | undefined> {
  const { data } = await axios.get<SearchResponse>(SEARCH_URL, { params: { nasa_id: id }, timeout: TIMEOUT_MS })
  const item = data.collection.items[0]
  return item ? toImage(item, '') : undefined
}

export type ImagesState = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & Loaded)

export function useImages() {
  const [state, setState] = useState<ImagesState>({ status: 'loading' })

  useEffect(() => {
    if (state.status !== 'loading') return
    let active = true
    loadImages().then(
      (loaded) => {
        if (active) setState({ status: 'ready', ...loaded })
      },
      () => {
        if (active) setState({ status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [state.status])

  return { state, retry: () => setState({ status: 'loading' }) }
}

/** Case-insensitive. Every word must appear in the title or in a keyword. */
export function searchImages(images: NasaImage[], query: string): NasaImage[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return images
  return images.filter((image) => {
    const text = [image.title, ...image.keywords].join('\n').toLowerCase()
    return words.every((word) => text.includes(word))
  })
}

export function sortImages(images: NasaImage[], key: SortKey, order: SortOrder): NasaImage[] {
  const direction = order === 'asc' ? 1 : -1
  // Dates are ISO strings, so comparing them as text also orders them by time. Ties sort by title.
  return [...images].sort((a, b) => direction * (a[key].localeCompare(b[key]) || a.title.localeCompare(b.title)))
}

/** Empty selection = no filter. OR within a group, AND across groups. */
export function filterImages(images: NasaImage[], topics: string[], centers: string[]): NasaImage[] {
  return images.filter(
    (image) =>
      (topics.length === 0 || topics.includes(image.topic)) &&
      (centers.length === 0 || centers.includes(image.center)),
  )
}

/** Previous and next IDs around `id`, wrapping at both ends. */
export function neighbors(ids: string[], id: string) {
  const i = ids.indexOf(id)
  if (i === -1 || ids.length < 2) return undefined
  const n = ids.length
  return { prev: ids[(i - 1 + n) % n], next: ids[(i + 1) % n], position: i + 1, total: n }
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
