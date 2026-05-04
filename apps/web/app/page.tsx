import Link from "next/link";
import { ArrowUpRight, Bookmark, Compass, MapPin, Sparkles } from "lucide-react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

const marqueeMoves = [
  "Guapea",
  "Enchufla",
  "Dile que no",
  "Setenta",
  "Siete",
  "Ocho",
  "Vacila",
  "Sombrero",
  "Adiós con la prima",
  "Coca-Cola",
  "Patin",
  "Kentucky",
];

const labMoves = [
  { name: "guapea", time: "0:00 — 0:08", conf: "clean" },
  { name: "enchufla", time: "0:08 — 0:17", conf: "review" },
  { name: "dile que no", time: "0:17 — 0:28", conf: "clean" },
  { name: "siete", time: "0:28 — 0:37", conf: "beta" },
];

const libraryCards = [
  { title: "Mario & Yanek — Casino at Salsa con Timba", duration: "4:12", saved: true },
  { title: "Anya Katsevman — Setenta Variations", duration: "6:48", saved: false },
  { title: "Yoyo Flow — Footwork Drill 03", duration: "2:31", saved: true },
];

const upcomingEvents = [
  { name: "Salsa con Sabor", venue: "Logan Sq., Chicago", when: "Wed · 9PM" },
  { name: "Rueda en el Parque", venue: "Lincoln Park", when: "Sat · 6PM" },
  { name: "La Havana Social", venue: "West Loop", when: "Fri · 10PM" },
];

