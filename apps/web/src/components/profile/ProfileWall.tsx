'use client';

import { Card } from '../ui';
import { CommentThread } from './CommentThread';
import styles from './profile.module.scss';

/** Стена профиля (Steam-style): комментарии без привязки к посту. */
export function ProfileWall({ username, isOwn }: { username: string; isOwn: boolean }) {
  return (
    <Card padding="md">
      <h2 className={styles.cardTitle}>Стена профиля</h2>
      <CommentThread username={username} isOwn={isOwn} />
    </Card>
  );
}
