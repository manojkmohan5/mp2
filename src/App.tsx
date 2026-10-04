import { useEffect, useRef } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigationType } from 'react-router'
import DetailView from './DetailView.tsx'
import GalleryView from './GalleryView.tsx'
import ListView from './ListView.tsx'
import { useImages } from './images.ts'
import styles from './App.module.css'

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? styles.active : undefined)

export default function App() {
  const { state, retry } = useImages()
  const location = useLocation()
  const navigationType = useNavigationType()
  const main = useRef<HTMLElement>(null)
  const lastKey = useRef<string | undefined>(undefined)

  // Pages opened from a link start at the top. Back and Forward keep the browser's scroll position.
  useEffect(() => {
    if (navigationType === 'PUSH') window.scrollTo(0, 0)
  }, [location.key, navigationType])

  // When the control just used is gone after a page change (a clicked list item, "Clear filters"),
  // move focus to the main content so keyboard users don't start over at the top of the page.
  useEffect(() => {
    const changed = lastKey.current !== undefined && lastKey.current !== location.key
    lastKey.current = location.key
    if (changed && document.activeElement === document.body) main.current?.focus({ preventScroll: true })
  }, [location.key])

  return (
    <>
      {/* Focus <main> directly: following "#main" would add a history entry without the
          detail page's list context, so Previous/Next would lose their place. */}
      <a
        className={styles.skip}
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          main.current?.focus()
        }}
      >
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link to="/" className={styles.brand}>
            NASA Image Explorer
          </Link>
          <nav aria-label="Main">
            <ul className={styles.nav}>
              <li>
                <NavLink to="/" end className={navClass}>
                  Search
                </NavLink>
              </li>
              <li>
                <NavLink to="/gallery" className={navClass}>
                  Gallery
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" ref={main} tabIndex={-1} className={styles.main}>
        {state.status === 'loading' && <p role="status">Loading NASA images…</p>}
        {state.status === 'error' && (
          <div role="alert" className={styles.alert}>
            <p>We couldn't load images from NASA. Check your internet connection, then try again.</p>
            <button
              type="button"
              onClick={() => {
                retry()
                main.current?.focus() // the button disappears while loading
              }}
            >
              Try again
            </button>
          </div>
        )}
        {state.status === 'ready' && (
          <>
            {state.saved && (
              <p className={styles.notice}>
                NASA's image API isn't responding, so you're seeing a saved copy of the images.
              </p>
            )}
            <Routes>
              <Route path="/" element={<ListView images={state.images} />} />
              <Route path="/gallery" element={<GalleryView images={state.images} />} />
              <Route path="/image/:nasaId" element={<DetailView images={state.images} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </>
        )}
      </main>

      {/* Shown after loading, so it doesn't jump down the page when the content arrives. */}
      {state.status === 'ready' && (
        <footer className={styles.footer}>
          <p>
            Images and data from the <a href="https://images.nasa.gov">NASA Image and Video Library</a>. A CS 409
            student project, not affiliated with NASA.
          </p>
        </footer>
      )}
    </>
  )
}

function NotFound() {
  return (
    <>
      <title>Page not found · NASA Image Explorer</title>
      <h1>Page not found</h1>
      <p>
        <Link to="/">Go to search</Link>
      </p>
    </>
  )
}
