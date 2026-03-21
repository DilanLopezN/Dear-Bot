import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto'
import { PLAN_CONFIGS } from '../common/plans/plan-config'
import { hasFeature } from '../common/plans/plan-config'

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name)

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBotDto) {
    this.logger.log(`Criando bot para usuário ${userId}: ${dto.name}`)
    try {
      // Verificar limite de bots do plano
      const user = await this.prisma.user.findUnique({ where: { id: userId } })
      if (!user) throw new NotFoundException('Usuário não encontrado')

      const config = PLAN_CONFIGS[user.plan]
      const botCount = await this.prisma.bot.count({ where: { userId } })
      if (botCount >= config.maxBots) {
        throw new BadRequestException(
          `Limite de ${config.maxBots} bot(s) atingido no plano ${config.name}. Faça upgrade para criar mais bots.`
        )
      }

      // Tester só pode criar bot em modo KEYWORDS
      if (user.plan === 'TESTER' && dto.responseMode && dto.responseMode !== 'KEYWORDS') {
        throw new BadRequestException(
          'No plano Tester, o bot só pode funcionar no modo KEYWORDS. Faça upgrade para usar IA.'
        )
      }

      return await this.prisma.bot.create({
        data: { ...dto, userId },
        include: { whatsappChannel: true, aiConfig: true }
      })
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err
      this.logger.error(
        `Erro ao criar bot para usuário ${userId}: ${err.message}`,
        err.stack
      )
      throw err
    }
  }

  async findAll(userId: string) {
    this.logger.log(`Listando bots do usuário ${userId}`)
    try {
      return await this.prisma.bot.findMany({
        where: { userId },
        include: {
          whatsappChannel: true,
          aiConfig: true,
          _count: { select: { keywords: true, conversations: true } }
        }
      })
    } catch (err) {
      this.logger.error(
        `Erro ao listar bots do usuário ${userId}: ${err.message}`,
        err.stack
      )
      throw err
    }
  }

  async getDashboardOverview(userId: string) {
    this.logger.log(`Buscando dashboard overview do usuário ${userId}`)
    try {
      const weekStart = new Date()
      weekStart.setHours(0, 0, 0, 0)
      weekStart.setDate(weekStart.getDate() - 6)

      const [
        totalBots,
        activeBots,
        connectedBots,
        totalConversations,
        totalMessages,
        recentBots,
        messages,
        conversations
      ] = await Promise.all([
        this.prisma.bot.count({ where: { userId } }),
        this.prisma.bot.count({ where: { userId, isActive: true } }),
        this.prisma.bot.count({
          where: { userId, whatsappChannel: { isNot: null } }
        }),
        this.prisma.conversation.count({ where: { bot: { userId } } }),
        this.prisma.message.count({
          where: { conversation: { bot: { userId } } }
        }),
        this.prisma.bot.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            whatsappChannel: true,
            aiConfig: true,
            _count: { select: { keywords: true, conversations: true } }
          }
        }),
        this.prisma.message.findMany({
          where: {
            conversation: { bot: { userId } },
            createdAt: { gte: weekStart }
          },
          select: { createdAt: true }
        }),
        this.prisma.conversation.findMany({
          where: { bot: { userId }, createdAt: { gte: weekStart } },
          select: { createdAt: true }
        })
      ])

      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const dayMap = new Map<string, { mensagens: number; conversas: number }>()

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart)
        date.setDate(weekStart.getDate() + i)
        const key = date.toISOString().slice(0, 10)
        dayMap.set(key, { mensagens: 0, conversas: 0 })
      }

      messages.forEach(({ createdAt }) => {
        const key = createdAt.toISOString().slice(0, 10)
        const slot = dayMap.get(key)
        if (slot) slot.mensagens += 1
      })

      conversations.forEach(({ createdAt }) => {
        const key = createdAt.toISOString().slice(0, 10)
        const slot = dayMap.get(key)
        if (slot) slot.conversas += 1
      })

      const dailyMetrics = Array.from(dayMap.entries()).map(([key, values]) => {
        const date = new Date(`${key}T00:00:00.000Z`)
        return {
          name: dayNames[date.getUTCDay()],
          mensagens: values.mensagens,
          conversas: values.conversas
        }
      })

      return {
        totals: {
          totalBots,
          activeBots,
          connectedBots,
          totalConversations,
          totalMessages
        },
        recentBots,
        dailyMetrics
      }
    } catch (err) {
      this.logger.error(
        `Erro ao buscar dashboard overview do usuário ${userId}: ${err.message}`,
        err.stack
      )
      throw err
    }
  }

  async getReportsAnalytics(userId: string) {
    this.logger.log(`Buscando relatórios analíticos do usuário ${userId}`)
    try {
      const bots = await this.prisma.bot.findMany({
        where: { userId },
        include: {
          _count: { select: { conversations: true, keywords: true } }
        }
      })

      const botStats = await Promise.all(
        bots.map(async bot => {
          const messageCount = await this.prisma.message.count({
            where: { conversation: { botId: bot.id } }
          })
          return {
            name: bot.name.length > 14 ? bot.name.slice(0, 14) + '…' : bot.name,
            conversas: bot._count.conversations,
            mensagens: messageCount
          }
        })
      )

      const modes: Record<string, number> = {}
      bots.forEach(bot => {
        modes[bot.responseMode] = (modes[bot.responseMode] || 0) + 1
      })
      const modeDistribution = Object.entries(modes).map(([name, value]) => ({
        name,
        value
      }))

      const totalConversas = botStats.reduce((a, b) => a + b.conversas, 0)
      const totalMensagens = botStats.reduce((a, b) => a + b.mensagens, 0)

      return {
        botStats,
        modeDistribution,
        totals: {
          totalBots: bots.length,
          totalConversas,
          totalMensagens,
          mediaMsgPorBot: bots.length
            ? Math.round(totalMensagens / bots.length)
            : 0
        }
      }
    } catch (err) {
      this.logger.error(
        `Erro ao buscar relatórios do usuário ${userId}: ${err.message}`,
        err.stack
      )
      throw err
    }
  }

  async getMonthlyMetrics(userId: string) {
    this.logger.log(`Buscando métricas mensais do usuário ${userId}`)
    try {
      const monthStart = new Date()
      monthStart.setHours(0, 0, 0, 0)
      monthStart.setDate(monthStart.getDate() - 29)

      const [messages, conversations] = await Promise.all([
        this.prisma.message.findMany({
          where: {
            conversation: { bot: { userId } },
            createdAt: { gte: monthStart }
          },
          select: { createdAt: true, direction: true }
        }),
        this.prisma.conversation.findMany({
          where: { bot: { userId }, createdAt: { gte: monthStart } },
          select: { createdAt: true }
        })
      ])

      const dayMap = new Map<
        string,
        {
          mensagens: number
          conversas: number
          inbound: number
          outbound: number
        }
      >()
      for (let i = 0; i < 30; i++) {
        const date = new Date(monthStart)
        date.setDate(monthStart.getDate() + i)
        const key = date.toISOString().slice(0, 10)
        dayMap.set(key, { mensagens: 0, conversas: 0, inbound: 0, outbound: 0 })
      }

      messages.forEach(({ createdAt, direction }) => {
        const key = createdAt.toISOString().slice(0, 10)
        const slot = dayMap.get(key)
        if (slot) {
          slot.mensagens += 1
          if (direction === 'INBOUND') slot.inbound += 1
          else slot.outbound += 1
        }
      })

      conversations.forEach(({ createdAt }) => {
        const key = createdAt.toISOString().slice(0, 10)
        const slot = dayMap.get(key)
        if (slot) slot.conversas += 1
      })

      return Array.from(dayMap.entries()).map(([key, values]) => ({
        date: key,
        ...values
      }))
    } catch (err) {
      this.logger.error(
        `Erro ao buscar métricas mensais do usuário ${userId}: ${err.message}`,
        err.stack
      )
      throw err
    }
  }

  async findOne(userId: string, botId: string) {
    this.logger.log(`Buscando bot ${botId} do usuário ${userId}`)
    try {
      const bot = await this.prisma.bot.findUnique({
        where: { id: botId },
        include: { whatsappChannel: true, keywords: true, aiConfig: true }
      })
      if (!bot) throw new NotFoundException('Bot não encontrado')
      if (bot.userId !== userId)
        throw new ForbiddenException('Acesso negado a este bot')
      return bot
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException)
        throw err
      this.logger.error(
        `Erro ao buscar bot ${botId}: ${err.message}`,
        err.stack
      )
      throw err
    }
  }

  async update(userId: string, botId: string, dto: UpdateBotDto) {
    this.logger.log(`Atualizando bot ${botId} para usuário ${userId}`)
    try {
      await this.findOne(userId, botId)

      // Tester só pode usar modo KEYWORDS
      if (dto.responseMode && dto.responseMode !== 'KEYWORDS') {
        const user = await this.prisma.user.findUnique({ where: { id: userId } })
        if (user?.plan === 'TESTER') {
          throw new BadRequestException(
            'No plano Tester, o bot só pode funcionar no modo KEYWORDS. Faça upgrade para usar IA.'
          )
        }
      }

      const { aiConfigId, flowConfig, ...rest } = dto as any
      const updateData: Record<string, any> = { ...rest }

      if (aiConfigId !== undefined) {
        updateData.aiConfigId = aiConfigId || null
      }

      if (flowConfig !== undefined) {
        updateData.flowConfig = flowConfig
      }

      return await this.prisma.bot.update({
        where: { id: botId },
        data: updateData,
        include: { whatsappChannel: true, aiConfig: true }
      })
    } catch (err) {
      this.logger.error(err)

      if (err instanceof NotFoundException || err instanceof ForbiddenException)
        throw err
      this.logger.error(
        `Erro ao atualizar bot ${botId}: ${err.message}`,
        err.stack
      )
      throw err
    }
  }

  async remove(userId: string, botId: string) {
    this.logger.log(`Removendo bot ${botId} para usuário ${userId}`)
    try {
      await this.findOne(userId, botId)
      return await this.prisma.bot.delete({ where: { id: botId } })
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException)
        throw err
      this.logger.error(
        `Erro ao remover bot ${botId}: ${err.message}`,
        err.stack
      )
      throw err
    }
  }
}
