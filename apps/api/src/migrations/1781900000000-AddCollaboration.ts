import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Совместный режим:
 *  - task_collaborators / project_collaborators: участники задачи/проекта
 *    (status pending/accepted/declined; уникальность по (entity, user));
 *  - collab_comments: чат под задачей ИЛИ проектом (ровно одно из taskId/projectId);
 *  - notifications += data (json payload приглашения) и actionState
 *    (pending/accepted/declined для кнопок «Принять/Отклонить»).
 * В dev схему накатывает synchronize.
 */
export class AddCollaboration1781900000000 implements MigrationInterface {
  name = 'AddCollaboration1781900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── task_collaborators ──────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "task_collaborators" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" character varying NOT NULL, "userId" character varying NOT NULL, "invitedById" character varying NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "respondedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_task_collaborators_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_task_collaborator" UNIQUE ("taskId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_collaborators_task" ON "task_collaborators" ("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_collaborators_user_status" ON "task_collaborators" ("userId", "status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_collaborators" ADD CONSTRAINT "FK_task_collaborators_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_collaborators" ADD CONSTRAINT "FK_task_collaborators_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ── project_collaborators ───────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "project_collaborators" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" character varying NOT NULL, "userId" character varying NOT NULL, "invitedById" character varying NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "respondedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_project_collaborators_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_project_collaborator" UNIQUE ("projectId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_collaborators_project" ON "project_collaborators" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_collaborators_user_status" ON "project_collaborators" ("userId", "status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_collaborators" ADD CONSTRAINT "FK_project_collaborators_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_collaborators" ADD CONSTRAINT "FK_project_collaborators_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ── collab_comments ─────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "collab_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" character varying, "projectId" character varying, "authorId" character varying NOT NULL, "text" character varying(2000) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_collab_comments_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collab_comments_task" ON "collab_comments" ("taskId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collab_comments_project" ON "collab_comments" ("projectId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "collab_comments" ADD CONSTRAINT "FK_collab_comments_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collab_comments" ADD CONSTRAINT "FK_collab_comments_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collab_comments" ADD CONSTRAINT "FK_collab_comments_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ── notifications: actionable payload ───────────────────────
    await queryRunner.query(`ALTER TABLE "notifications" ADD "data" json`);
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "actionState" character varying(16)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "actionState"`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "data"`);

    await queryRunner.query(`DROP TABLE "collab_comments"`);
    await queryRunner.query(`DROP TABLE "project_collaborators"`);
    await queryRunner.query(`DROP TABLE "task_collaborators"`);
  }
}
