import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Редизайн профиля (kitsu + Steam): полностраничный фон, витрины, посты, комментарии.
 * В dev схему накатывает synchronize; в проде — эта миграция.
 */
export class AddProfileSocial1780960000000 implements MigrationInterface {
  name = 'AddProfileSocial1780960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Новые поля профиля ───────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "users" ADD "backgroundUrl" character varying(500)`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "showcases" json`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "selectedBackground" character varying(64)`,
    );

    // ── Посты ────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "authorId" character varying NOT NULL, "text" character varying(2000) NOT NULL, "imageUrl" character varying(500), "imageKey" character varying(255), "pinned" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_posts_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_posts_author_created" ON "posts" ("authorId", "createdAt")`,
    );

    // ── Комментарии ──────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "authorId" character varying NOT NULL, "profileUserId" character varying NOT NULL, "postId" character varying, "text" character varying(1000) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_comments_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_profile_created" ON "comments" ("profileUserId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_post_created" ON "comments" ("postId", "createdAt")`,
    );

    // ── Внешние ключи (каскадное удаление) ───────────────────
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_posts_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_profile_user" FOREIGN KEY ("profileUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_post" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_post"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_profile_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_author"`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_posts_author"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_comments_post_created"`);
    await queryRunner.query(`DROP INDEX "IDX_comments_profile_created"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP INDEX "IDX_posts_author_created"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "selectedBackground"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "showcases"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "backgroundUrl"`);
  }
}
