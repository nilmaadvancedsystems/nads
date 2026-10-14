// Sessão do Creditor: a competência, o relatório do banco e as decisões das contas. Vive só enquanto a
// empresa está aberta nesta seção (nada disso é gravado). As contas não: vêm do balancete da empresa e
// do que foi salvo nela (dados/repo.tsx), ao vivo. A conta de cada cliente vem da conta aprendida ou do
// balancete (sem arquivo do sistema nem Conferência dos grupos desde 2026-09-29; o banco manda).
// Também mora aqui a trava das etapas: uma etapa só abre quando a anterior está resolvida.
import { creditor as cr, extrator as x } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useContasDaEmpresa, useDrive } from '../dados/repo';
import { useCadastroDaEmpresa, useEmpresa } from '../../extrator/dados/repo';
import { useSaidasDaConferencia } from '../../../../concilia-ai/importadosNaEtapa';
import { caminhoDaEtapa, ETAPAS, indiceDaEtapa, type Etapa, type IdEtapa } from './navegacao';

export interface Estado {
  /** "AAAA-MM" ('' = ainda não escolhida) */
  competencia: string;
  relatorio: cr.RelatorioBanco | null;
  /** por período: o relatório de cada mês (o relatorio acima é eles juntos); o anexado na etapa do banco vale para todos */
  porMes: Record<string, { relatorio: cr.RelatorioBanco; origem: string }>;
  /** de onde veio: nome do arquivo, "texto colado", "exemplo" ou "digitado" */
  origemBanco: string;
  decisoes: Record<number, cr.Decisao>;
  /** (os passos da antiga etapa Fiscal; a etapa saiu em 05/10/2026) */
  passosFiscal: string[];
  /** o .xls dos lançamentos já foi baixado (abre a Exclusão) */
  baixado: boolean;
  /** a Exclusão: o razão do banco reimportado bate com o extrato no período (a Tarefa pode seguir) */
  bancoConferido: boolean;
  /** o razão do banco importado na própria Exclusão (os arquivos do Extrator e o nome); sem ele, a etapa não diz Ok */
  razaoDaExclusao?: { ids: string[]; nome: string };
  /** a etapa mais adiante que já foi aberta */
  alcancada: number;
}

const INICIAL: Estado = { competencia: '', relatorio: null, porMes: {}, origemBanco: '', decisoes: {}, passosFiscal: [], baixado: false, bancoConferido: false, alcancada: 0 };

/** Os relatórios dos meses da competência, juntos (relatório novo: descarta as decisões e trava as etapas seguintes). */
function comOsMeses(e: Estado, porMes: Estado['porMes']): Estado {
  const meses = cr.mesesDaCompetencia(e.competencia).filter(m => porMes[m]);
  return {
    ...e, porMes,
    relatorio: meses.length ? cr.juntarRelatorios(meses.map(m => porMes[m].relatorio)) : null,
    origemBanco: meses.map(m => porMes[m].origem).join(' · '),
    decisoes: {}, passosFiscal: [], baixado: false, bancoConferido: false, razaoDaExclusao: undefined, alcancada: Math.min(e.alcancada, indiceDaEtapa('competencia')),
  };
}


/** Tudo o que sai do estado (as telas só leem daqui). */
export interface Derivado {
  titulos: cr.Titulo[];
  conferido: boolean;
  cruzamentos: cr.Cruzamento[];
  pendentes: cr.Cruzamento[];
  lancamentos: cr.Lancamento[];
  fora: cr.Titulo[];
  fechamento: cr.FechamentoDia[];
  /** as decisões que valem: as da pessoa por cima das resolvidas pela conta aprendida */
  decisoes: Record<number, cr.Decisao>;
  /** títulos resolvidos pela conta aprendida do cliente */
  aprendidas: number[];
  /** os títulos de cliente fora do balancete (sem conta ou com a conta aprendida assim): a etapa Contas */
  semConta: cr.Cruzamento[];
  /** o extrato da conta banco que o Creditor obedece (null = não tem extrato importado no período: vale o relatório) */
  extrato: { banco: string; meses: string[] } | null;
  /** os títulos do relatório que o banco não creditou (sem CRÉD.LIQ.COBRANÇA no extrato): fora do arquivo */
  semCredito: cr.Titulo[];
  /** os CRÉD.LIQ.COBRANÇA do extrato que nenhum título do relatório explica (o total fica no Alterdata) */
  creditosSemTitulo: cr.CreditoDeLiquidacao[];
}

