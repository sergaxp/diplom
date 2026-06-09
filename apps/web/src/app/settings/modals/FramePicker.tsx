'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AvatarFramed } from '../../../components/AvatarFramed';
import { profileApi } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { shopApi } from '../../../lib/shop';
import styles from '../page.module.scss';

export function FramePicker({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const { data: shopItems = [] } = useQuery({ queryKey: ['shop', 'items'], queryFn: shopApi.getItems });
  const ownedFrames = shopItems.filter(i => i.kind === 'frame' && i.owned);

  const mut = useMutation({
    mutationFn: (frameId: string | null) => profileApi.update({ selectedFrame: frameId }),
    onMutate: (frameId) => {
      const prev = user;
      setUser({ ...user, selectedFrame: frameId });
      return { prev };
    },
    onSuccess: (u: User) => setUser(u),
    onError: (_e, _v, ctx) => { if (ctx?.prev) setUser(ctx.prev); },
  });

  return (
    <div className={styles.frameGrid}>
      <button
        type="button"
        className={[styles.frameOption, !user.selectedFrame ? styles.frameOptionActive : ''].join(' ')}
        onClick={() => mut.mutate(null)}
        disabled={mut.isPending}
        aria-pressed={!user.selectedFrame}
      >
        <AvatarFramed avatarUrl={user.avatarUrl} displayName={user.displayName} username={user.username} frameId={null} size={64} />
        <span className={styles.frameLabel}>Без рамки</span>
      </button>

      {ownedFrames.map(f => (
        <button
          key={f.id}
          type="button"
          className={[styles.frameOption, user.selectedFrame === f.id ? styles.frameOptionActive : ''].join(' ')}
          onClick={() => mut.mutate(f.id)}
          disabled={mut.isPending}
          title={f.title}
          aria-pressed={user.selectedFrame === f.id}
        >
          <AvatarFramed avatarUrl={user.avatarUrl} displayName={user.displayName} username={user.username} frameId={f.id} size={64} />
          <span className={styles.frameLabel} style={{ color: f.meta?.color }}>{f.title}</span>
        </button>
      ))}

      {ownedFrames.length === 0 && (
        <div className={styles.framesEmpty}>
          У вас пока нет купленных рамок. Загляните в{' '}
          <Link href="/shop" className={styles.inlineLink}>магазин</Link>.
        </div>
      )}
    </div>
  );
}
