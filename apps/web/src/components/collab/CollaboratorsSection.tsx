'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, X, Plus, LogOut, Check, Clock } from 'lucide-react';
import { AvatarFramed } from '../AvatarFramed';
import { collabApi, type CollabEntity, type UserSearchResult } from '../../lib/collab';
import styles from './collab.module.scss';

export interface MemberChip {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  selectedFrame: string | null;
  status: 'pending' | 'accepted' | 'declined';
  isOwner: boolean;
  removable: boolean;
}

interface Props {
  chips: MemberChip[];
  /** Показывать поле приглашения по @username (только создателю). */
  canInvite: boolean;
  entityType?: CollabEntity;
  entityId?: string;
  /** id, которых не предлагать в поиске (уже участники / владелец / draft). */
  excludeIds: string[];
  onInvite: (user: UserSearchResult) => void;
  onRemove: (userId: string) => void;
  inviting?: boolean;
  canLeave?: boolean;
  onLeave?: () => void;
}

export function CollaboratorsSection({
  chips,
  canInvite,
  entityType,
  entityId,
  excludeIds,
  onInvite,
  onRemove,
  inviting,
  canLeave,
  onLeave,
}: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Дебаунс-поиск пользователей по началу @username.
  useEffect(() => {
    const term = q.trim().replace(/^@/, '');
    if (!term) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      collabApi
        .search(term, entityType, entityId)
        .then((r) => {
          if (!cancelled) {
            setResults(r.filter((u) => !excludeIds.includes(u.id)));
            setOpen(true);
          }
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, entityType, entityId, excludeIds]);

  // Закрытие дропдауна по клику снаружи.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (u: UserSearchResult) => {
    if (u.state === 'member') return;
    onInvite(u);
    setQ('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className={styles.collabSection}>
      <div className={styles.sectionHead}>
        <Users size={14} strokeWidth={1.75} />
        <span>Участники</span>
      </div>

      <div className={styles.chips}>
        {chips.map((c) => (
          <span
            key={c.id}
            className={`${styles.chip} ${c.status === 'pending' ? styles.chipPending : ''}`}
            title={
              c.isOwner
                ? 'Создатель'
                : c.status === 'pending'
                  ? 'Приглашение отправлено'
                  : `@${c.username}`
            }
          >
            <AvatarFramed
              avatarUrl={c.avatarUrl}
              displayName={c.displayName}
              username={c.username}
              frameId={c.selectedFrame}
              size={22}
            />
            <span className={styles.chipName}>
              {c.displayName ?? c.username}
            </span>
            {c.isOwner ? (
              <span className={styles.chipBadge} title="Создатель">★</span>
            ) : c.status === 'pending' ? (
              <Clock size={12} strokeWidth={2} className={styles.chipIcon} />
            ) : (
              <Check size={12} strokeWidth={2.5} className={styles.chipIcon} />
            )}
            {c.removable && (
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => onRemove(c.id)}
                aria-label="Убрать участника"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </span>
        ))}

        {canLeave && onLeave && (
          <button
            type="button"
            className={styles.leaveBtn}
            onClick={onLeave}
          >
            <LogOut size={13} strokeWidth={2} /> Покинуть
          </button>
        )}
      </div>

      {canInvite && (
        <div className={styles.searchWrap} ref={boxRef}>
          {/* textarea (1 строка), а не input: мобильные браузеры (Yandex и др.)
              игнорируют autocomplete=off у input и показывают панель
              автозаполнения/пароля над клавиатурой; у textarea её нет, и
              менеджеры паролей к ней не цепляются. */}
          <textarea
            className={styles.searchInput}
            value={q}
            placeholder="Пригласить по @username…"
            rows={1}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={(e) => {
              // Внутри <form> модалки задачи Enter сабмитил бы форму — гасим
              // и приглашаем первого подходящего из результатов.
              if (e.key === 'Enter') {
                e.preventDefault();
                const first = results.find((u) => u.state !== 'member');
                if (first) pick(first);
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="collab-user-search"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            disabled={inviting}
          />
          {open && results.length > 0 && (
            <ul className={styles.searchDrop}>
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className={styles.searchItem}
                    onClick={() => pick(u)}
                    disabled={u.state === 'member'}
                  >
                    <AvatarFramed
                      avatarUrl={u.avatarUrl}
                      displayName={u.displayName}
                      username={u.username}
                      frameId={u.selectedFrame}
                      size={26}
                    />
                    <span className={styles.searchMeta}>
                      <span className={styles.searchName}>
                        {u.displayName ?? u.username}
                      </span>
                      <span className={styles.searchUser}>@{u.username}</span>
                    </span>
                    <span className={styles.searchAction}>
                      {u.state === 'member' ? (
                        <Check size={15} strokeWidth={2.5} />
                      ) : u.state === 'pending' ? (
                        <Clock size={15} strokeWidth={2} />
                      ) : (
                        <Plus size={16} strokeWidth={2.5} />
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
