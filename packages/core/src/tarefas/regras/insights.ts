// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu
// quero", "esses paineis so vao ser vistos por diretor e admin", "Todos os seis"). Os números do escritório em seis
// painéis, que giram numa TV. Um robô monta o resumo (nadsInsights/atual, só números e nomes da equipe, nenhum nome de
// cliente) e a tela ouve só esse documento, para uma TV ligada o dia todo não ler o banco inteiro.
// Não usa o "Prazos do mês" (apagado: o DP usa só a tabela). O DP não tem número por pessoa: o Savio responde por todas
// (memória "DP: Savio responsável por todas"). Só a lógica.
import { clienteDoDp, OBRIGACOES_DP, type ClienteDoDp } from '../../empresas/dp';
import { slug } from '../../formatos';
import { mediaDasAvaliacoes } from '../../areaCliente/avaliacao';
import type { Execucao, Rotina } from '../tipos';
import { situacaoGeral, estadoDa, progresso, proximaEtapa } from './execucao';
import { prazoMaisUrgenteDoDp } from './prazosDoDp';
import { atrasada } from './delegadas';
import { EMPRESAS } from '../../empresas/lista';

/** uma empresa da pessoa no mês (a visão da pessoa; 18/11/2026: "quer que quando eu clique abra uma visao do que a pessoa ta fazendo") */
export interface EmpresaDaPessoa { nome: string; situacao: 'concluida' | 'em-andamento' | 'parada' | 'nao-iniciada'; etapa: string; feitas: number; total: number }
export interface PessoaNoInsight { nome: string; feitas: number; faltando: number; empresas?: EmpresaDaPessoa[] }
/** uma tarefa delegada atrasada (o título e o prazo 'aaaa-mm-dd') */
export interface TarefaAtrasada { titulo: string; prazo: string }
export interface ResumoDosInsights {
  /** ISO */
  atualizadoEm: string;
  rotinas: { setor: 'fiscal' | 'contabil'; competencia: string; pessoas: PessoaNoInsight[] }[];
  dp: { competencia: string; feitas: number; pendentes: number; atrasadas: number; sem: number };
  guias: { competencia: string; enviadas: number; abertas: number; pagas: number };
  clientes: { abertas: number; respondidas: number; nota: number; avaliacoes: number; documentosFaltando: number; mandeiAbertos: number };
  /** protocoladas: as entregas da competência no Entregas, menos as do link do cliente (o que o office boy tem para entregar;
   *  19/11/2026: "precisa aparecer baseado no que ta protocolado la no entregas em comparacao com oque ele ja entregou") */
  entregas: { aEntregar: number; noLink: number; confirmadas: number; falhas: number; protocoladas?: number };
  equipe: { atrasadas: number; pessoas: { nome: string; atrasadas: number; tarefas?: TarefaAtrasada[] }[] };
  /** a equipe pelos usuários do nads, cada um com o setor (19/11/2026; o dono: "ta faltando felipe e gustavo aqui"); sem ele, a
   *  equipe sai das rotinas (como antes) */
  time?: { nome: string; setor: SetorDaPessoa }[];
}

/** O setor da pessoa no Insights (19/11/2026; o dono: "dp e fiscal sao tabelao nao rotina"): o Contábil conta pelas rotinas, o
 *  Fiscal pelo Relatório do Fiscal (o tabelão), o DP pela tabela do DP inteira e o office boy pelas entregas físicas. */
export type SetorDaPessoa = 'contabil' | 'fiscal' | 'dp' | 'office-boy';
export const ROTULO_DO_SETOR: Record<SetorDaPessoa, string> = { contabil: 'Contábil', fiscal: 'Fiscal', dp: 'DP', 'office-boy': 'Office boy' };

const SEM_RESPONSAVEL = 'Sem responsável';

