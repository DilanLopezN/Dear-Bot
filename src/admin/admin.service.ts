import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getAllUsers(search?: string, plan?: string, active?: string) {
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (plan) {
      where.plan = plan;
    }

    if (active !== undefined) {
      where.planActive = active === 'true';
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        planActive: true,
        planExpiresAt: true,
        cpfCnpj: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            bots: true,
          },
        },
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            value: true,
            billingType: true,
            nextDueDate: true,
            lastPaymentAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  }

  async getUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        planActive: true,
        planExpiresAt: true,
        cpfCnpj: true,
        asaasCustomerId: true,
        createdAt: true,
        updatedAt: true,
        subscription: true,
        _count: {
          select: {
            bots: true,
          },
        },
        bots: {
          select: {
            id: true,
            name: true,
            responseMode: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                conversations: true,
                keywords: true,
              },
            },
          },
        },
      },
    });
  }

  async updateUser(userId: string, data: {
    name?: string;
    email?: string;
    plan?: SubscriptionPlan;
    planActive?: boolean;
    cpfCnpj?: string;
  }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        planActive: true,
        planExpiresAt: true,
        cpfCnpj: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateUserPlan(userId: string, plan: SubscriptionPlan, planActive: boolean, planDays?: number) {
    const data: any = { plan, planActive };

    if (planDays && planDays > 0) {
      data.planExpiresAt = new Date(Date.now() + planDays * 24 * 60 * 60 * 1000);
    }

    if (planActive && !planDays) {
      data.planExpiresAt = null;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        planActive: true,
        planExpiresAt: true,
      },
    });
  }

  async deleteUser(userId: string) {
    return this.prisma.user.delete({ where: { id: userId } });
  }

  async getDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      usersByPlan,
      totalBots,
      totalConversations,
      totalMessages,
      recentUsers,
      subscriptions,
      monthlySignups,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { planActive: true } }),
      this.prisma.user.groupBy({
        by: ['plan'],
        _count: { id: true },
      }),
      this.prisma.bot.count(),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, name: true, email: true, plan: true, planActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { plan: true, value: true, billingType: true },
      }),
      this.getDailySignups(thirtyDaysAgo),
    ]);

    const activeSubscriptions = subscriptions.length;
    const mrr = subscriptions.reduce((sum, s) => sum + s.value, 0);

    const planDistribution = usersByPlan.map((p) => ({
      name: p.plan,
      value: p._count.id,
    }));

    const billingDistribution: Record<string, number> = {};
    subscriptions.forEach((s) => {
      billingDistribution[s.billingType] = (billingDistribution[s.billingType] || 0) + 1;
    });

    return {
      totals: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalBots,
        totalConversations,
        totalMessages,
        activeSubscriptions,
        mrr,
      },
      planDistribution,
      billingDistribution: Object.entries(billingDistribution).map(([name, value]) => ({ name, value })),
      recentUsers,
      monthlySignups,
    };
  }

  private async getDailySignups(since: Date) {
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyMap: Record<string, number> = {};
    users.forEach((u) => {
      const day = u.createdAt.toISOString().split('T')[0];
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    });

    return Object.entries(dailyMap).map(([date, count]) => ({
      date,
      signups: count,
    }));
  }
}