/** O extrato da conta banco no período: os meses que têm extrato e os créditos de liquidação. */
export interface ExtratoDoCreditor { banco: string; meses: string[]; creditos: cr.CreditoDeLiquidacao[] }

export function derivar(e: Estado, contas: cr.ContasCreditor, aprendidos: cr.ClientesAprendidos, clientes: readonly cr.ContaDoBalancete[], porNf?: ReadonlyMap<string, readonly cr.ContaDaNota[]>, extrato?: ExtratoDoCreditor | null): Derivado {
  const todos = e.relatorio ? e.relatorio.grupos.flatMap(g => g.titulos) : [];
  const conferido = todos.length > 0;
  // o Creditor obedece o extrato (Vitor, 14/10/2026): só entra o título que o banco creditou, na data do crédito
  const casamento = extrato && todos.length ? cr.casarComExtrato(todos, extrato.creditos, extrato.meses) : null;
  const semCredito = casamento?.semCredito || [];
  const tirados = new Set(semCredito.map(t => t.id));
  const titulos = todos.filter(t => !tirados.has(t.id));
  const cruzamentos = cr.cruzarPeloBalancete(titulos, clientes, aprendidos, porNf);
  const auto = cr.decisoesAprendidas(titulos, cruzamentos, aprendidos, e.decisoes);
  const decisoes = { ...auto, ...e.decisoes };
  const pendentes = cr.pendentes(cruzamentos, decisoes);
  const lancamentos = cr.gerarLancamentos(titulos, cruzamentos, decisoes, contas, casamento?.dataDoCredito);
  const fora = cr.titulosFora(titulos, cruzamentos, decisoes);
  const fechamento = casamento ? cr.fecharPeloExtrato(casamento, lancamentos, fora, contas) : e.relatorio ? cr.fecharPorDia(e.relatorio.grupos, lancamentos, fora, contas) : [];
  return {
    titulos, conferido, cruzamentos, pendentes, lancamentos, fora, fechamento, decisoes, aprendidas: Object.keys(auto).map(Number),
    semConta: cruzamentos.filter(c => c.situacao === 'nao-encontrada' || (c.aprendida && c.foraDoBalancete)),
    extrato: extrato ? { banco: extrato.banco, meses: extrato.meses } : null, semCredito,
    creditosSemTitulo: casamento ? casamento.creditos.filter(c => !c.titulos.length).map(c => c.credito) : [],
  };
}

/** A etapa já pode abrir? (o que ela precisa das anteriores) */
function requisitos(id: IdEtapa, e: Estado, d: Derivado): boolean {
  switch (id) {
    case 'competencia': return true;
    // sem o passo a passo do Fiscal (05/10/2026): as Contas abrem com o relatório lido
    // e o relatório de todos os meses da competência (por período, um por mês; ou o anexado inteiro)
    case 'contas': return d.semConta.length > 0 && d.conferido && (!Object.keys(e.porMes).length || cr.mesesDaCompetencia(e.competencia).every(m => e.porMes[m]));
    // com cliente sem conta, só depois de informar todas na etapa Contas
    case 'cruzamento': return d.conferido && (!Object.keys(e.porMes).length || cr.mesesDaCompetencia(e.competencia).every(m => e.porMes[m]))
      && d.semConta.every(c => c.situacao !== 'nao-encontrada' || cr.decisaoValida(c, d.decisoes[c.tituloId]));
    case 'lancamentos': return d.conferido && d.pendentes.length === 0;
    case 'exclusao': return d.conferido && d.pendentes.length === 0 && e.baixado;
  }
}

