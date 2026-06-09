'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { Card, EmptyState, Skeleton } from '../ui';
import { postsApi } from '../../lib/posts';
import { PublicProfile } from '../../lib/profile';
import { PostCard } from './PostCard';
import styles from './profile.module.scss';

export function PostFeed({
  profile,
  isOwn,
}: {
  profile: PublicProfile;
  isOwn: boolean;
}) {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts', profile.username],
    queryFn: () => postsApi.list(profile.username),
  });

  if (isLoading) {
    return (
      <Card padding="md">
        <Skeleton text width="30%" height={18} />
        <div style={{ height: 12 }} />
        <Skeleton width="100%" height={60} />
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card padding="md">
        <EmptyState
          icon={<MessageSquare size={44} strokeWidth={1.25} />}
          title="Постов пока нет"
          description={isOwn ? 'Создайте первый пост — он появится здесь.' : 'Пользователь ещё ничего не опубликовал.'}
        />
      </Card>
    );
  }

  return (
    <div className={styles.feed}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} profile={profile} isOwn={isOwn} />
      ))}
    </div>
  );
}
