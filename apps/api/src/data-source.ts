import 'dotenv/config';
import { DataSource } from 'typeorm';

// Используется CLI typeorm для генерации/применения миграций (см. package.json: migration:*).
// Конфиг подключения должен совпадать с TypeOrmModule.forRoot в app.module.ts.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'sergey',
  password: process.env.DATABASE_PASSWORD ?? '',
  database: process.env.DATABASE_NAME ?? 'warmingtea_dev',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
