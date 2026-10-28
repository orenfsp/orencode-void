import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { NextFunction, Request, Response } from "express";
import { PrismaService } from "./common/prisma.service";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prefix = process.env.API_PREFIX ?? "api";
  app.setGlobalPrefix(prefix);
  app.use(cookieParser());
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  const prisma = app.get(PrismaService);
  app.enableCors(async (req: Request, callback: (error: Error | null, options: Record<string, unknown>) => void) => {
    const origin=req.headers.origin;
    let allowed=origin===webOrigin;
    const externalPath=req.path.startsWith(`/${prefix}/integrations/competitions`) || [`/${prefix}/oidc/jwks`, `/${prefix}/oidc/.well-known/openid-configuration`].includes(req.path);
    if (externalPath) allowed=true;
    if (origin && [`/${prefix}/oidc/token`, `/${prefix}/oidc/userinfo`].includes(req.path)) {
      const clients=await prisma.oidcClient.findMany({where:{active:true},select:{redirectUri:true}}).catch(()=>[]);
      allowed=allowed||clients.some(c=>new URL(c.redirectUri).origin===origin);
    }
    callback(null, {
    origin: allowed ? origin ?? false : false,
    credentials: origin===webOrigin && !externalPath,
    exposedHeaders: ["Content-Disposition"],
    });
  });
  // Дополнительная защита cookie-сессий от межсайтовых изменяющих запросов.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const bearerEndpoint = req.path === `/${prefix}/oidc/token` || req.path.startsWith(`/${prefix}/integrations/competitions`);
    if (!bearerEndpoint && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
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
