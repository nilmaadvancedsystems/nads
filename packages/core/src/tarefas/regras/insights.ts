// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu
// quero", "esses paineis so vao ser vistos por diretor e admin", "Todos os seis"). Os números do escritório em seis
// painéis, que giram numa TV. Um robô monta o resumo (nadsInsights/atual, só números e nomes da equipe, nenhum nome de
// cliente) e a tela ouve só esse documento, para uma TV ligada o dia todo não ler o banco inteiro.
// Não usa o "Prazos do mês" (apagado: o DP usa só a tabela). O DP não tem número por pessoa: o Savio responde por todas
// (memória "DP: Savio responsável por todas"). Só a lógica.
import { OBRIGACOES_DP, type ClienteDoDp } from '../../empresas/dp';
import { mediaDasAvaliacoes } from '../../areaCliente/avaliacao';
import type { Execucao, Rotina } from '../tipos';
import { situacaoGeral, estadoDa } from './execucao';
import { prazoMaisUrgenteDoDp } from './prazosDoDp';
import { atrasada } from './delegadas';

export interface PessoaNoInsight { nome: string; feitas: number; faltando: number }
export interface ResumoDosInsights {
  /** ISO */
  atualizadoEm: string;
  rotinas: { setor: 'fiscal' | 'contabil'; competencia: string; pessoas: PessoaNoInsight[] }[];
  dp: { competencia: string; feitas: number; pendentes: number; atrasadas: number; sem: number };
  guias: { competencia: string; enviadas: number; abertas: number; pagas: number };
  clientes: { abertas: number; respondidas: number; nota: number; avaliacoes: number; documentosFaltando: number; mandeiAbertos: number };
  entregas: { aEntregar: number; noLink: number; confirmadas: number; falhas: number };
  equipe: { atrasadas: number; pessoas: { nome: string; atrasadas: number }[] };
}

const SEM_RESPONSAVEL = 'Sem responsável';

/** As rotinas do mês de um setor, por responsável: a empresa concluída conta como feita, o resto como faltando. */
export function rotinasPorPessoa(
  empresas: readonly { codigo: number; responsavel: string }[],
  execucoes: readonly Execucao[],
  rotinaDe: (codigo: number) => Rotina | null,
): PessoaNoInsight[] {
  const porCodigo = new Map(execucoes.filter(e => e.codigo != null).map(e => [e.codigo as number, e]));
  const pessoas = new Map<string, PessoaNoInsight>();
  for (const e of empresas) {
    const rotina = rotinaDe(e.codigo);
    if (!rotina) continue;
    const nome = e.responsavel.trim() || SEM_RESPONSAVEL;
    const p = pessoas.get(nome) ?? { nome, feitas: 0, faltando: 0 };
    if (situacaoGeral(porCodigo.get(e.codigo) ?? null, rotina) === 'concluida') p.feitas++; else p.faltando++;
    pessoas.set(nome, p);
  }
  // quem tem mais faltando primeiro; "Sem responsável" no fim
  return [...pessoas.values()].sort((a, b) => Number(a.nome === SEM_RESPONSAVEL) - Number(b.nome === SEM_RESPONSAVEL) || b.faltando - a.faltando || a.nome.localeCompare(b.nome, 'pt-BR'));
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
export function delegadasAtrasadas(lista: readonly { status: string; prazo: string; prazoHora?: string; responsavel?: { nome?: string } | null }[], hoje: string, agora = ''): ResumoDosInsights['equipe'] {
  const porNome = new Map<string, number>();
  for (const t of lista) {
    if (!atrasada(t as Parameters<typeof atrasada>[0], hoje, agora)) continue;
    const nome = (t.responsavel?.nome || '').trim() || SEM_RESPONSAVEL;
    porNome.set(nome, (porNome.get(nome) ?? 0) + 1);
  }
  const pessoas = [...porNome].map(([nome, atrasadas]) => ({ nome, atrasadas })).sort((a, b) => b.atrasadas - a.atrasadas || a.nome.localeCompare(b.nome, 'pt-BR'));
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
  const pessoas = (v: unknown) => (Array.isArray(v) ? v : []).map(obj).filter(p => txt(p.nome)).slice(0, 40).map(p => ({ nome: txt(p.nome), feitas: num(p.feitas), faltando: num(p.faltando) }));
  const dp = obj(o.dp), g = obj(o.guias), c = obj(o.clientes), e = obj(o.entregas), q = obj(o.equipe);
  return {
    atualizadoEm: o.atualizadoEm,
    rotinas: (Array.isArray(o.rotinas) ? o.rotinas : []).map(obj).filter(r => r.setor === 'fiscal' || r.setor === 'contabil')
      .map(r => ({ setor: r.setor as 'fiscal' | 'contabil', competencia: comp(r.competencia), pessoas: pessoas(r.pessoas) })),
    dp: { competencia: comp(dp.competencia), feitas: num(dp.feitas), pendentes: num(dp.pendentes), atrasadas: num(dp.atrasadas), sem: num(dp.sem) },
    guias: { competencia: comp(g.competencia), enviadas: num(g.enviadas), abertas: num(g.abertas), pagas: num(g.pagas) },
    clientes: { abertas: num(c.abertas), respondidas: num(c.respondidas), nota: Math.min(5, num(c.nota)), avaliacoes: num(c.avaliacoes), documentosFaltando: num(c.documentosFaltando), mandeiAbertos: num(c.mandeiAbertos) },
    entregas: { aEntregar: num(e.aEntregar), noLink: num(e.noLink), confirmadas: num(e.confirmadas), falhas: num(e.falhas) },
    equipe: { atrasadas: num(q.atrasadas), pessoas: (Array.isArray(q.pessoas) ? q.pessoas : []).map(obj).filter(p => txt(p.nome)).slice(0, 40).map(p => ({ nome: txt(p.nome), atrasadas: num(p.atrasadas) })) },
  };
}

/** Um resumo de exemplo (a tela sem banco e os testes). */
export function resumoDeExemploDosInsights(agora: Date): ResumoDosInsights {
  const mes = (d: number) => { const x = new Date(agora.getFullYear(), agora.getMonth() + d, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  return {
    atualizadoEm: agora.toISOString(),
    rotinas: [
      { setor: 'fiscal', competencia: mes(-1), pessoas: [{ nome: 'Heverton', feitas: 38, faltando: 6 }, { nome: 'Adivania', feitas: 41, faltando: 2 }, { nome: 'Gustavo', feitas: 30, faltando: 0 }] },
      { setor: 'contabil', competencia: mes(-1), pessoas: [{ nome: 'Fernando', feitas: 12, faltando: 9 }, { nome: 'Felipe', feitas: 15, faltando: 4 }, { nome: 'Clara', feitas: 8, faltando: 5 }] },
    ],
    dp: { competencia: mes(-1), feitas: 96, pendentes: 18, atrasadas: 3, sem: 22 },
    guias: { competencia: mes(-1), enviadas: 412, abertas: 287, pagas: 154 },
    clientes: { abertas: 7, respondidas: 4, nota: 4.6, avaliacoes: 11, documentosFaltando: 23, mandeiAbertos: 9 },
    entregas: { aEntregar: 14, noLink: 6, confirmadas: 132, falhas: 1 },
    equipe: { atrasadas: 5, pessoas: [{ nome: 'Fernando', atrasadas: 3 }, { nome: 'Clara', atrasadas: 2 }] },
  };
}
