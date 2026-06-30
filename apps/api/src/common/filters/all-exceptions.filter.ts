import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PinoLogger } from 'nestjs-pino';
import { InjectPinoLogger } from 'nestjs-pino';
import * as Sentry from '@sentry/node';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const requestId = String(request.id ?? '');
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const {
          message: msg,
          statusCode: _sc,
          error: _err,
          ...rest
        } = body as Record<string, unknown>;
        if (typeof msg === 'string') {
          message = msg;
        } else if (Array.isArray(msg)) {
          message = (msg as string[]).join('; ');
        } else {
          message = exception.message;
        }
        extra = rest;
      } else if (typeof body === 'string') {
        message = body;
      }
    }

    if (status >= 500) {
      this.logger.error({ requestId, err: exception }, 'Unhandled exception');
      if (process.env['SENTRY_DSN']) {
        Sentry.withScope((scope) => {
          scope.setTag('requestId', requestId);
          Sentry.captureException(exception);
        });
      }
    } else {
      this.logger.warn({ requestId, status }, message);
    }

    void reply.code(status).send({
      statusCode: status,
      error: httpStatusText(status),
      message,
      requestId,
      ...extra,
    });
  }
}

function httpStatusText(status: number): string {
  const texts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    503: 'Service Unavailable',
  };
  return texts[status] ?? (status >= 500 ? 'Internal Server Error' : 'Error');
}
