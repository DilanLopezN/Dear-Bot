# Chatbot SaaS - WhatsApp

Backend NestJS + Fastify + Prisma + PostgreSQL para sistema SaaS de chatbots WhatsApp.

## Stack
- **NestJS** com **Fastify** adapter
- **Prisma ORM** + PostgreSQL
- **Claude AI** (Anthropic) para respostas inteligentes
- **Dialog360** para integração WhatsApp

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env (copie de .env.example)
cp .env.example .env

# 3. Gerar Prisma Client
npx prisma generate

# 4. Rodar migrations
npx prisma migrate dev --name init

# 5. Iniciar em dev
npm run start:dev
```

## Arquitetura

```
src/
├── auth/                # Register + Login (JWT)
├── bot/                 # CRUD de bots
├── keyword/             # CRUD de palavras-chave por bot
├── whatsapp-channel/    # Configuração do número WhatsApp (Dialog360)
├── conversation/        # Conversas e mensagens
├── webhook/             # Recebe mensagens do Dialog360 e processa
├── services/
│   ├── dialog360.service.ts   # Envio/recebimento WhatsApp
│   └── claude.service.ts      # Geração de respostas com IA
├── prisma/              # PrismaService global
└── common/              # Guards, decorators, filters
```

## API Endpoints

### Auth
| Método | Rota              | Descrição       |
|--------|-------------------|-----------------|
| POST   | `/auth/register`  | Criar conta     |
| POST   | `/auth/login`     | Login (JWT)     |

### Bots (autenticado)
| Método | Rota          | Descrição        |
|--------|---------------|------------------|
| POST   | `/bots`       | Criar bot        |
| GET    | `/bots`       | Listar meus bots |
| GET    | `/bots/:id`   | Detalhes do bot  |
| PUT    | `/bots/:id`   | Atualizar bot    |
| DELETE | `/bots/:id`   | Deletar bot      |

### Keywords (autenticado)
| Método | Rota                              | Descrição            |
|--------|-----------------------------------|----------------------|
| POST   | `/bots/:botId/keywords`           | Criar keyword        |
| GET    | `/bots/:botId/keywords`           | Listar keywords      |
| PUT    | `/bots/:botId/keywords/:id`       | Atualizar keyword    |
| DELETE | `/bots/:botId/keywords/:id`       | Deletar keyword      |

### WhatsApp Channel (autenticado)
| Método | Rota                       | Descrição              |
|--------|----------------------------|------------------------|
| POST   | `/bots/:botId/whatsapp`    | Conectar número        |
| PUT    | `/bots/:botId/whatsapp`    | Atualizar config       |
| DELETE | `/bots/:botId/whatsapp`    | Desconectar número     |

### Conversas (autenticado)
| Método | Rota                                            | Descrição          |
|--------|-------------------------------------------------|--------------------|
| GET    | `/bots/:botId/conversations`                    | Listar conversas   |
| GET    | `/bots/:botId/conversations/:id/messages`       | Mensagens          |

### Webhook (público - chamado pelo Dialog360)
| Método | Rota               | Descrição                    |
|--------|--------------------|-----------------------------|
| POST   | `/webhook/:botId`  | Recebe mensagens WhatsApp   |

## Modos de Resposta do Bot

- **KEYWORDS**: Responde apenas por palavras-chave configuradas
- **AI**: Todas as respostas via Claude AI
- **HYBRID**: Tenta keyword primeiro, se não achar usa Claude AI

## Fluxo de Mensagem

```
WhatsApp → Dialog360 → POST /webhook/:botId
                              ↓
                     1. Identifica bot + canal
                     2. Marca como lida
                     3. Salva msg recebida
                     4. Processa resposta (keyword/AI/hybrid)
                     5. Envia via Dialog360
                     6. Salva msg enviada
```
