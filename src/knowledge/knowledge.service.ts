import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import * as path from 'path';

const CHUNK_SIZE = 800; // ~800 palavras por chunk
const CHUNK_OVERLAP = 100; // overlap de 100 palavras entre chunks
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.csv', '.xlsx', '.xls'];

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private prisma: PrismaService,
    private botService: BotService,
  ) {}

  /** Lista todos os documentos de conhecimento de um bot */
  async findAll(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);
    return this.prisma.botKnowledge.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        totalChunks: true,
        createdAt: true,
      },
    });
  }

  /** Faz upload e processa um arquivo de conhecimento */
  async upload(userId: string, botId: string, file: { buffer: Buffer; originalName: string; size: number }) {
    await this.botService.findOne(userId, botId);

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Arquivo muito grande. O tamanho máximo é 10MB.');
    }

    const ext = path.extname(file.originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Tipo de arquivo não suportado: ${ext}. Use: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    const fileType = ext.replace('.', '');
    this.logger.log(`Processando arquivo "${file.originalName}" (${fileType}, ${file.size} bytes) para bot ${botId}`);

    // Extrair texto do arquivo
    const text = await this.extractText(file.buffer, fileType);

    if (!text || text.trim().length === 0) {
      throw new BadRequestException('Não foi possível extrair texto do arquivo. Verifique se o arquivo contém conteúdo de texto.');
    }

    // Dividir em chunks
    const chunks = this.splitIntoChunks(text);

    // Salvar no banco
    const knowledge = await this.prisma.botKnowledge.create({
      data: {
        botId,
        fileName: file.originalName,
        fileType,
        fileSize: file.size,
        totalChunks: chunks.length,
      },
    });

    // Salvar chunks
    await this.prisma.knowledgeChunk.createMany({
      data: chunks.map((content, index) => ({
        knowledgeId: knowledge.id,
        content,
        chunkIndex: index,
        wordCount: content.split(/\s+/).length,
      })),
    });

    this.logger.log(`Arquivo "${file.originalName}" processado: ${chunks.length} chunks criados`);

    return {
      id: knowledge.id,
      fileName: knowledge.fileName,
      fileType: knowledge.fileType,
      fileSize: knowledge.fileSize,
      totalChunks: chunks.length,
      createdAt: knowledge.createdAt,
    };
  }

  /** Remove um documento de conhecimento */
  async remove(userId: string, botId: string, knowledgeId: string) {
    await this.botService.findOne(userId, botId);

    const knowledge = await this.prisma.botKnowledge.findFirst({
      where: { id: knowledgeId, botId },
    });

    if (!knowledge) {
      throw new NotFoundException('Documento de conhecimento não encontrado.');
    }

    await this.prisma.botKnowledge.delete({ where: { id: knowledgeId } });
    this.logger.log(`Documento "${knowledge.fileName}" removido do bot ${botId}`);
    return { message: 'Documento removido com sucesso.' };
  }

  /** Busca chunks relevantes para uma pergunta usando busca textual */
  async searchRelevantChunks(botId: string, query: string, maxChunks = 5): Promise<string[]> {
    // Buscar todos os chunks do bot
    const allChunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        knowledge: { botId },
      },
      select: {
        content: true,
        knowledge: { select: { fileName: true } },
      },
    });

    if (allChunks.length === 0) return [];

    // Busca por relevância usando palavras-chave
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2) // ignora palavras muito curtas
      .map((w) => w.replace(/[^\w\sáàãâéèêíìîóòõôúùûçñ]/gi, '')); // remove pontuação

    if (queryWords.length === 0) return [];

    // Pontuar cada chunk pela relevância
    const scored = allChunks.map((chunk) => {
      const contentLower = chunk.content.toLowerCase();
      let score = 0;

      for (const word of queryWords) {
        // Conta ocorrências da palavra no chunk
        const regex = new RegExp(word, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length;
        }
      }

      // Bonus por ter múltiplas palavras da query
      const uniqueMatches = queryWords.filter((w) => contentLower.includes(w));
      score += uniqueMatches.length * 2;

      return { content: chunk.content, fileName: chunk.knowledge.fileName, score };
    });

    // Ordenar por score e pegar os top N
    const relevant = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxChunks);

    return relevant.map((r) => `[Fonte: ${r.fileName}]\n${r.content}`);
  }

  /** Verifica se o bot possui documentos de conhecimento */
  async hasKnowledge(botId: string): Promise<boolean> {
    const count = await this.prisma.botKnowledge.count({ where: { botId } });
    return count > 0;
  }

  // ── Text Extraction ─────────────────────────────────────────────

  private async extractText(buffer: Buffer, fileType: string): Promise<string> {
    switch (fileType) {
      case 'txt':
        return buffer.toString('utf-8');

      case 'csv':
        return this.extractCsv(buffer);

      case 'pdf':
        return this.extractPdf(buffer);

      case 'xlsx':
      case 'xls':
        return this.extractExcel(buffer);

      default:
        throw new BadRequestException(`Tipo de arquivo não suportado: ${fileType}`);
    }
  }

  private extractCsv(buffer: Buffer): string {
    const text = buffer.toString('utf-8');
    // Converte CSV para texto legível, separando linhas e colunas
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return '';

    // Primeira linha como cabeçalho
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1);

    const result: string[] = [];
    for (const row of rows) {
      const values = row.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const pairs = headers.map((h, i) => `${h}: ${values[i] || ''}`);
      result.push(pairs.join(', '));
    }

    return result.join('\n');
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    } catch (error) {
      this.logger.error(`Erro ao extrair PDF: ${error.message}`);
      throw new BadRequestException('Erro ao processar o arquivo PDF. Verifique se o arquivo é um PDF válido.');
    }
  }

  private async extractExcel(buffer: Buffer): Promise<string> {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const result: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

        if (rows.length > 0) {
          result.push(`--- ${sheetName} ---`);
          for (const row of rows) {
            const pairs = Object.entries(row)
              .map(([key, val]) => `${key}: ${val}`)
              .join(', ');
            result.push(pairs);
          }
        }
      }

      return result.join('\n');
    } catch (error) {
      this.logger.error(`Erro ao extrair Excel: ${error.message}`);
      throw new BadRequestException('Erro ao processar o arquivo Excel. Verifique se o arquivo é válido.');
    }
  }

  // ── Chunking ─────────────────────────────────────────────────────

  private splitIntoChunks(text: string): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);

    if (words.length <= CHUNK_SIZE) {
      return [words.join(' ')];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + CHUNK_SIZE, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }

    return chunks;
  }
}