export default function Home() {
  return (
    <main>
      <header className="site-header reveal d-1">
        <Link className="brand" href="/">
          <span className="brand-glyph">d</span>
          <span>DanceStep</span>
          <sup>est. 26</sup>
        </Link>

        <nav className="nav" aria-label="Main">
          <a href="#library">Library</a>
          <a href="#scene">The Scene</a>
          <a href="#lab">The Lab</a>
          <a href="#manifesto">Manifesto</a>
        </nav>

        <div className="header-auth">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="btn" type="button">
                Enter the Floor
                <ArrowUpRight size={16} strokeWidth={1.6} />
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link className="btn btn-ghost" href="/library">
              Library
            </Link>
            <UserButton />
          </Show>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="hero">
        <div>
          <div className="hero-meta reveal d-1">
            <span className="dot" />
            <span className="mono">Vol. 01 · Spring '26 · Chicago Edition</span>
          </div>

          <h1 className="reveal d-2">
            The whole<br />
            <span className="tilt"><em>dance</em>&nbsp;floor,</span><br />
            in one place.
          </h1>

          <p className="hero-lede reveal d-3">
            A home for <em>Cuban Casino</em> and Latin dancers — search and bookmark
            videos, find the next social on the map, and break down a clip move
            by move when you can&apos;t shake it from your head.
          </p>

          <div className="hero-actions reveal d-4">
            <Show when="signed-out">
              <Link className="btn" href="/sign-up">
                Enter the Floor
                <ArrowUpRight size={16} strokeWidth={1.6} />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link className="btn" href="/library">
                Open the Library
                <ArrowUpRight size={16} strokeWidth={1.6} />
              </Link>
            </Show>
            <a className="btn btn-ghost" href="#rooms">
              The three rooms
            </a>
          </div>

          <div className="hero-foot reveal d-5">
            <Sparkles size={16} strokeWidth={1.4} />
            <span>
              Library &amp; scene live now · <span className="mono">The Lab</span> is
              an experimental research preview.
            </span>
          </div>
        </div>

        <div className="reveal d-3" aria-hidden>
          <div className="collage">
            <span className="ornament asterisk-1">✻</span>
            <span className="ornament dot-grid" />

            <div className="collage-tape" />

            {/* Back: Lab */}
            <div className="collage-card collage-lab">
              <div className="lab-head">
                <span className="eyebrow">The Lab · Beta</span>
                <em>0:37</em>
              </div>
              <div className="lab-track">
                <span className="a">guap.</span>
                <span className="b">ench.</span>
                <span className="c">dile</span>
                <span className="d">siete</span>
              </div>
              <ul>
                {labMoves.map((m) => (
                  <li key={m.name}>
                    <span className="name">{m.name}</span>
                    <span className="t">{m.time}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Middle: Scene */}
            <div className="collage-card collage-scene">
              <div className="scene-head">
                <span className="eyebrow">The Scene</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>
                  4 tonight
                </span>
              </div>
              <h4>Chicago · this week</h4>
              <div className="map">
                <span className="pin p1" />
                <span className="pin p2" />
                <span className="pin p3" />
                <span className="pin p4" />
              </div>
              <div className="events">
                <div>
                  <span className="name">Salsa con Sabor</span>
                  <span className="when">Wed 9PM</span>
                </div>
                <div>
                  <span className="name">Rueda en el Parque</span>
                  <span className="when">Sat 6PM</span>
                </div>
              </div>
            </div>

            {/* Front: Library */}
            <div className="collage-card collage-lib">
              <div className="thumb">
                <span className="tri" />
                <span className="duration">4:12</span>
              </div>
              <div className="meta">
                <h4>Mario &amp; Yanek — Salsa con Timba</h4>
                <div className="row">
                  <span>Casino · Festival</span>
                  <span className="saved">★ Saved</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[...marqueeMoves, ...marqueeMoves].map((m, i) => (
            <span key={i}>
              {i % 3 === 1 ? <em>{m}</em> : m}
            </span>
          ))}
        </div>
      </div>

      {/* ============ THREE ROOMS ============ */}
      <section className="section" id="rooms">
        <div className="section-head">
          <h2 className="reveal d-1">
            Three rooms,<br />
            <em>one floor.</em>
          </h2>
          <p className="lede reveal d-2">
            DanceStep is built like a venue. The Library holds the videos you
            keep coming back to. The Scene shows you where everyone&apos;s
            dancing this weekend. The Lab is the back room where we&apos;re
            experimenting with breaking down what you film.
          </p>
        </div>

        <div className="rooms">
          {/* Library */}
          <article className="room library reveal d-1" id="library">
            <span className="roman" aria-hidden>I</span>
            <span className="eyebrow">The Library · Live</span>
            <h3>Search, save, and<br /><i>arrange</i> the videos<br />you study from.</h3>
            <p>
              Search YouTube without leaving the floor. Bookmark anything that
              caught your eye, organize favorites into named playlists, and come
              back when you&apos;re ready to drill.
            </p>

            <div className="library-vinyl">
              {libraryCards.map((c) => (
                <div className="card" key={c.title}>
                  <div className="img" />
                  <div className="label">
                    <span>{c.duration}</span>
                    {c.saved && <span className="pill">Saved</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="room-foot">
              <span><Bookmark size={14} strokeWidth={1.6} style={{ verticalAlign: "-2px", marginRight: 8 }} />Bookmarks · Playlists</span>
              <span className="arrow"><ArrowUpRight size={16} strokeWidth={1.4} /></span>
            </div>
          </article>

          {/* Scene */}
          <article className="room scene reveal d-2" id="scene">
            <span className="roman" aria-hidden>II</span>
            <span className="eyebrow on-dark">The Scene · Chicago</span>
            <h3>Find the next social <i>before</i> the song&nbsp;ends.</h3>
            <p>
              A live map of the local scene — socials, festivals, classes, and
              one-off rueda nights. Launching in Chicago, expanding city by city.
            </p>

            <div className="scene-stage">
              <span className="pin p1" data-label="Logan Sq" />
              <span className="pin p2" data-label="W. Loop" />
              <span className="pin p3" data-label="Lincoln" />
              <span className="pin p4" data-label="Pilsen" />
            </div>

            <div className="room-foot">
              <span><MapPin size={14} strokeWidth={1.6} style={{ verticalAlign: "-2px", marginRight: 8 }} />4 events tonight</span>
              <span className="arrow"><ArrowUpRight size={16} strokeWidth={1.4} /></span>
            </div>
          </article>

          {/* Lab — full width */}
          <article className="room lab reveal d-3" id="lab">
            <span className="experimental-tag">Experimental</span>
            <div className="lab-copy">
              <span className="roman" aria-hidden>III</span>
              <span className="eyebrow on-dark">The Lab · Research preview</span>
              <h3>Upload a Casino clip.<br />Get it back in <i>moves</i>.</h3>
              <p>
                Pose tracking and a vision model attempt to name every atomic
                move in your clip — guapea, enchufla, dile que no, siete — and
                lay them on a timeline you can replay at quarter speed.
                Accuracy is honest about uncertainty: clean, review, beta.
              </p>
              <div className="room-foot">
                <span><Sparkles size={14} strokeWidth={1.6} style={{ verticalAlign: "-2px", marginRight: 8 }} />Move-by-move breakdown</span>
                <span className="arrow"><ArrowUpRight size={16} strokeWidth={1.4} /></span>
              </div>
            </div>

            <div className="lab-preview">
              <div className="preview-head">
                <span className="name">Rueda social · 0:37</span>
                <span className="eyebrow on-dark">Beta labels</span>
              </div>
              <div className="preview-bar">
                <div className="s1">guapea</div>
                <div className="s2">enchufla</div>
                <div className="s3">dile que no</div>
                <div className="s4">siete</div>
              </div>
              <div className="preview-list">
                {labMoves.map((m) => (
                  <div className="row" key={m.name}>
                    <span className="name">{m.name}</span>
                    <span className="conf">{m.time} · {m.conf}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ============ MANIFESTO ============ */}
      <section className="manifesto" id="manifesto">
        <div className="manifesto-inner">
          <span className="eyebrow on-dark bullet reveal d-1">A note from the desk</span>
          <blockquote className="reveal d-2">
            Built by a dancer for the dancers who want <em>more</em> than a Tuesday class — a place to <span className="terra">study</span>, <span className="terra">find each other</span>, and chase the move you couldn&apos;t&nbsp;forget.
          </blockquote>
          <cite className="reveal d-3">Enrique · Chicago · 2026</cite>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="finale">
        <div className="ornament-sun" aria-hidden />
        <span className="eyebrow bullet reveal d-1">Open the doors</span>
        <h2 className="reveal d-2">
          Step onto the<br /><em>floor.</em>
        </h2>
        <p className="reveal d-3">
          The library, the map, and the lab — one place, one account, no Tuesdays required.
        </p>
        <div className="actions reveal d-4">
          <Show when="signed-out">
            <Link className="btn" href="/sign-up">
              Enter the Floor
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </Link>
          </Show>
          <Show when="signed-in">
            <Link className="btn" href="/library">
              Open the Library
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </Link>
          </Show>
          <a className="btn btn-ghost" href="#rooms">
            <Compass size={16} strokeWidth={1.6} />
            Tour the rooms
          </a>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="footer">
        <div className="brand-block">
          Dance<em>Step</em>.
        </div>
        <div className="meta">
          <div>
            <strong>Cities</strong>
            <a href="#">Chicago</a><br />
            <a href="#">— Havana (soon)</a><br />
            <a href="#">— NYC (soon)</a>
          </div>
          <div>
            <strong>Rooms</strong>
            <a href="#library">Library</a><br />
            <a href="#scene">The Scene</a><br />
            <a href="#lab">The Lab</a>
          </div>
          <div>
            <strong>About</strong>
            <a href="#manifesto">Manifesto</a><br />
            <a href="#">Privacy</a><br />
            <a href="#">Contact</a>
          </div>
          <div>
            <strong>© 2026</strong>
            Made with cariño<br />
            in Chicago.
          </div>
        </div>
      </footer>
    </main>
  );
}
