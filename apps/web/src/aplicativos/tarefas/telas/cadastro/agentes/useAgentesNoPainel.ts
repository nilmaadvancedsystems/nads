// ViewModel dos agentes do Claude em Cadastro › Sistema e agentes (Vitor, 13/10/2026: "tem como upar uma página no nads
// disso?"; 14/10/2026: separado por computador, só admin, só computadores cadastrados). Os computadores (cadastrar com a
// chave mostrada uma vez, renomear, desativar) e as conversas de cada um, as ativas em cima e as inativas (mais de 30 min
// sem nada) recolhidas; o nível do porteiro em palavras e o "há X" andando sozinho.
import { useRetorno, type NomeIcone } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useOperador } from '../../../casca/operador';
import type { MaquinaDoPainel, SessaoDeAgentes } from '../../../dados/agentes';
import { useAgentes } from '../../../dados/repo';

const ATIVA_MS = 30 * 60 * 1000;

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
/** O ícone de cada ferramenta (só ícones do catálogo). */
const ICONE: Record<string, NomeIcone> = {
  Bash: 'zap', PowerShell: 'zap', Read: 'olho', Write: 'fileText', Edit: 'lapis', Grep: 'search', Glob: 'pasta',
  Agent: 'robo', Task: 'robo', SendMessage: 'mensagem', WebSearch: 'search', WebFetch: 'link', Skill: 'checklist',
  AskUserQuestion: 'ajuda', ToolSearch: 'settings',
};
const iconeDe = (fer: string): NomeIcone => ICONE[fer] || (/^mcp__(Claude_Browser|claude-in-chrome)/.test(fer) ? 'monitor' : 'repeat');

/** claude-opus-5-5 → Opus 5.5; opus → Opus */
export const modeloBonito = (m: string) => {
  const t = String(m || '').replace(/^claude-/, '');
  const v = /^([a-z]+)-(\d+)-(\d+)/.exec(t);
  if (v) return v[1][0].toUpperCase() + v[1].slice(1) + ' ' + v[2] + '.' + v[3];
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};
/** O tom de cada modelo: Haiku verde, Sonnet azul, Opus roxo. */
const tomDoModelo = (m: string): 'ok' | 'info' | 'roxo' | 'neutro' => (/haiku/i.test(m) ? 'ok' : /sonnet/i.test(m) ? 'info' : /opus/i.test(m) ? 'roxo' : 'neutro');

export interface AcaoExplicada { icone: NomeIcone; verbo: string; alvo: string }
export interface AgenteExplicado {
  chave: string; nome: string; papel: string; modelo: string; tom: 'ok' | 'info' | 'roxo' | 'neutro';
  status: string; rotulo: string; badge: string; agora: AcaoExplicada | null; resposta: string;
}
export interface ExplicacaoDaSessao {
  titulo: string; status: string; rotulo: string; badge: string; modelo: string; maquina: string; atualizado: string;
  /** a frase principal, no topo */
  resumo: string;
  pedido: string; aviso: string;
  /** o que o principal faz agora, com há quanto tempo (corre de segundo em segundo) */
  agora: (AcaoExplicada & { desde: string }) | null;
  /** a última resposta do principal, quando parado */
  resposta: string;
  nivel: '' | 'rapido' | 'padrao' | 'forte';
  porteiro: string;
  agentes: AgenteExplicado[];
  passos: (AcaoExplicada & { hora: string; dur: string; falhou: boolean })[];
}

const acao = (fer: string, txt: string, agora: boolean): AcaoExplicada => ({ icone: iconeDe(fer), verbo: verbo(fer, agora).replace(/^./, c => c.toUpperCase()), alvo: curto(txt, 140) });
const dur = (ms: number) => (!ms ? '' : ms >= 60000 ? Math.round(ms / 60000) + ' min' : ms >= 1000 ? (ms / 1000).toFixed(1).replace('.', ',') + ' s' : ms + ' ms');

