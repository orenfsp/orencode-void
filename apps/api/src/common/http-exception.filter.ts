import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { Prisma } from "@prisma/client";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const errors: Record<string, [number, string]> = {
        P2002: [409, "Такая запись уже существует. Обновите страницу."],
        P2003: [
          400,
          "Связанная запись не найдена или используется другими данными.",
        ],
        P2025: [409, "Запись не найдена или уже изменена. Обновите страницу."],
        P2034: [409, "Данные изменились одновременно. Повторите действие."],
      };
      const mapped = errors[exception.code];
      if (mapped) {
        res
          .status(mapped[0])
          .json({
            success: false,
            error: { code: exception.code, message: mapped[1] },
          });
        return;
      }
    }
    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : null;
    const message =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object" && "message" in payload
          ? (payload as { message: string | string[] }).message
          : "Внутренняя ошибка сервера";

    if (!isHttp) {
      this.logger.error(exception);
    }

    res.status(status).json({
      success: false,
      error: {
        code: isHttp ? "HTTP_ERROR" : "INTERNAL_ERROR",
        message: Array.isArray(message) ? message.join("; ") : message,
        details: typeof payload === "object" ? payload : undefined,
      },
    });
  }
}
