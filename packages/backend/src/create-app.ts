import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { parseFrontendOrigins } from "./common/cors";
import { rateLimit, securityHeaders } from "./common/http-security";

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const express = app.getHttpAdapter().getInstance();

  express.set("trust proxy", 1);
  express.disable("x-powered-by");
  app.enableCors({ origin: parseFrontendOrigins(process.env.FRONTEND_URL) });
  app.use(securityHeaders);
  app.use(rateLimit);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  return app;
}
