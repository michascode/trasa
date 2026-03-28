import { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Trasa</h2>
        <nav>
          <Link to="/">Start</Link>
          <Link to="/app">Aplikacja</Link>
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
