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
  return {
    carregada, erro, exemplos: repo.exemplos,
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
