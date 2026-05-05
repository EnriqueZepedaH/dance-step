import Link from "next/link";

export function Footer() {
  return (
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
          <Link href="/library">Library</Link><br />
          <Link href="/scene">The Scene</Link><br />
          <Link href="/upload">The Lab</Link>
        </div>
        <div>
          <strong>About</strong>
          <Link href="/#manifesto">Manifesto</Link><br />
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
  );
}
