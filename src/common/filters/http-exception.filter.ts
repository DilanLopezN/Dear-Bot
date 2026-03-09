import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { FastifyReply } from 'fastify';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    this.logger.error(`HTTP ${status}: ${JSON.stringify(exceptionResponse)}`);

    response.status(status).send({
      statusCode: status,
      timestamp: new Date().toISOString(),
      ...(typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as object)),
    });
  }
}
