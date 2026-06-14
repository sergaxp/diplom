import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Напоминания у задач (Web Push): конфиг правил на задаче, материализованные
 * инстансы, push-подписки, дефолтное время вседневных напоминаний.
 * Плюс перевод notifications.createdAt в timestamptz (иначе время «уезжает» на
 * величину часового пояса при отображении «N часов назад»).
 * В dev схему накатывает synchronize; в проде — эта миграция.
 */
export class AddReminders1781200000000 implements MigrationInterface {
  name = 'AddReminders1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Конфиг напоминаний на задаче + дефолтное время у пользователя ──
    await queryRunner.query(`ALTER TABLE "tasks" ADD "reminders" json`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "reminderDefaultTime" character varying(5) NOT NULL DEFAULT '09:00'`,
    );

    // ── Время уведомлений в timestamptz (значения трактуем как UTC) ──
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`,
    );

    // ── Push-подписки ────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "push_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "endpoint" text NOT NULL, "p256dh" character varying NOT NULL, "auth" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_push_subscriptions_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_push_subscriptions_endpoint" UNIQUE ("endpoint"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_push_subscriptions_user" ON "push_subscriptions" ("userId")`,
    );

    // ── Материализованные инстансы напоминаний ───────────────
    await queryRunner.query(
      `CREATE TABLE "reminder_instances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "taskId" character varying NOT NULL, "ruleId" character varying NOT NULL, "occurrenceDate" character varying(10) NOT NULL, "linkDate" character varying(10) NOT NULL, "fireAt" TIMESTAMP WITH TIME ZONE NOT NULL, "title" character varying(255) NOT NULL, "occTime" character varying(5), "fired" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_reminder_instances_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_reminder_instances_task_rule_occ" UNIQUE ("taskId", "ruleId", "occurrenceDate"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reminder_instances_fired_fireat" ON "reminder_instances" ("fired", "fireAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_reminder_instances_fired_fireat"`);
    await queryRunner.query(`DROP TABLE "reminder_instances"`);
    await queryRunner.query(`DROP INDEX "IDX_push_subscriptions_user"`);
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "createdAt" TYPE TIMESTAMP USING "createdAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "reminderDefaultTime"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "reminders"`);
  }
}
