'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pin, PinOff, Trash2, MessageCircle } from 'lucide-react';
import { AvatarFramed } from '../AvatarFramed';
import { Card } from '../ui';
import { postsApi, Post } from '../../lib/posts';
import { PublicProfile } from '../../lib/profile';
import { CommentThread } from './CommentThread';
import { timeAgo } from './time';
import styles from './profile.module.scss';

interface Props {
  post: Post;
  profile: PublicProfile;
  isOwn: boolean;
}

export function PostCard({ post, profile, isOwn }: Props) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['posts', profile.username] });

  const pinMut = useMutation({
    mutationFn: () => postsApi.pin(post.id, !post.pinned),
    onSuccess: invalidate,
  });
  const removeMut = useMutation({
    mutationFn: () => postsApi.remove(post.id),
    onSuccess: invalidate,
  });

  return (
    <Card padding="md">
      <div className={styles.postHead}>
        <AvatarFramed
          avatarUrl={profile.avatarUrl}
          displayName={profile.displayName}
          username={profile.username}
          frameId={profile.selectedFrame}
          size={40}
        />
        <div className={styles.postMeta}>
          <span className={styles.postAuthor}>{profile.displayName ?? profile.username}</span>
          <span className={styles.postTime}>{timeAgo(post.createdAt)}</span>
        </div>
        {post.pinned && <span className={styles.pinnedBadge}><Pin size={13} strokeWidth={2} /> Закреплено</span>}
        {isOwn && (
          <div className={styles.postTools}>
            <button
              type="button"
              className={styles.postToolBtn}
              onClick={() => pinMut.mutate()}
              disabled={pinMut.isPending}
              aria-label={post.pinned ? 'Открепить' : 'Закрепить'}
              title={post.pinned ? 'Открепить' : 'Закрепить'}
            >
              {post.pinned ? <PinOff size={16} strokeWidth={1.75} /> : <Pin size={16} strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              className={styles.postToolBtn}
              onClick={() => removeMut.mutate()}
              disabled={removeMut.isPending}
              aria-label="Удалить пост"
              title="Удалить"
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      {post.text && <p className={styles.postText}>{post.text}</p>}

      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="изображение поста" className={styles.postImage} />
      )}

      <button
        type="button"
        className={styles.commentToggle}
        onClick={() => setShowComments((v) => !v)}
      >
        <MessageCircle size={16} strokeWidth={1.75} />
        {post.commentCount > 0 ? `Комментарии · ${post.commentCount}` : 'Комментировать'}
      </button>

      {showComments && (
        <CommentThread username={profile.username} postId={post.id} isOwn={isOwn} compact />
      )}
    </Card>
  );
}
