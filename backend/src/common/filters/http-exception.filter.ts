import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const responseBody = exceptionResponse as Record<string, unknown>;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : typeof responseBody.message === 'string'
          ? responseBody.message
          : 'Interner Serverfehler';

    response.status(status).json({
      error: {
        statusCode: status,
        message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}
