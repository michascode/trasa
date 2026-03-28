import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <section>
      <h1>Trasa Foundation</h1>
      <p>Podstawowa wersja aplikacji do zarządzania i optymalizacji tras.</p>
      <Link to="/app">Przejdź do aplikacji</Link>
    </section>
  );
}
