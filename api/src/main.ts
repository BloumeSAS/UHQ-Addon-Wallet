import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as path from 'path';
import * as fs from 'fs';

// Charge .env si présent
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const [k, ...rest] = line.trim().replace(/^#.*/, '').split('=');
    if (k && rest.length) process.env[k.trim()] ??= rest.join('=').trim();
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: { origin: '*', credentials: false },
    logger: ['error', 'warn', 'log'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║       UHQ Wallet Addon — NestJS             ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  URL      : http://localhost:${port}`);
  console.log(`  Manifest : http://localhost:${port}/uhq-manifest.json`);
  console.log(`  Panel    : ${process.env.PANEL_URL ?? 'http://localhost:8000'}`);
  console.log('');
}

bootstrap();
