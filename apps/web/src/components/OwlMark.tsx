/**
 * OwlMark — фирменный знак Warmingtea (сова-маскот).
 *
 * Цвета берутся из дизайн-токенов и автоматически адаптируются к теме:
 *  - тело/ушки/зрачки = var(--brand)  (тёмный хвойный на светлой, светлый — на тёмной)
 *  - глаза/блики      = var(--bg-base) (всегда контрастируют с телом)
 *  - клюв             = var(--accent)  (янтарь)
 *
 * Для фиксированных контекстов (фавикон, иконка приложения) цвета можно
 * переопределить пропсами body/eye/beak.
 */
interface OwlMarkProps {
  size?: number;
  className?: string;
  title?: string;
  /** Цвет тела/ушек/зрачков. По умолчанию — var(--brand). */
  body?: string;
  /** Цвет глаз/бликов. По умолчанию — var(--bg-base). */
  eye?: string;
  /** Цвет клюва. По умолчанию — var(--accent). */
  beak?: string;
}

export function OwlMark({
  size = 28,
  className,
  title = 'Warmingtea',
  body = 'var(--brand)',
  eye = 'var(--bg-base)',
  beak = 'var(--accent)',
}: OwlMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
    >
      <path d="M14.5 3 L18.5 11 L11.5 11 Z" fill={body} />
      <path d="M33.5 3 L36.5 11 L29.5 11 Z" fill={body} />
      <path d="M24 7 C32.5 7 38 13.5 38 23 C38 34 31.5 42 24 42 C16.5 42 10 34 10 23 C10 13.5 15.5 7 24 7 Z" fill={body} />
      <circle cx="16.6" cy="22" r="7" fill={eye} />
      <circle cx="31.4" cy="22" r="7" fill={eye} />
      <circle cx="17.6" cy="22.6" r="3.1" fill={body} />
      <circle cx="30.4" cy="22.6" r="3.1" fill={body} />
      <circle cx="16.4" cy="21.4" r="1.05" fill={eye} />
      <circle cx="29.2" cy="21.4" r="1.05" fill={eye} />
      <path d="M24 25.5 L21.7 27.6 Q24 29 26.3 27.6 Z" fill={beak} />
    </svg>
  );
}
