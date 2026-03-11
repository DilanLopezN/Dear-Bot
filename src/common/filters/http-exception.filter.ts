import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno do servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message ?? message;
        error = resp.error ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaResult = this.handlePrismaError(exception);
      status = prismaResult.status;
      message = prismaResult.message;
      error = prismaResult.error;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Dados inválidos enviados para o banco de dados. Verifique os campos enviados.';
      error = 'Validation Error';
    } else if (exception instanceof Error) {
      message = exception.message || message;
      error = exception.name || error;
    }

    this.logger.error(
      `[${request.method}] ${request.url} → HTTP ${status}: ${JSON.stringify({ error, message })}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).send({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error,
      message,
    });
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (error.code) {
      case 'P2002': {
        const fields = (error.meta?.target as string[])?.join(', ') || 'campo';
        return {
          status: HttpStatus.CONFLICT,
          message: `Já existe um registro com este(s) valor(es) em: ${fields}`,
          error: 'Conflito de dados',
        };
      }
      case 'P2003': {
        const field = (error.meta?.field_name as string) || 'campo';
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Referência inválida no campo: ${field}. O registro relacionado não existe.`,
          error: 'Referência inválida',
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado ou já foi removido.',
          error: 'Não encontrado',
        };
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'A operação viola uma restrição de relação entre registros.',
          error: 'Restrição de relação',
        };
      case 'P2021':
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Tabela não encontrada no banco de dados. Verifique se as migrações estão atualizadas.',
          error: 'Erro de banco de dados',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Erro no banco de dados (código: ${error.code}). Tente novamente ou contate o suporte.`,
          error: 'Erro de banco de dados',
        };
    }
  }
}
