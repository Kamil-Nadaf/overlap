import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../themes/ThemeContext';
import { FeedbackButton } from './Feedback';
import { Eye, EyeOff, Github, Logo, Moon, Plus, Sun } from './icons';

export function Layout({ children }: { children: ReactNode }) {
  const t = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <img
        src={t.scene.src}
        alt=""
        className="fixed inset-0 h-full w-full object-cover transition-opacity duration-500"
        style={{ objectPosition: t.scene.pos }}
      />
      <div
        className="pointer-events-none fixed inset-0 transition-colors duration-500"
        style={{
          background: t.night
            ? 'rgba(10,18,40,0.5)'
            : 'linear-gradient(180deg, rgba(246,234,208,0) 55%, rgba(246,234,208,0.3) 100%)',
        }}
      />

      <div className={`relative z-10 flex min-h-screen flex-col transition-opacity duration-300 ${t.peek ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <header className="flex items-center justify-between gap-2 px-4 py-3 sm:px-8 sm:py-4">
          <Link to="/" className="pill flex shrink-0 items-center gap-2 py-1 pl-2.5 pr-3 text-ink no-underline sm:py-1.5 sm:pl-3 sm:pr-4">
            <Logo size={28} />
            <span className="font-display text-2xl font-bold leading-none">Overlap</span>
          </Link>
          <nav aria-label="Main" className="pill flex items-center gap-0 px-1 py-0.5 text-base font-medium sm:gap-1 sm:px-2 sm:py-1 sm:text-lg">
            <Link to="/" className="hidden rounded-full px-2 py-1.5 text-ink no-underline hover:bg-accent/10 sm:inline sm:px-3">
              Home
            </Link>
            <Link to="/new" className="whitespace-nowrap rounded-full px-2 py-1.5 text-ink no-underline hover:bg-accent/10 sm:px-3">
              New event
            </Link>
            <FeedbackButton />
            <a
              href="https://github.com/Kamil-Nadaf/overlap"
              aria-label="GitHub"
              className="flex items-center gap-2 rounded-full px-2 py-1.5 text-ink no-underline hover:bg-accent/10 sm:px-3"
            >
              <Github /> <span className="hidden sm:inline">GitHub</span>
            </a>
          </nav>
        </header>
        <main className="flex flex-1 flex-col pb-28">{children}</main>
      </div>

      {/* Scene dock: always visible, even while peeking */}
      <div className="fixed inset-x-0 bottom-3 z-20 flex justify-center px-3 lg:justify-start lg:pl-8">
        <div className="pill flex max-w-full flex-wrap items-center justify-center gap-2 py-1.5 pl-4 pr-2">
          <span className="hidden text-xs font-bold uppercase tracking-wider text-ink-soft sm:inline">Scene</span>
          {t.scenes.length > 1 &&
            t.scenes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => t.setScene(s.id)}
                aria-label={s.name}
                aria-pressed={s.id === t.scene.id}
                title={s.name}
                className="size-10 cursor-pointer overflow-hidden rounded-full bg-field p-0 transition-transform hover:-translate-y-0.5"
                style={{ border: s.id === t.scene.id ? '3px solid var(--color-accent)' : '2px solid var(--color-edge)' }}
              >
                <img src={s.src} alt="" className="size-full object-cover" style={{ objectPosition: s.pos }} />
              </button>
            ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-accent bg-transparent px-3 py-2 text-sm font-bold text-accent"
          >
            <Plus /> Your image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Choose a background image"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void t.setCustomImage(f).catch((err: Error) => alert(err.message));
              e.target.value = '';
            }}
          />
          {t.scenes.some((s) => s.id === 'custom') && (
            <button type="button" onClick={t.clearCustom} className="cursor-pointer rounded-full border-0 bg-transparent px-2 py-2 text-sm font-bold text-ink-soft underline">
              Use default
            </button>
          )}
          <span className="mx-1 h-6 w-px bg-edge" aria-hidden="true" />
          <button
            type="button"
            onClick={t.toggleNight}
            aria-pressed={t.night}
            aria-label="Toggle night"
            title="Day / night"
            className="flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink hover:bg-accent/10"
          >
            {t.night ? <Sun /> : <Moon />}
          </button>
          <button
            type="button"
            onClick={t.togglePeek}
            aria-pressed={t.peek}
            className="flex cursor-pointer items-center gap-2 rounded-full border-0 bg-accent px-4 py-2 text-sm font-bold text-field"
          >
            {t.peek ? <EyeOff /> : <Eye />} {t.peek ? 'Show page' : 'View scene'}
          </button>
        </div>
      </div>
    </div>
  );
}