interface Sessao {
  empresa: { nome: string; codigo: number | null };
  rota: string;
  etapa: IdEtapa;
  etapas: Etapa[];
  estado: Estado;
  d: Derivado;
  /** as contas da empresa: as que valem (salvas, sugeridas pelo balancete ou padrão) e o balancete */
  contas: {
    resolvidas: cr.ContasResolvidas;
    balancete: cr.BalanceteDaEmpresa;
    /** as contas de clientes do balancete (para a pessoa escolher quando não acha) */
    clientes: cr.ContaDoBalancete[];
    carregada: boolean;
    escolher: (campo: keyof cr.ContasCreditor, valor: string) => void;
    /** esquece o que foi salvo: voltam as sugestões do balancete (e os históricos padrão) */
    esquecer: () => void;
  };
  mudar: (f: (e: Estado) => Estado) => void;
  /** relatório novo (anexado ou do Drive): descarta as decisões e volta a travar as etapas seguintes */
  usarRelatorio: (rel: cr.RelatorioBanco, origem: string) => void;
  /** por período: o relatório de um mês (os dos meses vão juntos); null tira o do mês */
  relatorioDoMes: (mes: string, rel: cr.RelatorioBanco | null, origem?: string) => void;
  /** troca os meses da competência: os relatórios dos meses que saíram saem junto */
  definirCompetencia: (c: string) => void;
  /** abre a etapa sem conferir os requisitos agora (quem chama acabou de mudar o estado que a libera) */
  avancarPara: (id: IdEtapa) => void;
  /** guarda já as contas dos títulos (a etapa Contas: Vitor, 14/10/2026, "deixa o que jogou nessa tela armazenado") */
  aprenderJa: (ids: number[], decisoes: Record<number, cr.Decisao>) => void;
  /** a conciliação terminou (o arquivo foi baixado): salva as contas e aprende os clientes */
  concluir: () => void;
  podeAbrir: (id: IdEtapa) => boolean;
  irPara: (id: IdEtapa) => void;
  proxima: () => void;
  /** tem etapa seguinte e ela já pode abrir (o Próximo ao lado do Cancelar) */
  podeSeguir: boolean;
  temProxima: boolean;
  anterior: () => void;
  recomecar: () => void;
}

const Ctx = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSessao fora do SessaoProvider do Creditor');
  return s;
}

export const MSG_ETAPA_TRAVADA = 'Resolva as etapas anteriores primeiro';

