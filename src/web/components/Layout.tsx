import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

const THEME_KEY = 'cvtool.theme';

function initialDarkMode(): boolean {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'dark') {
      return true;
    }
    if (stored === 'light') {
      return false;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function Layout() {
  const [dark, setDark] = useState(initialDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    try {
      window.localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      // El tema no se puede persistir; se mantiene en memoria.
    }
  }, [dark]);

  const navClass = ({ isActive }: { isActive: boolean }): string =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-slate-900 text-white'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            cv-tool
          </Link>
          <nav className="flex items-center gap-1" aria-label="Navegación principal">
            <NavLink to="/" end className={navClass}>
              Inicio
            </NavLink>
            <NavLink to="/perfil" className={navClass}>
              Perfil
            </NavLink>
            <NavLink to="/postulaciones/nueva" className={navClass}>
              Nueva
            </NavLink>
            <NavLink to="/tracker" className={navClass}>
              Tracker
            </NavLink>
            <NavLink to="/ajustes" className={navClass}>
              Ajustes
            </NavLink>
            <button
              type="button"
              onClick={() => setDark((current) => !current)}
              aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              {dark ? 'Claro' : 'Oscuro'}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-4xl px-6 pb-10 text-xs leading-6 text-slate-500">
        <p>
          El servidor escucha solo en <code className="font-mono">127.0.0.1</code>. Los datos no
          salen de tu computadora, salvo el contenido que envíes al proveedor de IA que elijas.
        </p>
      </footer>
    </div>
  );
}
