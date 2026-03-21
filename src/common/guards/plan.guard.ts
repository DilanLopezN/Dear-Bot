import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanFeature, hasFeature } from '../plans/plan-config';

export const PLAN_FEATURE_KEY = 'plan_feature';
export const RequirePlanFeature = (...features: PlanFeature[]) =>
  SetMetadata(PLAN_FEATURE_KEY, features);

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeatures = this.reflector.getAllAndOverride<PlanFeature[]>(
      PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeatures || requiredFeatures.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    // Verificar se o plano está ativo
    if (!user.planActive) {
      throw new ForbiddenException(
        'Seu plano está inativo. Realize o pagamento para reativar o acesso.',
      );
    }

    // Verificar se o plano tester expirou
    if (user.plan === 'TESTER' && user.planExpiresAt) {
      if (new Date() > new Date(user.planExpiresAt)) {
        throw new ForbiddenException(
          'Seu período de teste expirou. Faça upgrade para o plano Pro ou Enterprise.',
        );
      }
    }

    // Verificar se o plano do usuário tem acesso à feature
    for (const feature of requiredFeatures) {
      if (!hasFeature(user.plan, feature)) {
        throw new ForbiddenException(
          `Seu plano ${user.plan} não tem acesso a esta funcionalidade. Faça upgrade para continuar.`,
        );
      }
    }

    return true;
  }
}
