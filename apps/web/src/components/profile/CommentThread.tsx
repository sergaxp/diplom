'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2 } from 'lucide-react';
import { AvatarFramed } from '../AvatarFramed';
import { Button } from '../ui';
import { commentsApi } from '../../lib/comments';
import { useAuthStore } from '../../store/authStore';
import { timeAgo } from './time';
import styles from './profile.module.scss';

interface Props {
  /** username владельца профиля */
  username: string;
  /** id поста; не задан — стена профиля */
  postId?: string;
  /** просматривает ли текущий пользователь свой профиль (для модерации) */
  isOwn: boolean;
  /** компактный вид (под постом) */
  compact?: boolean;
}

export function CommentThread({ username, postId, isOwn, compact }: Props) {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const key = ['comments', username, postId ?? 'wall'];

  const { data: comments = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => commentsApi.list(username, postId),
  });

  const createMut = useMutation({
    mutationFn: () =>
      commentsApi.create({ profileUsername: username, postId, text: text.trim() }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: key });
      // обновить счётчик комментариев в ленте постов
      if (postId) qc.invalidateQueries({ queryKey: ['posts', username] });
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => commentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      if (postId) qc.invalidateQueries({ queryKey: ['posts', username] });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || createMut.isPending) return;
    createMut.mutate();
  };

  return (
    <div className={compact ? styles.threadCompact : styles.thread}>
      {me ? (
        <form className={styles.commentForm} onSubmit={submit}>
          <AvatarFramed
            avatarUrl={me.avatarUrl}
            displayName={me.displayName}
            username={me.username}
            frameId={me.selectedFrame}
            size={32}
          />
          <input
            className={styles.commentInput}
            value={text}
            maxLength={1000}
            placeholder={postId ? 'Написать комментарий…' : 'Оставить запись на стене…'}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!text.trim()}
            loading={createMut.isPending}
            leftIcon={<Send size={15} strokeWidth={1.75} />}
          >
            Отправить
          </Button>
        </form>
      ) : (
        <p className={styles.muted}>
          <Link href="/auth" className={styles.inlineLink}>Войдите</Link>, чтобы оставить комментарий.
        </p>
      )}

      {isLoading ? null : comments.length === 0 ? (
        <p className={styles.mutedSmall}>Пока нет комментариев.</p>
      ) : (
        <ul className={styles.commentList}>
          {comments.map((c) => {
            const canDelete = isOwn || c.authorId === me?.id;
            return (
              <li key={c.id} className={styles.commentItem}>
                <Link href={`/u/${c.author.username}`}>
                  <AvatarFramed
                    avatarUrl={c.author.avatarUrl}
                    displayName={c.author.displayName}
                    username={c.author.username}
                    frameId={c.author.selectedFrame}
                    size={32}
                  />
                </Link>
                <div className={styles.commentBody}>
                  <div className={styles.commentHead}>
                    <Link href={`/u/${c.author.username}`} className={styles.commentAuthor}>
                      {c.author.displayName ?? c.author.username}
                    </Link>
                    <span className={styles.commentTime}>{timeAgo(c.createdAt)}</span>
                    {canDelete && (
                      <button
                        type="button"
                        className={styles.commentDelete}
                        onClick={() => removeMut.mutate(c.id)}
                        aria-label="Удалить комментарий"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                  <p className={styles.commentText}>{c.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
