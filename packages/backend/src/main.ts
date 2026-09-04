// Load packages/backend/.env BEFORE anything reads process.env.
//
// This has to be the first statement in the file: PrismaClient reads
// DATABASE_URL when it is constructed, which happens inside
// NestFactory.create() below. Without this the app only ever started when
// every variable was exported on the command line by hand, and failed with a
// bare "Environment variable not found: DATABASE_URL" otherwise.
//
// In production nothing is read from a file — the host supplies real
// environment variables and dotenv simply finds no .env to load.
import * as dotenv from "dotenv";
dotenv.config();

import { NestFactory } from "@nestjs/core";
import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp(NestFactory);
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
