import { useEffect, useState, useRef, useCallback } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { useBotStore } from '@/stores/bot.store';
import type { ChatConversation, ChatMessage } from '@/services/api';
import {
  MessageSquare,
  Send,
  UserCheck,
  Bot,
  Loader2,
  Phone,
  ArrowLeftRight,
} from 'lucide-react';
import { toast } from 'sonner';
import './ChatPage.css';

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function getInitials(name: string | null, phone: string) {
  if (name) {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  return phone.slice(-2);
}

const statusLabels: Record<string, { label: string; className: string }> = {
  BOT: { label: 'Bot', className: 'badge-accent' },
  HUMAN: { label: 'Humano', className: 'badge-blue' },
  WAITING: { label: 'Aguardando', className: 'badge-yellow' },
  CLOSED: { label: 'Encerrado', className: 'badge-muted' },
};

const waitTimeOptions = [
  { value: '', label: 'Tempo de espera' },
  { value: '5', label: '> 5 min' },
  { value: '15', label: '> 15 min' },
  { value: '30', label: '> 30 min' },
  { value: '60', label: '> 1 hora' },
];

export default function ChatPage() {
  const {
    chats,
    selectedChat,
    messages,
    filters,
    loading,
    loadingMessages,
    setFilters,
    fetchChats,
    selectChat,
    fetchMessages,
    takeover,
    release,
    sendMessage,
  } = useChatStore();

  const { bots, fetchBots } = useBotStore();
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchBots();
    fetchChats();
  }, [fetchBots, fetchChats]);

  // Polling para atualizar chats e mensagens a cada 5s
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchChats();
      if (selectedChat) {
        fetchMessages(selectedChat.id);
      }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchChats, fetchMessages, selectedChat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!messageInput.trim() || !selectedChat || sending) return;
    setSending(true);
    try {
      await sendMessage(selectedChat.id, messageInput.trim());
      setMessageInput('');
    } catch {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  }, [messageInput, selectedChat, sending, sendMessage]);

  const handleTakeover = useCallback(async (chat: ChatConversation) => {
    try {
      await takeover(chat.id);
      toast.success('Atendimento assumido');
    } catch {
      toast.error('Erro ao assumir atendimento');
    }
  }, [takeover]);

  const handleRelease = useCallback(async (chat: ChatConversation) => {
    try {
      await release(chat.id);
      toast.success('Atendimento devolvido ao bot');
    } catch {
      toast.error('Erro ao devolver atendimento');
    }
  }, [release]);

  const isHumanMode = selectedChat?.status === 'HUMAN';

  return (
    <div className="page-container chat-page">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Chat</h1>
          <p className="page-header__subtitle">Gerencie os atendimentos dos seus bots</p>
        </div>
      </div>

      <div className="chat-layout">
        {/* Sidebar - Chat List */}
        <div className="chat-sidebar">
          <div className="chat-filters">
            <div className="chat-filters__row">
              <select
                className="chat-filters__select"
                value={filters.botId || ''}
                onChange={(e) => setFilters({ ...filters, botId: e.target.value || undefined })}
              >
                <option value="">Todos os bots</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>{bot.name}</option>
                ))}
              </select>
              <select
                className="chat-filters__select"
                value={filters.minWaitMinutes ? String(filters.minWaitMinutes) : ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    minWaitMinutes: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
              >
                {waitTimeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="chat-filters__row">
              <select
                className="chat-filters__select"
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
              >
                <option value="">Todos os status</option>
                <option value="BOT">Bot</option>
                <option value="HUMAN">Humano</option>
                <option value="WAITING">Aguardando</option>
              </select>
            </div>
          </div>

          <div className="chat-list">
            {loading && chats.length === 0 ? (
              <div className="loader" style={{ padding: 40 }}>
                <Loader2 size={18} className="animate-spin" /> Carregando...
              </div>
            ) : chats.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <MessageSquare size={32} className="empty-state__icon" />
                <p className="empty-state__text">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              chats.map((chat) => {
                const st = statusLabels[chat.status] || statusLabels.BOT;
                return (
                  <div
                    key={chat.id}
                    className={`chat-item${selectedChat?.id === chat.id ? ' chat-item--active' : ''}`}
                    onClick={() => selectChat(chat)}
                  >
                    <div className="chat-item__avatar">
                      {getInitials(chat.contactName, chat.contactPhone)}
                    </div>
                    <div className="chat-item__info">
                      <div className="chat-item__header">
                        <span className="chat-item__name">
                          {chat.contactName || chat.contactPhone}
                        </span>
                        <span className="chat-item__time">
                          {formatRelativeTime(chat.lastMessageAt)}
                        </span>
                      </div>
                      <div className="chat-item__preview">
                        {chat.lastMessage?.content || 'Sem mensagens'}
                      </div>
                      <div className="chat-item__meta">
                        <span className={`badge ${st.className}`}>{st.label}</span>
                        <span className="badge badge-muted">{chat.botName}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-main">
          {!selectedChat ? (
            <div className="chat-empty">
              <MessageSquare size={48} className="chat-empty__icon" />
              <p className="chat-empty__text">Selecione uma conversa para visualizar</p>
            </div>
          ) : (
            <>
              <div className="chat-main__header">
                <div className="chat-main__contact">
                  <div className="chat-item__avatar">
                    {getInitials(selectedChat.contactName, selectedChat.contactPhone)}
                  </div>
                  <div>
                    <div className="chat-main__contact-name">
                      {selectedChat.contactName || selectedChat.contactPhone}
                    </div>
                    <div className="chat-main__contact-phone">
                      <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
                      {selectedChat.contactPhone}
                    </div>
                  </div>
                </div>
                <div className="chat-main__actions">
                  {isHumanMode ? (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleRelease(selectedChat)}
                    >
                      <Bot size={15} />
                      Devolver ao Bot
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleTakeover(selectedChat)}
                    >
                      <UserCheck size={15} />
                      Assumir Atendimento
                    </button>
                  )}
                </div>
              </div>

              {isHumanMode && (
                <div className="chat-takeover-banner">
                  <ArrowLeftRight size={14} />
                  Atendimento humano ativo - As mensagens do bot estao pausadas
                </div>
              )}

              {!isHumanMode && (
                <div className="chat-bot-banner">
                  <Bot size={14} />
                  Bot respondendo automaticamente
                </div>
              )}

              <div className="chat-messages">
                {loadingMessages && messages.length === 0 ? (
                  <div className="loader" style={{ flex: 1 }}>
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : (
                  messages.map((msg: ChatMessage) => {
                    const isInbound = msg.direction === 'INBOUND';
                    const isHuman = msg.senderType === 'HUMAN';
                    return (
                      <div
                        key={msg.id}
                        className={`chat-bubble ${isInbound ? 'chat-bubble--inbound' : 'chat-bubble--outbound'} ${isHuman ? 'chat-bubble--human' : ''}`}
                      >
                        {isHuman && (
                          <div className="chat-bubble__sender">Atendente</div>
                        )}
                        {msg.content}
                        <div className="chat-bubble__time">{formatTime(msg.createdAt)}</div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <input
                  type="text"
                  placeholder={
                    isHumanMode
                      ? 'Digite sua mensagem...'
                      : 'Assuma o atendimento para enviar mensagens'
                  }
                  disabled={!isHumanMode}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  className="btn btn-primary"
                  disabled={!isHumanMode || !messageInput.trim() || sending}
                  onClick={handleSend}
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
