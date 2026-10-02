// ViewModel do chat com a IA (a Minha página › Perguntar à IA): as conversas da pessoa (as mesmas do "Perguntar à IA"
// do Entregas), a conversa aberta, mandar a pergunta e esperar a resposta (que o robô escreve aos poucos).
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useIA } from '../../dados/repo';

/** Quanto esperar a resposta antes de avisar que a IA não respondeu (o Entregas desiste em 120 s). */
const PACIENCIA_MS = 120 * 1000;

export function useChatIA() {
  const repo = useIA();
  const { toast } = useRetorno();
  const [conversa, setConversa] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  // o relógio da espera (o aviso de "não respondeu" aparece sem a conversa mudar)
  useEffect(() => { const r = setInterval(() => setAgora(Date.now()), 10 * 1000); return () => clearInterval(r); }, []);

  const disponivel = repo.disponivel();
  const conversas = repo.conversas();
  const msgs = conversa ? repo.mensagens(conversa) : { carregadas: true, lista: [] };
  const ultima = msgs.lista[msgs.lista.length - 1];
  const esperando = enviando || ultima?.papel === 'user' || ultima?.estado === 'gerando';
  const semResposta = !enviando && ultima?.papel === 'user' && agora - ultima.ordem > PACIENCIA_MS;

  return {
    exemplos: repo.exemplos,
    carregando: !disponivel.carregada,
    ligada: disponivel.ligada,
    motor: disponivel.motor === 'claude' ? 'Claude' : disponivel.motor === 'gemini' ? 'Gemini' : disponivel.motor,
    conversas: conversas.lista,
    conversa,
    abrir: (id: string) => setConversa(id),
    nova: () => setConversa(null),
    mensagens: msgs.lista,
    esperando,
    semResposta,
    perguntar: async (texto: string): Promise<boolean> => {
      const t = texto.trim();
      if (!t || esperando) return false;
      setEnviando(true);
      try {
        const id = await repo.perguntar(conversa, t);
        setConversa(id);
        return true;
      } catch (err) {
        toast('Não consegui mandar a pergunta (' + (err instanceof Error ? err.message : String(err)) + ').');
        return false;
      } finally { setEnviando(false); }
    },
    apagar: (id: string) => {
      void repo.apagar(id).then(() => { if (id === conversa) setConversa(null); }, () => toast('Não consegui apagar a conversa.'));
    },
  };
}

export type VmChatIA = ReturnType<typeof useChatIA>;
