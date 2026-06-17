import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Журнал активности (heatmap + лента изменений).
 *  - activity_events: денормализованные события с готовым текстом summary;
 *  - бэкфилл из существующих данных, чтобы heatmap сразу был с историей:
 *      • task_created  — из tasks.createdAt;
 *      • task_completed — из tasks.completedAt (карточки проектов) и из
 *        task_completions.completedAt (повторяющиеся/датированные задачи).
 * В dev таблицу создаёт synchronize; бэкфилл — только этой миграцией.
 */
export class AddActivityLog1781800000000 implements MigrationInterface {
  name = 'AddActivityLog1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "activity_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "projectId" character varying, "taskId" character varying, "type" character varying(32) NOT NULL, "summary" character varying(500) NOT NULL, "meta" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_activity_events_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_user_created" ON "activity_events" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_project_created" ON "activity_events" ("projectId", "createdAt")`,
    );

    // ── Бэкфилл ──────────────────────────────────────────────────
    await queryRunner.query(
      `INSERT INTO "activity_events" ("userId", "projectId", "taskId", "type", "summary", "createdAt")
       SELECT t."userId", t."projectId", t."id", 'task_created',
              'Создана задача «' || t."title" || '»', t."createdAt"
       FROM "tasks" t`,
    );
    await queryRunner.query(
      `INSERT INTO "activity_events" ("userId", "projectId", "taskId", "type", "summary", "createdAt")
       SELECT t."userId", t."projectId", t."id", 'task_completed',
              'Завершена задача «' || t."title" || '»', t."completedAt"
       FROM "tasks" t WHERE t."completedAt" IS NOT NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "activity_events" ("userId", "projectId", "taskId", "type", "summary", "createdAt")
       SELECT tc."userId", t."projectId", t."id", 'task_completed',
              'Завершена задача «' || t."title" || '»', tc."completedAt"
       FROM "task_completions" tc JOIN "tasks" t ON t."id"::text = tc."taskId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_activity_project_created"`);
    await queryRunner.query(`DROP INDEX "IDX_activity_user_created"`);
    await queryRunner.query(`DROP TABLE "activity_events"`);
  }
}