export function explicar(s: SessaoDeAgentes, ha: (iso: string) => string, maquina = ''): ExplicacaoDaSessao {
  const principal = s.agentes.find(a => a.chave === 'principal');
  const st = STATUS[s.status] || STATUS.parado;
  const modelo = modeloBonito(s.modelo);
  const quem = 'O Claude' + (modelo ? ' ' + modelo : '');
  const resumo = s.status === 'esperando' ? quem + ' parou e está esperando você. Enquanto você não responder na sessão, nada anda.'
    : s.status === 'trabalhando' ? quem + ' está trabalhando no seu pedido.'
    : s.status === 'encerrada' ? 'Esta sessão foi encerrada ' + ha(s.ultimo) + '.'
    : quem + ' terminou e está esperando o seu próximo pedido.';
  const nivel = (['rapido', 'padrao', 'forte'].includes(s.nivel) ? s.nivel : '') as ExplicacaoDaSessao['nivel'];
  const porteiro = {
    rapido: 'Pedido fácil: buscas e leituras podem ir para o ajudante rápido (Haiku), que responde depressa e custa menos.',
    padrao: 'Pedido normal: a programação comum pode ir para o ajudante padrão (Sonnet); as buscas, para o rápido (Haiku).',
    forte: 'Pedido difícil: a parte pesada pode ir para o ajudante forte (Opus) ou para a dupla, em que um planeja e outro executa.',
    '': 'O porteiro ainda não classificou um pedido desta sessão.',
  }[nivel];
  const agentes: AgenteExplicado[] = s.agentes.map(a => {
    const principalDele = a.chave === 'principal';
    const sa = principalDele ? (a.agora ? STATUS.trabalhando : st) : STATUS[a.status] || STATUS.parado;
    const m = principalDele ? s.modelo : a.modelo;
    return {
      chave: a.chave, nome: principalDele ? 'Claude principal' : a.tipo, papel: principalDele ? 'conversa com você e decide' : PAPEL[a.tipo] || 'ajudante',
      modelo: modeloBonito(m) || 'herda', tom: tomDoModelo(m), status: principalDele ? (a.agora ? 'trabalhando' : s.status) : a.status,
      rotulo: sa.rotulo, badge: sa.badge, agora: a.agora ? acao(a.agora.fer, a.agora.txt, true) : null, resposta: a.msg ? curto(a.msg, 180) : '',
    };
  });
  const passos = (principal?.hist || []).slice(0, 6).map(h => ({
    ...acao(h.fer, h.txt, false), hora: h.ts ? new Date(h.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '', dur: dur(h.ms), falhou: h.falhou,
  }));
  return {
    titulo: s.titulo || s.projeto || 'Conversa', status: s.status, rotulo: st.rotulo, badge: st.badge, modelo, maquina, atualizado: ha(s.ultimo),
    resumo, pedido: s.pedido ? curto(s.pedido, 300) : '', aviso: s.aviso ? curto(s.aviso, 200) : '',
    agora: principal?.agora ? { ...acao(principal.agora.fer, principal.agora.txt, true), desde: ha(principal.agora.ts) } : null,
    resposta: !principal?.agora && principal?.msg && s.status !== 'trabalhando' ? curto(principal.msg, 260) : '',
    nivel, porteiro, agentes, passos,
  };
}

export type ConversaNaTela = SessaoDeAgentes & { haQuanto: string };
export interface GrupoDoComputador { chave: string; nome: string; ativas: ConversaNaTela[]; inativas: ConversaNaTela[]; inativasAbertas: boolean }

const dataCurta = (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export function useAgentesNoPainel() {
  const repo = useAgentes();
  const maquinas = repo.maquinas();
  const { carregada, lista, erro } = repo.sessoes();
  const { toast, modal } = useRetorno();
  const quem = useOperador().operador?.nome || '';
  const [agora, setAgora] = useState(() => Date.now());
  const [aberta, setAberta] = useState<string | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  const [nome, setNome] = useState('');
  const [cadastrando, setCadastrando] = useState(false);
  const [chaveMostrada, setChaveMostrada] = useState<{ nome: string; chave: string } | null>(null);
  const [renomeando, setRenomeando] = useState<{ chave: string; nome: string } | null>(null);
  // o relógio: de 5 em 5 s; com a janela aberta, de segundo em segundo (o "há X s" do agora corre)
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), aberta ? 1000 : 5000); return () => clearInterval(t); }, [aberta]);

  const ativa = (s: SessaoDeAgentes) => s.status !== 'encerrada' && agora - (+new Date(s.ultimo) || 0) < ATIVA_MS;
  const ha = (iso: string) => {
    const s = Math.max(0, Math.round((agora - (+new Date(iso) || agora)) / 1000));
    return s < 60 ? 'há ' + s + ' s' : s < 3600 ? 'há ' + Math.round(s / 60) + ' min' : 'há ' + Math.round(s / 3600) + ' h';
  };
  const naTela = (s: SessaoDeAgentes): ConversaNaTela => ({ ...s, haQuanto: ha(s.ultimo) });
  const nomeDe = (chave: string) => maquinas.lista.find(m => m.chave === chave)?.nome || '';
  const ativas = lista.filter(ativa);
  // um grupo por computador ativo (o nome é o cabeçalho), na ordem do nome
  const grupos: GrupoDoComputador[] = maquinas.lista.filter(m => m.ativo).map(m => {
    const dele = lista.filter(s => s.maquina === m.chave);
    return { chave: m.chave, nome: m.nome, ativas: dele.filter(ativa).map(naTela), inativas: dele.filter(s => !ativa(s)).map(naTela), inativasAbertas: abertos.has(m.chave) };
  });
  const sessaoAberta = aberta ? lista.find(s => s.sessao === aberta) || null : null;

  async function cadastrar() {
    const n = nome.trim();
    if (!n) { toast('Dê um nome ao computador.'); return; }
    setCadastrando(true);
    try { const chave = await repo.cadastrar(n, quem); setChaveMostrada({ nome: n, chave }); setNome(''); }
    catch (err) { toast('Não consegui cadastrar: ' + (err as Error).message); }
    finally { setCadastrando(false); }
  }
  async function salvarNome() {
    if (!renomeando) return;
    const n = renomeando.nome.trim();
    const m = maquinas.lista.find(x => x.chave === renomeando.chave);
    setRenomeando(null);
    if (!n || !m || n === m.nome) return;
    try { await repo.renomear(m.chave, n); toast('Renomeado para ' + n + '.'); }
    catch (err) { toast('Não consegui renomear: ' + (err as Error).message); }
  }
  async function alternar(m: MaquinaDoPainel) {
    if (m.ativo) {
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Desativar ' + m.nome + '?', texto: 'As conversas deste computador param de chegar até você reativar.',
        botoes: [{ rotulo: 'Desativar', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }] });
      if (!ok) return;
    }
    try { await repo.ativar(m.chave, !m.ativo); toast(m.ativo ? m.nome + ' desativado.' : m.nome + ' reativado.'); }
    catch (err) { toast('Não consegui mudar: ' + (err as Error).message); }
  }

  return {
    carregada: carregada && maquinas.carregada, erro: maquinas.erro || erro, exemplos: repo.exemplos,
    explicacao: sessaoAberta ? explicar(sessaoAberta, ha, nomeDe(sessaoAberta.maquina)) : null,
    abrir: (id: string) => setAberta(id),
    fechar: () => setAberta(null),
    grupos,
    alternarInativas: (chave: string) => setAbertos(a => { const b = new Set(a); if (b.has(chave)) b.delete(chave); else b.add(chave); return b; }),
    computadores: maquinas.lista.map(m => ({ ...m, desde: dataCurta(m.criadoEm), conversasAtivas: ativas.filter(s => s.maquina === m.chave).length })),
    nome, setNome, cadastrando, cadastrar,
    chaveMostrada,
    esconderChave: () => setChaveMostrada(null),
    copiarChave: () => {
      if (!chaveMostrada) return;
      void navigator.clipboard?.writeText(chaveMostrada.chave).then(() => toast('Chave copiada.'), () => toast('Não consegui copiar (o navegador não deixou).'));
    },
    renomeando,
    renomear: (m: MaquinaDoPainel) => setRenomeando({ chave: m.chave, nome: m.nome }),
    mudarNome: (n: string) => setRenomeando(r => (r ? { ...r, nome: n } : r)),
    salvarNome: () => void salvarNome(),
    cancelarNome: () => setRenomeando(null),
    alternar: (m: MaquinaDoPainel) => void alternar(m),
    trabalhando: ativas.filter(s => s.status === 'trabalhando').length,
    esperando: ativas.filter(s => s.status === 'esperando').length,
  };
}
