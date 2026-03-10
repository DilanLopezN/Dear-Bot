import { useEffect, useState } from 'react';
import { useBotStore, type Bot } from '@/stores/bot.store';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useTheme } from '@/ThemeContext';
import Button from '@/components/ui/Button';
import InputField from '@/components/ui/InputField';

export default function BotsPage() {
  const { bots, fetchBots, createBot, updateBot, deleteBot } = useBotStore();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Bot | null>(null);
  const { theme } = useTheme();

  useEffect(() => { fetchBots(); }, [fetchBots]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: theme.textPrimary }}>Bots</h1>
      </div>
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20, display: 'grid', gap: 12 }}>
        <InputField value={name} onChange={(e) => setName(e.target.value)} placeholder='Nome do bot' />
        <Button icon={<Plus size={16} />} onClick={async () => { if (!name.trim()) return; await createBot({ name }); setName(''); }}>
          Criar bot
        </Button>
      </div>
      {bots.map((bot) => (
        <div key={bot.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editing?.id === bot.id ? (
            <InputField value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <div>
              <strong style={{ color: theme.textPrimary }}>{bot.name}</strong>
              <p style={{ color: theme.textSecondary, margin: '6px 0 0' }}>{bot.responseMode}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {editing?.id === bot.id ? (
              <Button onClick={async () => { await updateBot(bot.id, { name }); setEditing(null); setName(''); }}>Salvar</Button>
            ) : (
              <Button variant='secondary' icon={<Pencil size={16} />} onClick={() => { setEditing(bot); setName(bot.name); }}>Editar</Button>
            )}
            <Button variant='danger' icon={<Trash2 size={16} />} onClick={() => deleteBot(bot.id)}>Excluir</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
