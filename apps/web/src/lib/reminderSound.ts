/**
 * Звук foreground-напоминания. Из-за autoplay-политики браузера `Audio.play()`,
 * вызванный НЕ из пользовательского жеста (а из обработчика сообщения SW),
 * блокируется. Поэтому один и тот же элемент «прогревается» в рамках жеста
 * (тихое воспроизведение), после чего проигрывается программно.
 */

let audio: HTMLAudioElement | null = null;
let primed = false;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    audio = new Audio('/sounds/reminder.mp3');
    audio.preload = 'auto';
  }
  return audio;
}

/** Разблокировать звук в рамках пользовательского жеста (вызывать на клик/тап). */
export function primeReminderSound(): void {
  const a = getAudio();
  if (!a || primed) return;
  primed = true;
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    })
    .catch(() => {
      a.muted = false;
      primed = false; // не вышло — попробуем на следующем жесте
    });
}

/** Проиграть звук напоминания (тихо падает, если файла нет/звук не разблокирован). */
export function playReminderSound(): void {
  const a = getAudio();
  if (!a) return;
  a.currentTime = 0;
  void a.play().catch(() => {});
}
