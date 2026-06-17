import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Проекты: контейнеры задач со своей («не по дню») доской.
 *  - projects: сущность проекта (колонки доски + вехи как JSON прямо здесь);
 *  - project_board_placements: позиции карточек на доске проекта (ключ
 *    projectId+cardKey, без даты; хранит и «Завершённые» с completedAt);
 *  - tasks += projectId (FK SET NULL) и milestoneId; tasks.date → nullable
 *    (задачи-бэклог без даты). В dev схему накатывает synchronize.
 */
export class AddProjects1781600000000 implements MigrationInterface {
  name = 'AddProjects1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" text, "tagId" character varying, "color" character varying(20), "icon" character varying(64), "deadline" character varying(10), "archived" boolean NOT NULL DEFAULT false, "boardColumns" json, "milestones" json, "position" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_projects_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_user" ON "projects" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "project_board_placements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" character varying NOT NULL, "cardKey" character varying(255) NOT NULL, "columnId" character varying(64) NOT NULL, "position" double precision NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_project_board_placements_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_project_board_placement" UNIQUE ("projectId", "cardKey"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_board_placements_project" ON "project_board_placements" ("projectId")`,
    );

    await queryRunner.query(`ALTER TABLE "tasks" ADD "projectId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "milestoneId" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "completedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "date" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "date" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "completedAt"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "milestoneId"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "projectId"`);

    await queryRunner.query(
      `DROP INDEX "IDX_project_board_placements_project"`,
    );
    await queryRunner.query(`DROP TABLE "project_board_placements"`);

    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_user"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_projects_user"`);
    await queryRunner.query(`DROP TABLE "projects"`);
  }
}
