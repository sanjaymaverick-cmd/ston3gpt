import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { rateLimit, securityHeaders } from "./common/http-security";
import { parseFrontendOrigins } from "./common/cors";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.enableCors({ origin: parseFrontendOrigins(process.env.FRONTEND_URL) });
  app.use(securityHeaders);
  app.use(rateLimit);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
