import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prefix = process.env.API_PREFIX ?? "api";
  app.setGlobalPrefix(prefix);
  app.use(cookieParser());
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({
    origin: webOrigin,
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  });
  // Дополнительная защита cookie-сессий от межсайтовых изменяющих запросов.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== webOrigin) {
        res.status(403).json({
          success: false,
          error: {
            code: "ORIGIN_FORBIDDEN",
            message: "Недопустимый источник запроса",
          },
        });
        return;
      }
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle("FSP Orenburg API")
    .setDescription(
      "REST API платформы Федерации спортивного программирования Оренбургской области",
    )
    .setVersion("1.0")
    .addCookieAuth("fsp_session")
    .build();
  SwaggerModule.setup(
    `${prefix}/docs`,
    app,
    SwaggerModule.createDocument(app, swagger),
  );

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

bootstrap();