/** As rotinas do mês de um setor, por responsável: a empresa concluída conta como feita, o resto como faltando. */
export function rotinasPorPessoa(
  empresas: readonly { codigo: number; responsavel: string; nome?: string }[],
  execucoes: readonly Execucao[],
  rotinaDe: (codigo: number) => Rotina | null,
): PessoaNoInsight[] {
  const porCodigo = new Map(execucoes.filter(e => e.codigo != null).map(e => [e.codigo as number, e]));
  const pessoas = new Map<string, PessoaNoInsight>();
  for (const e of empresas) {
    const rotina = rotinaDe(e.codigo);
    if (!rotina) continue;
    const nome = e.responsavel.trim() || SEM_RESPONSAVEL;
    const p = pessoas.get(nome) ?? { nome, feitas: 0, faltando: 0, empresas: [] };
    const ex = porCodigo.get(e.codigo) ?? null;
    const situacao = situacaoGeral(ex, rotina);
    if (situacao === 'concluida') p.feitas++; else p.faltando++;
    // a empresa na visão da pessoa: a etapa em que está e quantas já foram
    const pr = progresso(ex, rotina);
    p.empresas!.push({ nome: (e.nome || ex?.empresa || 'Empresa ' + e.codigo).slice(0, 80), situacao, etapa: situacao === 'concluida' ? '' : (proximaEtapa(ex, rotina)?.nome ?? '').slice(0, 80), feitas: pr.concluidas, total: pr.total });
    pessoas.set(nome, p);
  }
  // a parada e a em andamento primeiro; as concluídas no fim (no máximo 80 por pessoa: o documento é um só)
  const ordem = { parada: 0, 'em-andamento': 1, 'nao-iniciada': 2, concluida: 3 } as const;
  for (const p of pessoas.values()) p.empresas = p.empresas!.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 80);
  // quem tem mais faltando primeiro; "Sem responsável" no fim
  return [...pessoas.values()].sort((a, b) => Number(a.nome === SEM_RESPONSAVEL) - Number(b.nome === SEM_RESPONSAVEL) || b.faltando - a.faltando || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** O nome para comparar a pessoa do cadastro com o usuário: o primeiro nome, minúsculo e sem acento ("gustavo.s" e "GUSTAVO" batem). */
export function chaveDoNome(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().split(/[.\s]+/)[0] || '';
}

/** O nome que aparece no cartão: o primeiro nome com a primeira letra maiúscula. */
export function nomeDoCartao(nome: string): string {
  const n = nome.trim().split(/[.\s]+/)[0] || nome.trim();
  return n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : '';
}

/**
 * O setor de um usuário do nads (usuarios/{uid}, o documento cru): o departamento (fiscal, dp ou contabil) ou, sem ele, o
 * papel de office boy; null para quem está desativado ou não é de nenhum (o admin e o Diretor sem departamento).
 */
export function setorDoUsuario(u: { departamento?: unknown; roles?: unknown; role?: unknown; ativo?: unknown; nome?: unknown }): SetorDaPessoa | null {
  if (u.ativo === false || typeof u.nome !== 'string' || !u.nome.trim()) return null;
  if (u.departamento === 'fiscal' || u.departamento === 'dp' || u.departamento === 'contabil') return u.departamento;
  const papeis: unknown[] = Array.isArray(u.roles) ? u.roles : [u.role];
  return papeis.includes('office_boy') ? 'office-boy' : null;
}

/**
 * O Fiscal pelo tabelão (o Relatório do Fiscal, controleTributos do mês), por responsável do Fiscal no Cadastro: a empresa
 * com a entrega marcada conta como feita; com algo preenchido, em andamento; em branco, não iniciada. Só as empresas do
 * Simples e do Presumido (as duas páginas do relatório).
 */
export function fiscalPorPessoa(
  empresas: readonly { codigo: number; responsavel: string; nome?: string }[],
  situacaoDe: (codigo: number) => 'entregue' | 'comecada' | 'branco',
): PessoaNoInsight[] {
  const pessoas = new Map<string, PessoaNoInsight>();
  for (const e of empresas) {
    const nome = e.responsavel.trim() || SEM_RESPONSAVEL;
    const p = pessoas.get(nome) ?? { nome, feitas: 0, faltando: 0, empresas: [] };
    const s = situacaoDe(e.codigo);
    if (s === 'entregue') p.feitas++; else p.faltando++;
    p.empresas!.push({ nome: (e.nome || 'Empresa ' + e.codigo).slice(0, 80), situacao: s === 'entregue' ? 'concluida' : s === 'comecada' ? 'em-andamento' : 'nao-iniciada', etapa: s === 'entregue' ? '' : s === 'comecada' ? 'Falta entregar' : 'Não começou', feitas: 0, total: 0 });
    pessoas.set(nome, p);
  }
  const ordem = { parada: 0, 'em-andamento': 1, 'nao-iniciada': 2, concluida: 3 } as const;
  for (const p of pessoas.values()) p.empresas = p.empresas!.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 80);
  return [...pessoas.values()].sort((a, b) => Number(a.nome === SEM_RESPONSAVEL) - Number(b.nome === SEM_RESPONSAVEL) || b.faltando - a.faltando || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** A ficha do Cadastro como o robô a recebe (só o que o Insights usa). */
export interface CadastroNoInsight { nome?: unknown; codigo?: unknown; regime?: unknown; nova?: { regime?: unknown } | null; responsaveis?: { fiscal?: unknown; contabil?: unknown } | null }

/**
 * As empresas do escritório com o responsável de cada setor, pela mesma regra de Cadastro › Empresas por responsável e de
 * Minhas empresas (19/11/2026; o dono: "cada um tem um monte de empresas entao pq tem tao poucas?"):
 *   - a ficha do Cadastro pelo código ou, sem ele na ficha, pelo nome (o id da ficha é o nome em slug);
 *   - o escolhido no Cadastro vale só se é da equipe daquele setor;
 *   - no Fiscal, sem escolhido que valha, vale o responsável da planilha (a coluna do Fiscal na tabela do DP).
 * equipe vazia (a lista de usuários não abriu): vale o escolhido, como antes.
 */
export function empresasDoInsight(
  porCodigo: ReadonlyMap<number, CadastroNoInsight | null>,
  porSlug: ReadonlyMap<string, CadastroNoInsight | null>,
  equipe: readonly { nome: string; setor: SetorDaPessoa }[],
): { codigo: number; nome: string; regime: string; fiscal: string; contabil: string }[] {
  const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const daLista = new Map(EMPRESAS.filter(e => e.codigo != null).map(e => [e.codigo as number, e]));
  const codigos = new Set<number>([...daLista.keys(), ...porCodigo.keys()]);
  const vale = (dep: 'fiscal' | 'contabil', nome: string) => !!nome && (!equipe.length || equipe.some(u => u.setor === dep && chaveDoNome(u.nome) === chaveDoNome(nome)));
  // o mesmo nome escrito do mesmo jeito (a planilha em maiúsculas, o Cadastro não): o do usuário, quando bate
  // (só alguém do mesmo setor: o Gustavo do Fiscal não é o Gustavo.S do office boy)
  const nomeDe = (dep: 'fiscal' | 'contabil', nome: string) => (nome ? equipe.find(u => u.setor === dep && chaveDoNome(u.nome) === chaveDoNome(nome))?.nome ?? nome : '');
  return [...codigos].map(codigo => {
    const lista = daLista.get(codigo);
    const cad = porCodigo.get(codigo) || (lista ? porSlug.get(slug(lista.nome)) : null) || null;
    const escolhido = { fiscal: txt(cad?.responsaveis?.fiscal), contabil: txt(cad?.responsaveis?.contabil) };
    return {
      codigo,
      nome: txt(cad?.nome) || lista?.nome || '',
      regime: txt(cad?.regime) || txt(cad?.nova?.regime) || (lista?.regime ?? ''),
      fiscal: nomeDe('fiscal', vale('fiscal', escolhido.fiscal) ? escolhido.fiscal : (clienteDoDp(codigo)?.responsavel || '')),
      contabil: nomeDe('contabil', vale('contabil', escolhido.contabil) ? escolhido.contabil : ''),
    };
  });
}

/** As empresas do tabelão do Fiscal (as do Relatório do Fiscal): só as do Simples e do Presumido. */
export function empresasDoTabelaoFiscal(empresas: ReturnType<typeof empresasDoInsight>): { codigo: number; responsavel: string; nome: string }[] {
  return empresas.filter(e => e.regime === 'Simples' || e.regime === 'Presumido').map(e => ({ codigo: e.codigo, responsavel: e.fiscal, nome: e.nome }));
}

export type SituacaoDoDpNoInsight = 'feita' | 'pendente' | 'atrasada' | 'sem';

/**
 * A situação de um cliente na tabela do DP, a mesma conta do Painel do DP (telas/dp/usePainelDoDp.ts, situacaoDash):
 * sem movimento ou sem obrigação = 'sem'; tudo feito (com o Entregue) = 'feita'; senão, a obrigação pendente de prazo mais
 * cedo vencida = 'atrasada' (sem prazo nenhum, vale o fim do mês da competência).
 */
export function situacaoDoClienteDp(c: Pick<ClienteDoDp, 'obrigacoes' | 'reinfAutorizada' | 'movimento'>, ex: Execucao | null, competencia: string, hoje: Date): SituacaoDoDpNoInsight {
  const temAlguma = c.obrigacoes.length > 0;
  if (c.movimento === 'Sem Movimento' || !temAlguma) return 'sem';
  const ids = [...new Set([...OBRIGACOES_DP.map(o => o.id as string).filter(id => c.obrigacoes.includes(id)), ...c.obrigacoes, ...(c.reinfAutorizada ? ['reinf'] : []), 'envio'])];
  const feita = (id: string) => { const s = estadoDa(ex, 'dp-' + id)?.situacao; return s === 'feita' || s === 'dispensada'; };
  const pendentes = ids.filter(id => !feita(id));
  if (!pendentes.length) return 'feita';
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimDoMes = new Date(Number(competencia.slice(0, 4)), Number(competencia.slice(5, 7)), 0);
  const dias = prazoMaisUrgenteDoDp(pendentes, ids, competencia, h)?.dias ?? Math.round((fimDoMes.getTime() - h.getTime()) / 864e5);
  return dias < 0 ? 'atrasada' : 'pendente';
}

/** A tabela do DP contada. */
export function contarDp(situacoes: readonly SituacaoDoDpNoInsight[]): { feitas: number; pendentes: number; atrasadas: number; sem: number } {
  const n = { feitas: 0, pendentes: 0, atrasadas: 0, sem: 0 };
  for (const s of situacoes) { if (s === 'feita') n.feitas++; else if (s === 'pendente') n.pendentes++; else if (s === 'atrasada') n.atrasadas++; else n.sem++; }
  return n;
}

/** As solicitações dos clientes e a nota do mês (aaaa-mm). */
export function contarChamados(chamados: readonly { situacao: string; avaliacao?: { nota: number; em: string } | null }[], mes: string): { abertas: number; respondidas: number; nota: number; avaliacoes: number } {
  const abertas = chamados.filter(c => c.situacao === 'aberto' || c.situacao === 'em andamento').length;
  const respondidas = chamados.filter(c => c.situacao === 'respondido').length;
  const m = mediaDasAvaliacoes(chamados.flatMap(c => (c.avaliacao ? [c.avaliacao] : [])), mes);
  return { abertas, respondidas, nota: m.media, avaliacoes: m.total };
}

/** As entregas físicas: a entregar (rota), esperando o cliente no link, confirmadas e com falha. */
export function contarEntregas(entregas: readonly { status?: unknown }[]): ResumoDosInsights['entregas'] {
  const n = { aEntregar: 0, noLink: 0, confirmadas: 0, falhas: 0 };
  for (const e of entregas) {
    if (e.status === 'pendente') n.aEntregar++;
    else if (e.status === 'link') n.noLink++;
    else if (e.status === 'confirmada') n.confirmadas++;
    else if (e.status === 'falha') n.falhas++;
  }
  return n;
}

/** As tarefas delegadas atrasadas, por responsável (hoje 'aaaa-mm-dd', agora 'hh:mm'). */
export function delegadasAtrasadas(lista: readonly { status: string; prazo: string; prazoHora?: string; titulo?: string; responsavel?: { nome?: string } | null }[], hoje: string, agora = ''): ResumoDosInsights['equipe'] {
  const porNome = new Map<string, TarefaAtrasada[]>();
  for (const t of lista) {
    if (!atrasada(t as Parameters<typeof atrasada>[0], hoje, agora)) continue;
    const nome = (t.responsavel?.nome || '').trim() || SEM_RESPONSAVEL;
    porNome.set(nome, [...(porNome.get(nome) ?? []), { titulo: String(t.titulo || 'Tarefa').slice(0, 120), prazo: t.prazo }]);
  }
  // a mais atrasada primeiro; no máximo 10 tarefas por pessoa
  const pessoas = [...porNome].map(([nome, ts]) => ({ nome, atrasadas: ts.length, tarefas: ts.sort((a, b) => a.prazo.localeCompare(b.prazo)).slice(0, 10) }))
    .sort((a, b) => b.atrasadas - a.atrasadas || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { atrasadas: pessoas.reduce((s, p) => s + p.atrasadas, 0), pessoas };
}

// ------------------------------- o que a tela mostra -------------------------------

export interface NumeroDoPainel { rotulo: string; valor: string; tom?: 'bom' | 'alerta' | 'ruim' }
export interface PainelDosInsights { id: string; titulo: string; subtitulo: string; numeros: NumeroDoPainel[]; linhas: { nome: string; texto: string; tom?: 'alerta' | 'ruim' }[] }

const mesEmTexto = (comp: string) => {
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return /^\d{4}-\d{2}$/.test(comp) ? nomes[Number(comp.slice(5, 7)) - 1] + '/' + comp.slice(0, 4) : '';
};
const n = (v: number) => v.toLocaleString('pt-BR');

/** Os seis painéis, na ordem em que giram na TV. */
export function paineisDosInsights(r: ResumoDosInsights): PainelDosInsights[] {
  const rotina = (setor: 'fiscal' | 'contabil', titulo: string): PainelDosInsights => {
    const s = r.rotinas.find(x => x.setor === setor);
    const pessoas = s?.pessoas ?? [];
    const feitas = pessoas.reduce((t, p) => t + p.feitas, 0), faltando = pessoas.reduce((t, p) => t + p.faltando, 0);
    return {
      id: 'rotinas-' + setor, titulo, subtitulo: 'Competência ' + mesEmTexto(s?.competencia ?? ''),
      numeros: [{ rotulo: 'Concluídas', valor: n(feitas), tom: 'bom' }, { rotulo: 'Faltando', valor: n(faltando), tom: faltando ? 'alerta' : undefined }],
      linhas: pessoas.map(p => ({ nome: p.nome, texto: n(p.feitas) + ' concluídas · ' + n(p.faltando) + ' faltando', tom: p.faltando ? 'alerta' as const : undefined })),
    };
  };
  return [
    {
      id: 'rotinas', titulo: 'Rotinas do mês', subtitulo: 'Fiscal e Contábil, por responsável',
      numeros: [...rotina('fiscal', '').numeros.map(x => ({ ...x, rotulo: 'Fiscal: ' + x.rotulo.toLowerCase() })), ...rotina('contabil', '').numeros.map(x => ({ ...x, rotulo: 'Contábil: ' + x.rotulo.toLowerCase() }))],
      linhas: [...rotina('fiscal', '').linhas.map(l => ({ ...l, nome: l.nome + ' (Fiscal)' })), ...rotina('contabil', '').linhas.map(l => ({ ...l, nome: l.nome + ' (Contábil)' }))],
    },
    {
      id: 'dp', titulo: 'Departamento Pessoal', subtitulo: 'A tabela do DP · competência ' + mesEmTexto(r.dp.competencia),
      numeros: [
        { rotulo: 'Concluídos', valor: n(r.dp.feitas), tom: 'bom' }, { rotulo: 'No prazo', valor: n(r.dp.pendentes) },
        { rotulo: 'Atrasados', valor: n(r.dp.atrasadas), tom: r.dp.atrasadas ? 'ruim' : undefined }, { rotulo: 'Sem movimento', valor: n(r.dp.sem) },
      ],
      linhas: [],
    },
    {
      id: 'guias', titulo: 'Guias', subtitulo: 'Competência ' + mesEmTexto(r.guias.competencia),
      numeros: [{ rotulo: 'Enviadas', valor: n(r.guias.enviadas) }, { rotulo: 'Abertas pelo cliente', valor: n(r.guias.abertas) }, { rotulo: 'Pagas pelo extrato', valor: n(r.guias.pagas), tom: 'bom' }],
      linhas: [],
    },
    {
      id: 'clientes', titulo: 'Clientes', subtitulo: 'Área do Cliente e Mandei',
      numeros: [
        { rotulo: 'Solicitações abertas', valor: n(r.clientes.abertas), tom: r.clientes.abertas ? 'alerta' : undefined },
        { rotulo: 'Respondidas, esperando o cliente', valor: n(r.clientes.respondidas) },
        { rotulo: 'Nota do atendimento no mês', valor: r.clientes.avaliacoes ? r.clientes.nota.toLocaleString('pt-BR') + ' de 5' : '—', tom: r.clientes.avaliacoes && r.clientes.nota < 4 ? 'alerta' : undefined },
        { rotulo: 'Clientes devendo documento', valor: n(r.clientes.documentosFaltando), tom: r.clientes.documentosFaltando ? 'alerta' : undefined },
        { rotulo: 'Pedidos do Mandei abertos', valor: n(r.clientes.mandeiAbertos) },
      ],
      linhas: [],
    },
    {
      id: 'entregas', titulo: 'Entregas físicas', subtitulo: 'O office boy e o link do cliente',
      numeros: [
        { rotulo: 'A entregar', valor: n(r.entregas.aEntregar) }, { rotulo: 'Esperando o cliente confirmar', valor: n(r.entregas.noLink) },
        { rotulo: 'Entregues', valor: n(r.entregas.confirmadas), tom: 'bom' }, { rotulo: 'Com falha', valor: n(r.entregas.falhas), tom: r.entregas.falhas ? 'ruim' : undefined },
      ],
      linhas: [],
    },
    {
      id: 'equipe', titulo: 'Tarefas atrasadas', subtitulo: 'As tarefas delegadas, por responsável',
      numeros: [{ rotulo: 'Atrasadas', valor: n(r.equipe.atrasadas), tom: r.equipe.atrasadas ? 'ruim' : 'bom' }],
      linhas: r.equipe.pessoas.map(p => ({ nome: p.nome, texto: n(p.atrasadas) + (p.atrasadas === 1 ? ' atrasada' : ' atrasadas'), tom: 'ruim' as const })),
    },
  ];
}

// ------------------------------- a leitura do documento -------------------------------

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const txt = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const comp = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? v : '');

/** nadsInsights/atual lido campo a campo (o torto vira zero); null sem a data. */
export function lerResumoDosInsights(x: unknown): ResumoDosInsights | null {
  const o = obj(x);
  if (typeof o.atualizadoEm !== 'string' || !o.atualizadoEm) return null;
  const SITUACOES = ['concluida', 'em-andamento', 'parada', 'nao-iniciada'];
  const empresas = (v: unknown): EmpresaDaPessoa[] => (Array.isArray(v) ? v : []).map(obj).filter(e => txt(e.nome)).slice(0, 80)
    .map(e => ({ nome: txt(e.nome, 80), situacao: (SITUACOES.includes(String(e.situacao)) ? e.situacao : 'em-andamento') as EmpresaDaPessoa['situacao'], etapa: txt(e.etapa, 80), feitas: num(e.feitas), total: num(e.total) }));
  const tarefas = (v: unknown): TarefaAtrasada[] => (Array.isArray(v) ? v : []).map(obj).filter(t => txt(t.titulo)).slice(0, 10).map(t => ({ titulo: txt(t.titulo, 120), prazo: /^\d{4}-\d{2}-\d{2}$/.test(txt(t.prazo)) ? txt(t.prazo) : '' }));
  const pessoas = (v: unknown) => (Array.isArray(v) ? v : []).map(obj).filter(p => txt(p.nome)).slice(0, 40).map(p => ({ nome: txt(p.nome), feitas: num(p.feitas), faltando: num(p.faltando), empresas: empresas(p.empresas) }));
  const dp = obj(o.dp), g = obj(o.guias), c = obj(o.clientes), e = obj(o.entregas), q = obj(o.equipe);
  return {
    atualizadoEm: o.atualizadoEm,
    rotinas: (Array.isArray(o.rotinas) ? o.rotinas : []).map(obj).filter(r => r.setor === 'fiscal' || r.setor === 'contabil')
      .map(r => ({ setor: r.setor as 'fiscal' | 'contabil', competencia: comp(r.competencia), pessoas: pessoas(r.pessoas) })),
    dp: { competencia: comp(dp.competencia), feitas: num(dp.feitas), pendentes: num(dp.pendentes), atrasadas: num(dp.atrasadas), sem: num(dp.sem) },
    guias: { competencia: comp(g.competencia), enviadas: num(g.enviadas), abertas: num(g.abertas), pagas: num(g.pagas) },
    clientes: { abertas: num(c.abertas), respondidas: num(c.respondidas), nota: Math.min(5, num(c.nota)), avaliacoes: num(c.avaliacoes), documentosFaltando: num(c.documentosFaltando), mandeiAbertos: num(c.mandeiAbertos) },
    entregas: { aEntregar: num(e.aEntregar), noLink: num(e.noLink), confirmadas: num(e.confirmadas), falhas: num(e.falhas), ...(typeof e.protocoladas === 'number' ? { protocoladas: num(e.protocoladas) } : {}) },
    equipe: { atrasadas: num(q.atrasadas), pessoas: (Array.isArray(q.pessoas) ? q.pessoas : []).map(obj).filter(p => txt(p.nome)).slice(0, 40).map(p => ({ nome: txt(p.nome), atrasadas: num(p.atrasadas), tarefas: tarefas(p.tarefas) })) },
    ...(Array.isArray(o.time) ? { time: o.time.map(obj).filter(p => txt(p.nome) && typeof p.setor === 'string' && p.setor in ROTULO_DO_SETOR).slice(0, 40).map(p => ({ nome: txt(p.nome, 60), setor: p.setor as SetorDaPessoa })) } : {}),
  };
}

/** Um resumo de exemplo (a tela sem banco e os testes). */
export function resumoDeExemploDosInsights(agora: Date): ResumoDosInsights {
  const mes = (d: number) => { const x = new Date(agora.getFullYear(), agora.getMonth() + d, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const dia = (d: number) => { const x = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  // as empresas de mentira de cada pessoa: as que faltam (com a etapa) e as concluídas
  const empresas = (feitas: number, faltando: number, etapas: readonly string[]): EmpresaDaPessoa[] => [
    ...Array.from({ length: Math.min(faltando, 8) }, (_, i) => ({ nome: 'EMPRESA EXEMPLO ' + (101 + i) + ' LTDA', situacao: (i === 0 ? 'parada' : i % 3 === 2 ? 'nao-iniciada' : 'em-andamento') as EmpresaDaPessoa['situacao'], etapa: etapas[i % etapas.length], feitas: i % 3 === 2 ? 0 : 3 + (i % 4), total: 9 })),
    ...Array.from({ length: Math.min(feitas, 6) }, (_, i) => ({ nome: 'COMÉRCIO EXEMPLO ' + (201 + i) + ' LTDA', situacao: 'concluida' as const, etapa: '', feitas: 9, total: 9 })),
  ];
  const FISCAL = ['Conferir as saídas no SIEG', 'Apurar o Simples', 'Subir a guia do DAS', 'Conferir as entradas'];
  const CONTABIL = ['Importar o extrato', 'Conciliar o banco', 'Conferir o balancete', 'Lançar a folha'];
  return {
    atualizadoEm: agora.toISOString(),
    rotinas: [
      { setor: 'fiscal', competencia: mes(-1), pessoas: [{ nome: 'Heverton', feitas: 38, faltando: 6, empresas: empresas(38, 6, FISCAL) }, { nome: 'Adivania', feitas: 41, faltando: 2, empresas: empresas(41, 2, FISCAL) }, { nome: 'Gustavo', feitas: 30, faltando: 0, empresas: empresas(30, 0, FISCAL) }] },
      { setor: 'contabil', competencia: mes(-1), pessoas: [{ nome: 'Fernando', feitas: 12, faltando: 9, empresas: empresas(12, 9, CONTABIL) }, { nome: 'Felipe', feitas: 15, faltando: 4, empresas: empresas(15, 4, CONTABIL) }, { nome: 'Clara', feitas: 8, faltando: 5, empresas: empresas(8, 5, CONTABIL) }] },
    ],
    dp: { competencia: mes(-1), feitas: 96, pendentes: 18, atrasadas: 3, sem: 22 },
    guias: { competencia: mes(-1), enviadas: 412, abertas: 287, pagas: 154 },
    clientes: { abertas: 7, respondidas: 4, nota: 4.6, avaliacoes: 11, documentosFaltando: 23, mandeiAbertos: 9 },
    entregas: { aEntregar: 14, noLink: 6, confirmadas: 132, falhas: 1 },
    equipe: { atrasadas: 5, pessoas: [
      { nome: 'Fernando', atrasadas: 3, tarefas: [{ titulo: 'Conferir o balancete de setembro', prazo: dia(-6) }, { titulo: 'Mandar o contrato social atualizado', prazo: dia(-3) }, { titulo: 'Responder a dúvida do cliente 356', prazo: dia(-1) }] },
      { nome: 'Clara', atrasadas: 2, tarefas: [{ titulo: 'Atualizar o cadastro dos sócios', prazo: dia(-4) }, { titulo: 'Lançar as notas de entrada', prazo: dia(-2) }] },
    ] },
  };
}

// ------------------------------- a equipe em cartões (o visual de 18/11/2026: "faz algo bonito") -------------------------------

export type TomDoInsight = 'bom' | 'alerta' | 'ruim';
export interface PessoaDaEquipe { nome: string; setor: string; feitas: number; total: number; pct: number; tom: TomDoInsight; atrasadas: number; empresas: EmpresaDaPessoa[]; tarefas: TarefaAtrasada[]; /** o que o número conta (o cartão e a visão da pessoa) */ conta: string }

/** O tom do percentual concluído: 90% ou mais é bom; de 60% a 89%, alerta; abaixo, ruim. */
export const tomDoPercentual = (pct: number): TomDoInsight => (pct >= 90 ? 'bom' : pct >= 60 ? 'alerta' : 'ruim');

/**
 * Cada pessoa da equipe com o percentual concluído e as tarefas atrasadas dela; a mais atrasada antes. Com o time (os
 * usuários do nads; 19/11/2026), todo mundo aparece, contado pelo tabelão do setor: o Contábil pelas rotinas dele, o Fiscal
 * pelo Relatório do Fiscal (as empresas dele), o DP pela tabela do DP inteira (o DP não tem responsável por empresa) e o
 * office boy pelas entregas físicas. Sem o time (o resumo antigo), as pessoas das rotinas, como antes.
 */
export function equipeDosInsights(r: ResumoDosInsights): PessoaDaEquipe[] {
  const atrasadas = new Map(r.equipe.pessoas.map(p => [chaveDoNome(p.nome), p]));
  const cartao = (nome: string, setor: string, feitas: number, total: number, empresas: EmpresaDaPessoa[], conta: string): PessoaDaEquipe => {
    const pct = total ? Math.round((feitas / total) * 100) : 100;
    const q = atrasadas.get(chaveDoNome(nome));
    return { nome, setor, feitas, total, pct, tom: tomDoPercentual(pct), atrasadas: q?.atrasadas ?? 0, empresas, tarefas: q?.tarefas ?? [], conta };
  };
  const ordenar = (l: PessoaDaEquipe[]) => l.sort((a, b) => a.pct - b.pct || b.atrasadas - a.atrasadas || a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!r.time) {
    return ordenar(r.rotinas.flatMap(s => s.pessoas.filter(p => p.nome !== SEM_RESPONSAVEL)
      .map(p => cartao(p.nome, s.setor === 'fiscal' ? 'Fiscal' : 'Contábil', p.feitas, p.feitas + p.faltando, p.empresas ?? [], 'empresas concluídas'))));
  }
  const doSetor = (setor: 'fiscal' | 'contabil', nome: string) => {
    const pessoas = r.rotinas.find(s => s.setor === setor)?.pessoas.filter(p => p.nome !== SEM_RESPONSAVEL) ?? [];
    return pessoas.find(p => p.nome.trim().toLowerCase() === nome.trim().toLowerCase()) ?? pessoas.find(p => chaveDoNome(p.nome) === chaveDoNome(nome));
  };
  const dpTotal = r.dp.feitas + r.dp.pendentes + r.dp.atrasadas;
  // o office boy: as entregues de quantas foram protocoladas na competência (sem o número, o de antes)
  const entregasTotal = r.entregas.protocoladas ?? r.entregas.confirmadas + r.entregas.aEntregar + r.entregas.noLink;
  // dois da equipe com o mesmo primeiro nome (o Gustavo do Fiscal e o Gustavo.S): o cartão leva o nome inteiro, e a foto
  // sai certa (19/11/2026; o dono: "E Gustavo.S nao esse gustavo")
  const repetidos = new Set(r.time.map(u => chaveDoNome(u.nome)).filter((k, i, l) => l.indexOf(k) !== i));
  return ordenar(r.time.map(u => {
    const nome = repetidos.has(chaveDoNome(u.nome)) ? u.nome.trim() : nomeDoCartao(u.nome);
    if (u.setor === 'dp') return cartao(nome, ROTULO_DO_SETOR.dp, r.dp.feitas, dpTotal, [], 'clientes do DP fechados');
    if (u.setor === 'office-boy') return cartao(nome, ROTULO_DO_SETOR['office-boy'], r.entregas.confirmadas, entregasTotal, [], 'entregas feitas das protocoladas');
    const p = doSetor(u.setor, u.nome);
    return cartao(nome, ROTULO_DO_SETOR[u.setor], p?.feitas ?? 0, (p?.feitas ?? 0) + (p?.faltando ?? 0), p?.empresas ?? [], 'empresas concluídas');
  }));
}
