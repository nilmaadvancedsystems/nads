// ViewModel de Cadastro › Agentes (Vitor, 13/10/2026: "tem como upar uma página no nads disso?"): as sessões do Claude
// Code que o robô do PC publica (painelAgentes), as ativas em cima, com os números do topo, o nível do porteiro em
// palavras e o "há X" andando sozinho.
import { useEffect, useState } from 'react';
import type { SessaoDeAgentes } from '../../../dados/agentes';
import { useAgentes } from '../../../dados/repo';

export type FiltroDosAgentes = 'ativas' | 'todas';

const ATIVA_MS = 2 * 60 * 60 * 1000;

/** As ferramentas em português e curtas (o MCP vira o nome do servidor). */
const FERRAMENTAS: Record<string, string> = {
  Bash: 'Comando', PowerShell: 'PowerShell', Read: 'Lê', Write: 'Escreve', Edit: 'Edita', Grep: 'Busca', Glob: 'Arquivos',
  Agent: 'Delega', Task: 'Delega', SendMessage: 'Mensagem', WebFetch: 'Web', WebSearch: 'Pesquisa', Skill: 'Skill',
  ToolSearch: 'Ferramentas', AskUserQuestion: 'Pergunta', TodoWrite: 'Tarefas', Workflow: 'Workflow', Monitor: 'Monitor',
};
export function nomeDaFerramenta(f: string): string {
  if (!f) return '';
  if (FERRAMENTAS[f]) return FERRAMENTAS[f];
  const m = /^mcp__(.+?)__(.+)$/.exec(f);
  if (!m) return f;
  const srv = m[1] === 'Claude_Browser' ? 'navegador' : m[1] === 'claude-in-chrome' ? 'Chrome' : /^[0-9a-f-]{20,}$/.test(m[1]) ? 'conector' : m[1].startsWith('ccd_') ? 'app' : m[1];
  return srv + ' · ' + m[2].replace(/^browser_/, '');
}

export const NIVEL: Record<string, string> = { rapido: 'fácil', padrao: 'normal', forte: 'difícil' };
export const STATUS: Record<string, { rotulo: string; badge: string }> = {
  trabalhando: { rotulo: 'Trabalhando', badge: 'badge-ok' },
  esperando: { rotulo: 'Esperando você', badge: 'badge-warn' },
  parado: { rotulo: 'Parado', badge: 'badge-neutral' },
  terminou: { rotulo: 'Terminou', badge: 'badge-conferido' },
  encerrada: { rotulo: 'Encerrada', badge: 'badge-neutral' },
};

// ---------- a explicação da sessão (13/10/2026: "quando eu clique, abra uma janela flutuante explicando como está
// funcionando"): o que está acontecendo, em frases ----------

/** O que cada ferramenta é, como verbo ("rodando um comando"). */
const VERBO: Record<string, [string, string]> = { // [fazendo agora, fez]
  Bash: ['rodando um comando', 'rodou um comando'], PowerShell: ['rodando um comando', 'rodou um comando'],
  Read: ['lendo o arquivo', 'leu o arquivo'], Write: ['escrevendo o arquivo', 'escreveu o arquivo'], Edit: ['editando o arquivo', 'editou o arquivo'],
  Grep: ['procurando no código', 'procurou no código'], Glob: ['listando arquivos', 'listou arquivos'],
  Agent: ['passando uma tarefa para um ajudante', 'passou uma tarefa para um ajudante'], Task: ['passando uma tarefa para um ajudante', 'passou uma tarefa para um ajudante'],
  SendMessage: ['conversando com um ajudante', 'conversou com um ajudante'], WebSearch: ['pesquisando na internet', 'pesquisou na internet'],
  WebFetch: ['lendo uma página da internet', 'leu uma página da internet'], Skill: ['usando um skill', 'usou um skill'],
  AskUserQuestion: ['perguntando algo a você', 'perguntou algo a você'], ToolSearch: ['carregando ferramentas', 'carregou ferramentas'],
};
function verbo(fer: string, agora: boolean): string {
  const v = VERBO[fer];
  if (v) return v[agora ? 0 : 1];
  if (/^mcp__Claude_Browser|^mcp__claude-in-chrome/.test(fer)) return agora ? 'usando o navegador' : 'usou o navegador';
  return (agora ? 'usando ' : 'usou ') + nomeDaFerramenta(fer);
}
const limpo = (t: string) => t.replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();
const curto = (t: string, n = 140) => { const l = limpo(t); return l.length > n ? l.slice(0, n - 1) + '…' : l; };

