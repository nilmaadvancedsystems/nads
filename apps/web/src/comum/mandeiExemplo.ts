// O Mandei com dados de exemplo (Vitor, 07/10/2026: "até a regra do banco ser publicada, funciona com dados de
// exemplo"): os tickets e os arquivos anexados ficam neste navegador, num lugar só, que a Tarefa (a central) e o
// formulário do cliente (/mandei/<código>) leem. Assim dá para testar o caminho inteiro no mesmo navegador. Quando a
// regra for publicada, entram os repositórios do banco (o do escritório e o do formulário), com as mesmas funções.
import { mandei as m } from '@nads/core';

const CHAVE = 'nads-mandei-exemplo-v1';
const CHAVE_ARQ = 'nads-mandei-exemplo-arquivos-v1';
/** O maior arquivo guardado no exemplo (no banco, o limite é o do envio ao Claudio Secretário). */
export const MAIOR_ARQUIVO_NO_EXEMPLO = 2 * 1024 * 1024;

interface Guardado { tickets: m.Ticket[]; proximo: number }

function ler(): Guardado {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE) || 'null') as Guardado | null;
    return g && Array.isArray(g.tickets) ? g : { tickets: [], proximo: 1 };
  } catch { return { tickets: [], proximo: 1 }; }
}

const ouvintes = new Set<() => void>();
let ver = 0;
const avisar = () => { ver++; for (const f of ouvintes) f(); };
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === CHAVE) avisar(); });

function gravar(g: Guardado) {
  try { localStorage.setItem(CHAVE, JSON.stringify(g)); } catch { /* sem armazenamento: só nesta tela */ }
  avisar();
}

export const exemplo = {
  assinar(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
  versao: () => ver,
  tickets: (): m.Ticket[] => ler().tickets,
  /** Cria o ticket com o número seguinte. */
  criar(d: m.DadosDoTicket, codigo: string, agora: Date): m.Ticket {
    const g = ler();
    const t = m.novoTicket(d, 'ex-' + agora.getTime().toString(36) + '-' + g.proximo, g.proximo, codigo, agora);
    gravar({ tickets: [t, ...g.tickets], proximo: g.proximo + 1 });
    return t;
  },
  gravar(t: m.Ticket) {
    const g = ler();
    gravar({ ...g, tickets: g.tickets.map(x => (x.id === t.id ? t : x)) });
  },
  apagar(id: string) {
    const g = ler();
    gravar({ ...g, tickets: g.tickets.filter(t => t.id !== id) });
  },
  /** O ticket do link (pelo código de qualquer um dos links dele). */
  doLink: (codigo: string): m.Ticket | null => ler().tickets.find(t => t.links.some(l => l.codigo === codigo)) || null,
  guardarArquivo(id: string, dataUrl: string) {
    try {
      const a = JSON.parse(localStorage.getItem(CHAVE_ARQ) || '{}') as Record<string, string>;
      localStorage.setItem(CHAVE_ARQ, JSON.stringify({ ...a, [id]: dataUrl }));
      return true;
    } catch { return false; }
  },
  arquivo(id: string): string | null {
    try { return (JSON.parse(localStorage.getItem(CHAVE_ARQ) || '{}') as Record<string, string>)[id] || null; } catch { return null; }
  },
};

export const codigoNovo = () => m.codigoDoLink(n => crypto.getRandomValues(new Uint8Array(n)));
