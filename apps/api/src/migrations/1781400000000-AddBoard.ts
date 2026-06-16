import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Доска (Kanban): раскладка колонок на пользователе (JSON) + позиции карточек
 * в неконечных колонках (board_placements). «Завершённые» не хранится здесь —
 * это реальное выполнение задачи/подзадач. В dev схему накатывает synchronize.
 */
export class AddBoard1781400000000 implements MigrationInterface {
  name = 'AddBoard1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "boardColumns" json`);

    await queryRunner.query(
      `CREATE TABLE "board_placements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "cardKey" character varying(255) NOT NULL, "date" character varying(10) NOT NULL, "columnId" character varying(64) NOT NULL, "position" double precision NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_board_placements_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_board_placement" UNIQUE ("userId", "cardKey", "date"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_board_placements_user" ON "board_placements" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_board_placements_user"`);
    await queryRunner.query(`DROP TABLE "board_placements"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "boardColumns"`);
  }
}
