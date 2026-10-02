// O chat com a IA do escritório na Tarefas (Vitor, 02/10/2026: "coloque o chat de IA treinado"). É o MESMO chat do
// Entregas (conversasIA): o navegador grava a pergunta e um robô responde — o Claude no PC do escritório ou o Gemini
// na nuvem, conforme o escritório escolheu em Ajustes › Integrações. Para dúvidas de uso, a IA consulta o guia do app,
// que inclui as Perguntas frequentes da Tarefas (ajuda/faq-tarefas.md, copiadas com `npm run faq`).
// Interface + a versão de exemplo (sem robô: responde com o que acha no FAQ); a do banco é ia.firestore.ts.
import { buscarNoFaq } from '../ajuda/faq';

export interface MensagemIA {
  id: string;
  papel: 'user' | 'model';
  texto: string;
  /** a resposta: gerando (chegando aos poucos), pronta ou erro */
  estado: 'gerando' | 'pronta' | 'erro' | '';
  /** o que a IA está consultando agora (o nome da ferramenta), enquanto gera */
  consultando: string;
  erro: string;
  ordem: number;
  /** a IA propôs uma ação (só o Entregas confirma ações) */
  temAcoes: boolean;
}

export interface ConversaIA { id: string; titulo: string; atualizadoEm: string; estado: string }

export interface RepoIA {
  exemplos: boolean;
  /** a IA está de pé? (o robô bate o ponto em robo/estado.ia) */
  disponivel(): { carregada: boolean; ligada: boolean; motor: string };
  conversas(): { carregadas: boolean; lista: ConversaIA[] };
  mensagens(conversa: string): { carregadas: boolean; lista: MensagemIA[] };
  /** pergunta (numa conversa, ou abre uma nova): devolve o id da conversa */
  perguntar(conversa: string | null, texto: string): Promise<string>;
  apagar(conversa: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos não há robô: a "IA" responde com a pergunta frequente que mais bate (para ver a tela funcionando). */
export function criarIAMemoria(): RepoIA {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const conversas: ConversaIA[] = [];
  const mensagens: Record<string, MensagemIA[]> = {};
  return {
    exemplos: true,
    disponivel: () => ({ carregada: true, ligada: true, motor: 'exemplo' }),
    conversas: () => ({ carregadas: true, lista: conversas.slice().sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)) }),
    mensagens: id => ({ carregadas: true, lista: mensagens[id] || [] }),
    async perguntar(conversa, texto) {
      const agora = new Date().toISOString();
      const id = conversa || 'c' + Date.now();
      if (!conversa) { conversas.push({ id, titulo: texto.slice(0, 60), atualizadoEm: agora, estado: 'ocioso' }); mensagens[id] = []; }
      const lista = mensagens[id];
      lista.push({ id: 'm' + Date.now(), papel: 'user', texto, estado: '', consultando: '', erro: '', ordem: Date.now(), temAcoes: false });
      const achada = buscarNoFaq(texto)[0];
      lista.push({
        id: 'm' + (Date.now() + 1), papel: 'model', estado: 'pronta', consultando: '', erro: '', ordem: Date.now() + 1, temAcoes: false,
        texto: achada ? '**' + achada.pergunta + '**\n' + achada.resposta + '\n\n(Resposta de exemplo, tirada das Perguntas frequentes: aqui não há robô.)'
          : 'Não achei isso nas Perguntas frequentes. (Exemplo: aqui não há robô; no site, quem responde é a IA do escritório.)',
      });
      const c = conversas.find(x => x.id === id);
      if (c) c.atualizadoEm = agora;
      mudou();
      return id;
    },
    async apagar(conversa) {
      const i = conversas.findIndex(x => x.id === conversa);
      if (i >= 0) conversas.splice(i, 1);
      delete mensagens[conversa];
      mudou();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
