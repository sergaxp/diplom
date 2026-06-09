'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { shopApi } from '../../../lib/shop';
import styles from '../page.module.scss';

export function BackgroundPicker({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const qc = useQueryClient();
  const { data: shopItems = [] } = useQuery({ queryKey: ['shop', 'items'], queryFn: shopApi.getItems });
  const ownedBackgrounds = shopItems.filter(i => i.kind === 'background' && i.owned);

  const bgMut = useMutation({
    mutationFn: (bgId: string | null) => profileApi.update({ selectedBackground: bgId }),
    onMutate: (bgId) => {
      const prev = user;
      setUser({ ...user, selectedBackground: bgId });
      return { prev };
    },
    onSuccess: (u: User) => { setUser(u); qc.invalidateQueries({ queryKey: ['profile'] }); },
    onError: (_e, _v, ctx) => { if (ctx?.prev) setUser(ctx.prev); },
  });

  return (
    <div className={styles.frameGrid}>
      <button
        type="button"
        className={[styles.frameOption, !user.selectedBackground ? styles.frameOptionActive : ''].join(' ')}
        onClick={() => bgMut.mutate(null)}
        disabled={bgMut.isPending}
        aria-pressed={!user.selectedBackground}
      >
        <span className={styles.bgSwatch} style={{ background: 'var(--bg-subtle)' }} />
        <span className={styles.frameLabel}>Без фона</span>
      </button>

      {ownedBackgrounds.map(b => (
        <button
          key={b.id}
          type="button"
          className={[styles.frameOption, user.selectedBackground === b.id ? styles.frameOptionActive : ''].join(' ')}
          onClick={() => bgMut.mutate(b.id)}
          disabled={bgMut.isPending}
          title={b.title}
          aria-pressed={user.selectedBackground === b.id}
        >
          {b.meta?.video ? (
            <video className={styles.bgSwatch} src={b.meta.video} muted loop autoPlay playsInline preload="metadata" />
          ) : (
            <span className={styles.bgSwatch} style={{ background: b.meta?.gradient }} />
          )}
          <span className={styles.frameLabel}>{b.title}</span>
        </button>
      ))}

      {ownedBackgrounds.length === 0 && (
        <div className={styles.framesEmpty}>
          У вас пока нет купленных фонов. Загляните в{' '}
          <Link href="/shop" className={styles.inlineLink}>магазин</Link>.
        </div>
      )}
    </div>
  );
}
