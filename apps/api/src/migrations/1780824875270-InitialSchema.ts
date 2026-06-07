import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1780824875270 implements MigrationInterface {
  name = 'InitialSchema1780824875270';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(32) NOT NULL, "email" character varying(255) NOT NULL, "password" character varying, "googleId" character varying, "displayName" character varying(255), "avatarUrl" character varying(500), "coverUrl" character varying(500), "bio" character varying(200), "location" character varying(100), "locationLat" double precision, "locationLon" double precision, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "isEmailVerified" boolean NOT NULL DEFAULT false, "emailVerificationToken" character varying, "passwordResetToken" character varying, "passwordResetExpires" TIMESTAMP, "lastSeenAt" TIMESTAMP, "isActive" boolean NOT NULL DEFAULT true, "showGlobalEvents" boolean NOT NULL DEFAULT true, "showHolidays" boolean NOT NULL DEFAULT true, "xp" integer NOT NULL DEFAULT '0', "coins" integer NOT NULL DEFAULT '0', "lastDailyBonusAt" TIMESTAMP, "selectedFrame" character varying(64), "socialLinks" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "account_deletion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deletedAt" TIMESTAMP NOT NULL DEFAULT now(), "usernameHint" character varying(32), CONSTRAINT "PK_13f44b259982aa748e5f68cc754" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "name" character varying(64) NOT NULL, "icon" character varying(64), "color" character varying(20) NOT NULL DEFAULT '#6b7280', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text, "date" character varying(10) NOT NULL, "time" character varying(5), "endTime" character varying(5), "endDate" character varying(10), "repeat" character varying(20) NOT NULL DEFAULT 'none', "repeatConfig" json, "repeatUntil" character varying(10), "type" character varying(20) NOT NULL DEFAULT 'normal', "priority" character varying(20) NOT NULL DEFAULT 'none', "icon" character varying(64), "subtasks" json, "dayOverrides" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_completions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" character varying NOT NULL, "userId" character varying NOT NULL, "date" character varying(10) NOT NULL, "completedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5d69208cc89f72cb7e8f5a0de54" UNIQUE ("taskId", "userId", "date"), CONSTRAINT "PK_c9c25215a82514668ab1d72a04d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "global_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "description" text, "date" character varying(10) NOT NULL, "time" character varying(5), "repeat" character varying(10) NOT NULL DEFAULT 'none', "repeatUntil" character varying(10), "icon" character varying(64), "createdBy" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_243c151e1734e50326b8421c183" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_inventory" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "itemId" character varying(64) NOT NULL, "purchasedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9be828636e65aaf701717fabf17" UNIQUE ("userId", "itemId"), CONSTRAINT "PK_193d6e1b301eda020c2492d3d9c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "kind" character varying(32) NOT NULL, "title" character varying(200) NOT NULL, "body" character varying(500), "icon" character varying(64), "color" character varying(16), "read" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_21e65af2f4f242d4c85a92aff4" ON "notifications" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "holiday_cache" ("id" SERIAL NOT NULL, "year" integer NOT NULL, "entries" json NOT NULL, "fetchedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_99827cb93fc72a486af176a10e4" UNIQUE ("year"), CONSTRAINT "PK_6f611df084544b59ce55f83619e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "feature_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text, "status" character varying(50) NOT NULL DEFAULT 'unread', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f5741ccd82f3784d78f94fb57e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bug_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text, "attachmentUrls" json, "attachmentKeys" json, "status" character varying(50) NOT NULL DEFAULT 'unread', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ad13bef7131f2fed8b2fb9fbb00" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_achievements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "defId" character varying(64) NOT NULL, "unlockedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a889caf6778be63e4f83a58c8d3" UNIQUE ("userId", "defId"), CONSTRAINT "PK_3d94aba7e9ed55365f68b5e77fa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_tags" ("taskId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_20be04cfd9558da670ed177211d" PRIMARY KEY ("taskId", "tagId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1470ad368e79cb5636163a4bf8" ON "task_tags" ("taskId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac1cfe87c11bc138ee8675cff3" ON "task_tags" ("tagId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_166bd96559cb38595d392f75a35" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "feature_requests" ADD CONSTRAINT "FK_4ae511d0b8393c51acab323b480" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bug_reports" ADD CONSTRAINT "FK_c3608c66301f63f9b03c208f00b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_tags" ADD CONSTRAINT "FK_1470ad368e79cb5636163a4bf8d" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_tags" ADD CONSTRAINT "FK_ac1cfe87c11bc138ee8675cff3c" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_tags" DROP CONSTRAINT "FK_ac1cfe87c11bc138ee8675cff3c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_tags" DROP CONSTRAINT "FK_1470ad368e79cb5636163a4bf8d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bug_reports" DROP CONSTRAINT "FK_c3608c66301f63f9b03c208f00b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "feature_requests" DROP CONSTRAINT "FK_4ae511d0b8393c51acab323b480"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_166bd96559cb38595d392f75a35"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ac1cfe87c11bc138ee8675cff3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1470ad368e79cb5636163a4bf8"`,
    );
    await queryRunner.query(`DROP TABLE "task_tags"`);
    await queryRunner.query(`DROP TABLE "user_achievements"`);
    await queryRunner.query(`DROP TABLE "bug_reports"`);
    await queryRunner.query(`DROP TABLE "feature_requests"`);
    await queryRunner.query(`DROP TABLE "holiday_cache"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_21e65af2f4f242d4c85a92aff4"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "user_inventory"`);
    await queryRunner.query(`DROP TABLE "global_tasks"`);
    await queryRunner.query(`DROP TABLE "task_completions"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "tags"`);
    await queryRunner.query(`DROP TABLE "account_deletion"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
