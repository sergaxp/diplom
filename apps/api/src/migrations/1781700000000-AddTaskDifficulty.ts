import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Сложность задачи: tasks += difficulty ('easy' | 'normal' | 'hard'), дефолт
 * 'normal'. Независимо от type (дедлайн/эвент). В dev схему накатывает synchronize.
 */
export class AddTaskDifficulty1781700000000 implements MigrationInterface {
  name = 'AddTaskDifficulty1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "difficulty" character varying(20) NOT NULL DEFAULT 'normal'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "difficulty"`);
  }
}
