/** Краткое относительное время на русском (для постов и комментариев). */
export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