export function SessaoProvider({ empresa, rota, etapa, children }: { empresa: { nome: string; codigo: number | null }; rota: string; etapa: IdEtapa; children: ReactNode }) {
  const navegar = useNavigate();
  // o ?competencia=&meses= da Tarefa fica no endereço de todas as etapas
  const { search } = useLocation();
  const { toast } = useRetorno();
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const daEmpresa = useContasDaEmpresa(empresa.nome);
  const { config, clientes, salvar, salvarClientes } = daEmpresa;
  // Acoplado no Entregas: o balancete subido lá (Clientes e ajustes → Balancetes) vale por cima do da
  // Conferência — é o que o escritório está usando por enquanto (2026-09-29).
  const { drive, acesso } = useDrive();
  const [doEntregas, setDoEntregas] = useState<cr.BalanceteDaEmpresa | null>(null);
  useEffect(() => {
    if (!acesso.entrou || !drive.balanceteDoEntregas || empresa.codigo == null) return;
    let vivo = true;
    drive.balanceteDoEntregas(empresa.codigo).then(b => { if (vivo) setDoEntregas(b); }).catch(() => { /* sem balancete lá: fica o da Conferência */ });
    return () => { vivo = false; };
  }, [drive, acesso.entrou, empresa.codigo]);
  const balancete = doEntregas || daEmpresa.balancete;
  // os históricos do escritório por cima dos da empresa (Contábil › Configurações; Vitor, 05/10/2026)
  const historicos = daEmpresa.historicos;
  const resolvidas = useMemo(() => {
    const r = cr.resolverContas(balancete, config);
    return { ...r, contas: cr.comHistoricos(r.contas, historicos) };
  }, [balancete, config, historicos]);
  const contasClientes = useMemo(() => cr.contasDeClientes(balancete), [balancete]);
  // a conta pela NF no relatório de Saídas importado na Tarefa (a Conferência da empresa; só lê)
  const saidas = useSaidasDaConferencia(empresa.nome);
  const porNf = useMemo(() => cr.contasPorNf(saidas || []), [saidas]);
  // o extrato da conta banco (o banco do Cadastro ligado a ela, como na Exclusão), nos meses do período
  const emp = useEmpresa(empresa.nome);
  const { cadastro } = useCadastroDaEmpresa(empresa.nome, empresa.codigo);
  const contaBanco = resolvidas.contas.banco;
  const extrato = useMemo<ExtratoDoCreditor | null>(() => {
    const meses = cr.mesesDaCompetencia(estado.competencia);
    if (!meses.length) return null;
    const { bancos, primeiro } = x.bancosDaEmpresaNa(emp, cadastro, empresa.codigo, meses[meses.length - 1]);
    const ligado = cadastro?.bancos?.find(b => b.contaContabil === contaBanco)?.id;
    const banco = bancos.find(b => b.id === ligado) || (bancos.length === 1 ? bancos[0] : null);
    if (!banco) return null;
    const porMes = meses.map(m => ({ m, ls: x.arquivosDoBanco(emp, banco.id, primeiro, 'banco', m).flatMap(a => a.lancamentos.filter(l => l.data.startsWith(m))) }));
    const comExtrato = porMes.filter(p => p.ls.length).map(p => p.m);
    return comExtrato.length ? { banco: banco.nome, meses: comExtrato, creditos: cr.creditosDeLiquidacao(porMes.flatMap(p => p.ls)) } : null;
  }, [emp, cadastro, empresa.codigo, estado.competencia, contaBanco]);
  const d = useMemo(() => derivar(estado, resolvidas.contas, clientes, contasClientes, porNf, extrato), [estado, resolvidas, clientes, contasClientes, porNf, extrato]);

  const podeAbrir = useCallback((id: IdEtapa) => indiceDaEtapa(id) <= estado.alcancada && requisitos(id, estado, d), [estado, d]);

  const abrir = useCallback((id: IdEtapa) => {
    const i = indiceDaEtapa(id);
    setEstado(e => ({ ...e, alcancada: Math.max(e.alcancada, i) }));
    navegar(caminhoDaEtapa(rota, id) + search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navegar, rota, search]);

  const irPara = useCallback((id: IdEtapa) => {
    if (id === etapa) return;
    if (!podeAbrir(id)) { toast(MSG_ETAPA_TRAVADA); return; }
    abrir(id);
  }, [etapa, podeAbrir, abrir, toast]);

  // a etapa Contas só aparece quando falta a conta de algum cliente
  const etapas = ETAPAS.filter(x => x.id !== 'contas' || d.semConta.length > 0);
  const i = etapas.findIndex(x => x.id === etapa);
  const s: Sessao = {
    empresa, rota, etapa, etapas, estado, d,
    contas: {
      resolvidas, balancete, clientes: contasClientes, carregada: daEmpresa.carregada,
      escolher: (campo, valor) => salvar(cr.escolherConta(config, campo, valor, balancete)),
      esquecer: () => salvar(cr.CONFIG_VAZIA),
    },
    mudar: f => setEstado(f),
    usarRelatorio: (rel, origem) => setEstado(e => ({
      ...e, relatorio: rel, porMes: {}, origemBanco: origem, decisoes: {}, passosFiscal: [], baixado: false, bancoConferido: false, razaoDaExclusao: undefined,
      alcancada: Math.min(e.alcancada, indiceDaEtapa('competencia')),
    })),
    relatorioDoMes: (mes, rel, origem = '') => setEstado(e => {
      const porMes = { ...e.porMes };
      if (rel) porMes[mes] = { relatorio: rel, origem }; else delete porMes[mes];
      return comOsMeses(e, porMes);
    }),
    definirCompetencia: c => setEstado(e => {
      if (e.competencia === c) return e;
      const meses = new Set(cr.mesesDaCompetencia(c));
      const porMes = Object.fromEntries(Object.entries(e.porMes).filter(([m]) => meses.has(m)));
      // o anexado inteiro (sem mês) não vale para outra competência
      return Object.keys(e.porMes).length || !e.relatorio ? comOsMeses({ ...e, competencia: c }, porMes) : { ...INICIAL, competencia: c };
    }),
    avancarPara: abrir,
    aprenderJa: (ids, decisoes) => {
      const so = new Set(ids);
      salvarClientes(cr.aprender(clientes, d.titulos.filter(t => so.has(t.id)), d.cruzamentos.filter(c => so.has(c.tituloId)), decisoes, new Date()));
    },
    concluir: () => {
      setEstado(e => ({ ...e, baixado: true }));
      salvar(cr.confirmarContas(config, resolvidas));
      salvarClientes(cr.aprender(clientes, d.titulos, d.cruzamentos, d.decisoes, new Date()));
    },
    podeAbrir, irPara,
    proxima: () => { const p = etapas[i + 1]; if (p && requisitos(p.id, estado, d)) abrir(p.id); },
    podeSeguir: !!etapas[i + 1] && requisitos(etapas[i + 1].id, estado, d),
    temProxima: !!etapas[i + 1],
    anterior: () => { if (i > 0) abrir(etapas[i - 1].id); },
    recomecar: () => { setEstado(INICIAL); navegar(caminhoDaEtapa(rota, 'competencia') + search); },
  };
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

/** Id livre para um título digitado à mão. */
export function proximoIdTitulo(r: cr.RelatorioBanco): number {
  return r.grupos.flatMap(g => g.titulos).reduce((m, t) => Math.max(m, t.id), 0) + 1;
}