/** O papel de cada tipo de agente, em poucas palavras. */
const PAPEL: Record<string, string> = {
  rapido: 'tarefas fáceis: buscar, ler, ajustes pequenos', padrao: 'trabalho normal de programação', forte: 'o que é difícil: investigar, decidir, revisar',
  planejador: 'planeja e revisa cada passo da dupla', executor: 'executa os passos do plano da dupla', 'general-purpose': 'ajudante geral',
  Explore: 'explora o código para achar onde algo está', Plan: 'monta um plano', 'claude-code-guide': 'consulta a documentação do Claude Code',
};
const MODELO: Record<string, string> = { haiku: 'Haiku, o mais rápido e barato', sonnet: 'Sonnet, o intermediário', opus: 'Opus, o mais forte' };
const nomeDoModelo = (m: string) => {
  const k = Object.keys(MODELO).find(x => m.toLowerCase().includes(x));
  return k ? MODELO[k] : m || 'o mesmo da conversa';
};

export interface ExplicacaoDaSessao {
  titulo: string;
  /** os parágrafos, em ordem: a situação, o porteiro, o agora */
  paragrafos: string[];
  ajudantes: { nome: string; texto: string; status: string }[];
  passos: { hora: string; texto: string }[];
}

export function explicar(s: SessaoDeAgentes, ha: (iso: string) => string): ExplicacaoDaSessao {
  const principal = s.agentes.find(a => a.chave === 'principal');
  // claude-opus-5-5 → Opus 5.5
  const modelo = s.modelo ? ' (' + s.modelo.replace(/^claude-/, '').replace(/^([a-z]+)-(\d+)-(\d+).*$/, (_, n: string, a: string, b: string) => n[0].toUpperCase() + n.slice(1) + ' ' + a + '.' + b) + ')' : '';
  const pedido = s.pedido ? '“' + curto(s.pedido, 160) + '”' : 'o último pedido';
  const p: string[] = [];
  if (s.status === 'esperando') p.push('O Claude' + modelo + ' parou e está esperando você: ' + curto(s.aviso || 'precisa de uma resposta ou de uma permissão') + '. Enquanto você não responder na sessão, nada anda.');
  else if (s.status === 'trabalhando') p.push('O Claude' + modelo + ' está trabalhando no seu pedido ' + pedido + '.');
  else if (s.status === 'encerrada') p.push('Esta sessão foi encerrada ' + ha(s.ultimo) + '. O último pedido foi ' + pedido + '.');
  else p.push('O Claude' + modelo + ' terminou o pedido ' + pedido + ' e está esperando o próximo (parado ' + ha(s.ultimo) + ').');
  if (s.nivel) {
    p.push({
      rapido: 'O porteiro achou o pedido fácil: o que for busca ou leitura pode ir para o ajudante rápido (Haiku), que é mais barato.',
      padrao: 'O porteiro achou o pedido normal: a programação comum pode ir para o ajudante padrão (Sonnet) e as buscas para o rápido (Haiku).',
      forte: 'O porteiro achou o pedido difícil: a parte pesada pode ir para o ajudante forte (Opus) ou para a dupla, em que um planeja e outro executa.',
    }[s.nivel] || 'O porteiro classificou o pedido como ' + s.nivel + '.');
  }
  if (principal?.agora) p.push('Agora ele está ' + verbo(principal.agora.fer, true) + (principal.agora.txt ? ': ' + curto(principal.agora.txt) : '') + ' (começou ' + ha(principal.agora.ts) + ').');
  else if (principal?.msg && s.status !== 'trabalhando') p.push('A última resposta dele começa assim: “' + curto(principal.msg, 220) + '”');

  const ajudantes = s.agentes.filter(a => a.chave !== 'principal').map(a => {
    const quem = a.tipo + (a.modelo ? ' (' + nomeDoModelo(a.modelo) + ')' : '');
    const papel = PAPEL[a.tipo] ? ' — ' + PAPEL[a.tipo] : '';
    const texto = a.status === 'trabalhando'
      ? (a.agora ? 'Está ' + verbo(a.agora.fer, true) + (a.agora.txt ? ': ' + curto(a.agora.txt, 100) : '') + '.' : 'Está trabalhando.')
      : a.msg ? 'Terminou e respondeu: “' + curto(a.msg, 160) + '”' : 'Terminou.';
    return { nome: quem + papel, texto, status: a.status };
  });
  const passos = (principal?.hist || []).slice(0, 6).map(h => ({
    hora: h.ts ? new Date(h.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    texto: (h.falhou ? 'Tentou e falhou: ' : '') + verbo(h.fer, false).replace(/^./, c => c.toUpperCase()) + (h.txt ? ': ' + curto(h.txt, 100) : '') + '.',
  }));
  return { titulo: s.projeto || 'Sessão', paragrafos: p, ajudantes, passos };
}

export function useAgentesNoPainel() {
  const repo = useAgentes();
  const { carregada, lista, erro } = repo.sessoes();
  const [filtro, setFiltro] = useState<FiltroDosAgentes>('ativas');
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 5000); return () => clearInterval(t); }, []);

  const ativa = (s: SessaoDeAgentes) => s.status !== 'encerrada' && agora - (+new Date(s.ultimo) || 0) < ATIVA_MS;
  const ativas = lista.filter(ativa);
  const mostrar = filtro === 'ativas' ? ativas : lista;
  const ha = (iso: string) => {
    const s = Math.max(0, Math.round((agora - (+new Date(iso) || agora)) / 1000));
    return s < 60 ? 'há ' + s + ' s' : s < 3600 ? 'há ' + Math.round(s / 60) + ' min' : 'há ' + Math.round(s / 3600) + ' h';
  };
  // a janela da explicação: a sessão aberta (fica ao vivo enquanto aberta)
  const [aberta, setAberta] = useState<string | null>(null);
  const sessaoAberta = aberta ? lista.find(s => s.sessao === aberta) || null : null;
  return {
    carregada, erro, exemplos: repo.exemplos,
    explicacao: sessaoAberta ? explicar(sessaoAberta, ha) : null,
    abrir: (id: string) => setAberta(id),
    fechar: () => setAberta(null),
    filtro, setFiltro,
    sessoes: mostrar.map(s => ({ ...s, inativa: !ativa(s), haQuanto: ha(s.ultimo) })),
    haQuanto: ha,
    numeros: [
      { rotulo: 'Sessões ativas', valor: ativas.length, tom: 'info' as const, icone: 'monitor' as const },
      { rotulo: 'Trabalhando agora', valor: ativas.filter(s => s.status === 'trabalhando').length, tom: 'ok' as const, icone: 'zap' as const },
      { rotulo: 'Esperando você', valor: ativas.filter(s => s.status === 'esperando').length, tom: 'aviso' as const, icone: 'alert' as const },
      { rotulo: 'Subagentes rodando', valor: ativas.reduce((n, s) => n + s.agentes.filter(a => a.chave !== 'principal' && a.status === 'trabalhando').length, 0), tom: 'roxo' as const, icone: 'robo' as const },
    ],
  };
}
