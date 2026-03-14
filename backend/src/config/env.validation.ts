import { IsString, IsNumber, IsEnum, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export enum NodeEnv {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  GITHUB_TOKEN!: string;

  @IsString()
  @IsNotEmpty()
  GITHUB_WEBHOOK_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  GITHUB_ORG!: string;

  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  PORT!: number;

  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;
}
