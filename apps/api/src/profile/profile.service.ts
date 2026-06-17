import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UsersService } from '../users/users.service';
import { ShopService } from '../shop/shop.service';
import { AchievementsService } from '../achievements/achievements.service';
import { StorageService, BUCKETS } from '../storage/storage.service';
import { ActivityService } from '../activity/activity.service';
import { DayCount } from '../activity/activity.types';

interface AuthorView {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  selectedFrame: string | null;
}

export interface CommentView {
  id: string;
  authorId: string;
  profileUserId: string;
  postId: string | null;
  text: string;
  createdAt: Date;
  author: AuthorView;
}

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    private readonly usersService: UsersService,
    private readonly shopService: ShopService,
    private readonly achievementsService: AchievementsService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  // ── Посты ──────────────────────────────────────────────────
  async createPost(
    authorId: string,
    text: string,
    image?: { url: string; key: string } | null,
  ): Promise<Post> {
    const post = this.postRepo.create({
      authorId,
      text,
      imageUrl: image?.url ?? null,
      imageKey: image?.key ?? null,
    });
    return this.postRepo.save(post);
  }

  /** Лента постов профиля (по убыванию даты) с количеством комментариев. */
  async listPosts(
    username: string,
  ): Promise<(Post & { commentCount: number })[]> {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('Пользователь не найден');

    const posts = await this.postRepo.find({
      where: { authorId: user.id },
      order: { pinned: 'DESC', createdAt: 'DESC' },
    });
    if (!posts.length) return [];

    const counts = await this.commentRepo
      .createQueryBuilder('c')
      .select('c.postId', 'postId')
      .addSelect('COUNT(*)', 'count')
      .where('c.postId IN (:...ids)', { ids: posts.map((p) => p.id) })
      .groupBy('c.postId')
      .getRawMany<{ postId: string; count: string }>();
    const countMap = new Map(
      counts.map((r) => [r.postId, parseInt(r.count, 10)]),
    );

    return posts.map((p) => ({ ...p, commentCount: countMap.get(p.id) ?? 0 }));
  }

  private async ownPostOrThrow(id: string, userId: string): Promise<Post> {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Пост не найден');
    if (post.authorId !== userId) {
      throw new ForbiddenException('Это не ваш пост');
    }
    return post;
  }

  async setPinned(id: string, userId: string, pinned: boolean): Promise<Post> {
    const post = await this.ownPostOrThrow(id, userId);
    post.pinned = pinned;
    return this.postRepo.save(post);
  }

  async deletePost(id: string, userId: string): Promise<void> {
    const post = await this.ownPostOrThrow(id, userId);
    if (post.imageKey) {
      await this.storage.delete(post.imageKey, BUCKETS.tasks);
    }
    await this.postRepo.remove(post);
  }

  // ── Комментарии ────────────────────────────────────────────
  async createComment(
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<CommentView> {
    const profileUser = await this.usersService.findByUsername(
      dto.profileUsername,
    );
    if (!profileUser) throw new NotFoundException('Профиль не найден');

    if (dto.postId) {
      const post = await this.postRepo.findOne({ where: { id: dto.postId } });
      if (!post) throw new NotFoundException('Пост не найден');
    }

    const comment = this.commentRepo.create({
      authorId,
      profileUserId: profileUser.id,
      postId: dto.postId ?? null,
      text: dto.text,
    });
    const saved = await this.commentRepo.save(comment);
    return this.attachAuthor(saved);
  }

  /** Комментарии стены (postId не задан) или конкретного поста. */
  async listComments(
    username: string,
    postId?: string,
  ): Promise<CommentView[]> {
    const profileUser = await this.usersService.findByUsername(username);
    if (!profileUser) throw new NotFoundException('Профиль не найден');

    const rows = await this.commentRepo.find({
      where: postId
        ? { postId }
        : { profileUserId: profileUser.id, postId: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!rows.length) return [];
    return this.attachAuthors(rows);
  }

  async deleteComment(id: string, userId: string): Promise<void> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Комментарий не найден');
    // Удалять может автор комментария ИЛИ владелец профиля (модерация стены)
    if (comment.authorId !== userId && comment.profileUserId !== userId) {
      throw new ForbiddenException('Недостаточно прав');
    }
    await this.commentRepo.remove(comment);
  }

  // ── Витрины: данные ────────────────────────────────────────
  /** Публичная статистика профиля для витрины «Статистика». */
  async getStats(username: string): Promise<{
    level: number;
    xp: number;
    coins: number;
    postCount: number;
    achievementCount: number;
    achievementTotal: number;
  }> {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('Пользователь не найден');

    const [postCount, achievements] = await Promise.all([
      this.postRepo.count({ where: { authorId: user.id } }),
      this.achievementsService.getAll(user.id),
    ]);
    return {
      level: Math.floor((user.xp ?? 0) / 1000),
      xp: user.xp ?? 0,
      coins: user.coins ?? 0,
      postCount,
      achievementCount: achievements.filter((a) => a.unlocked).length,
      achievementTotal: achievements.length,
    };
  }

  /** Купленные предметы пользователя — для витрины «Любимые рамки». */
  async getInventory(username: string): Promise<string[]> {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('Пользователь не найден');
    const ids = await this.shopService.getInventoryIds(user.id);
    return [...ids];
  }

  /** Дерево достижений пользователя по username — публично, для просмотра чужих профилей. */
  async getAchievements(username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('Пользователь не найден');
    return this.achievementsService.getAll(user.id);
  }

  /**
   * Глобальная активность пользователя (клетки heatmap) за период — для витрины
   * профиля. Публично, но только счётчики по дням (без текстов/деталей).
   */
  async getActivity(
    username: string,
    from: Date,
    to: Date,
  ): Promise<{ days: DayCount[] }> {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('Пользователь не найден');
    const days = await this.activity.userDailyCounts(user.id, from, to);
    return { days };
  }

  // ── Хелперы: подмешать мини-профиль автора ─────────────────
  private async attachAuthors(comments: Comment[]): Promise<CommentView[]> {
    const authorIds = [...new Set(comments.map((c) => c.authorId))];
    const authors = await this.usersService.getMiniProfiles(authorIds);
    const map = new Map(authors.map((a) => [a.id, a]));
    return comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      profileUserId: c.profileUserId,
      postId: c.postId,
      text: c.text,
      createdAt: c.createdAt,
      author: map.get(c.authorId) as AuthorView,
    }));
  }

  private async attachAuthor(comment: Comment): Promise<CommentView> {
    const [withAuthor] = await this.attachAuthors([comment]);
    return withAuthor;
  }
}
