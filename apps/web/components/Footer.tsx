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
          <a href="/library">Library</a><br />
          <a href="/scene">The Scene</a><br />
          <a href="/upload">The Lab</a>
        </div>
        <div>
          <strong>About</strong>
          <a href="/#manifesto">Manifesto</a><br />
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
