'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileApi } from '../../../lib/profile';
import { User } from '../../../lib/auth';
import { SOCIAL_PROVIDERS } from '../../../lib/socials';
import { Icon } from '../../../lib/icons';
import { Input, IconButton } from '../../../components/ui';
import styles from '../page.module.scss';

export function SocialLinksEditor({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const [links, setLinks] = useState<Record<string, string>>(() => user.socialLinks ?? {});
  const [savedFlag, setSavedFlag] = useState(false);

  const mut = useMutation({
    mutationFn: (next: Record<string, string>) => profileApi.update({ socialLinks: next }),
    onMutate: (next) => {
      const prev = user;
      setUser({ ...user, socialLinks: next });
      return { prev };
    },
    onSuccess: (u: User) => {
      setUser(u);
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 1500);
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) setUser(ctx.prev); },
  });

  const commit = (next: Record<string, string>) => {
    setLinks(next);
    mut.mutate(next);
  };

  const setOne = (id: string, value: string) => {
    const next = { ...links, [id]: value };
    setLinks(next);
  };

  const removeOne = (id: string) => {
    const next = { ...links };
    delete next[id];
    commit(next);
  };

  const blurSave = (id: string) => {
    const v = (links[id] ?? '').trim();
    const current = user.socialLinks?.[id] ?? '';
    if (v === current) return;
    if (!v) {
      removeOne(id);
      return;
    }
    commit({ ...links, [id]: v });
  };

  return (
    <div className={styles.form}>
      <p className={styles.sectionDesc}>
        Будут отображаться на странице вашего профиля. Оставьте поле пустым, чтобы удалить ссылку.
      </p>

      <div className={styles.socialEditList}>
        {SOCIAL_PROVIDERS.map(p => {
          const value = links[p.id] ?? '';
          return (
            <div key={p.id} className={styles.socialRow}>
              <span className={styles.socialRowIcon} style={{ color: p.color, background: p.color + '1f' }}>
                <Icon name={p.icon} size={14} strokeWidth={2} />
              </span>
              <span className={styles.socialRowLabel}>{p.label}</span>
              <Input
                type="text"
                value={value}
                placeholder={p.placeholder ?? ''}
                onChange={e => setOne(p.id, e.target.value)}
                onBlur={() => blurSave(p.id)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              {value && (
                <IconButton
                  icon={<span aria-hidden>×</span>}
                  aria-label="Удалить ссылку"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOne(p.id)}
                />
              )}
            </div>
          );
        })}
      </div>

      {savedFlag && <div className={styles.success}>Сохранено</div>}
    </div>
  );
}
