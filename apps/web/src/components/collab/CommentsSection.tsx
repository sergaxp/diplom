'use client';

import { useState } from 'react';
import { Send, Trash2, MessageCircle } from 'lucide-react';
import { AvatarFramed } from '../AvatarFramed';
import { timeAgo } from '../profile/time';
import type { CollabComment } from '../../lib/collab';
import styles from './collab.module.scss';

interface Props {
  comments: CollabComment[];
  meId?: string;
  ownerId?: string | null;
  onSend: (text: string) => void;
  onDelete: (id: string) => void;
  sending?: boolean;
  loading?: boolean;
}

export function CommentsSection({
  comments,
  meId,
  ownerId,
  onSend,
  onDelete,
  sending,
  loading,
}: Props) {
  const [text, setText] = useState('');

  // НЕ <form>: компонент рендерится внутри <form> модалки задачи —
  // вложенная форма невалидна и её submit перезагружает страницу.
  const send = () => {
    const t = text.trim();
    if (!t || sending) return;
    onSend(t);
    setText('');
  };

  return (
    <div className={styles.comments}>
      <div className={styles.sectionHead}>
        <MessageCircle size={14} strokeWidth={1.75} />
        <span>Комментарии</span>
      </div>

      {loading ? null : comments.length === 0 ? (
        <p className={styles.empty}>Пока нет комментариев.</p>
      ) : (
        <ul className={styles.commentList}>
          {comments.map((c) => {
            const canDelete = c.author.id === meId || ownerId === meId;
            return (
              <li key={c.id} className={styles.comment}>
                <AvatarFramed
                  avatarUrl={c.author.avatarUrl}
                  displayName={c.author.displayName}
                  username={c.author.username}
                  frameId={c.author.selectedFrame}
                  size={28}
                />
                <div className={styles.commentBody}>
                  <div className={styles.commentHead}>
                    <span className={styles.commentAuthor}>
                      {c.author.displayName ?? c.author.username}
                    </span>
                    <span className={styles.commentTime}>
                      {timeAgo(c.createdAt)}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        className={styles.commentDelete}
                        onClick={() => onDelete(c.id)}
                        aria-label="Удалить комментарий"
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
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

      <div className={styles.commentForm}>
        <input
          className={styles.commentInput}
          value={text}
          maxLength={2000}
          placeholder="Написать комментарий…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          className={styles.sendBtn}
          disabled={!text.trim() || sending}
          aria-label="Отправить"
          onClick={send}
        >
          <Send size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
