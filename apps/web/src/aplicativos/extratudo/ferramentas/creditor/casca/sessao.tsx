// Sessão do Creditor: a competência, o relatório do banco e as decisões das contas. Vive só enquanto a
// empresa está aberta nesta seção (nada disso é gravado). As contas não: vêm do balancete da empresa e
// do que foi salvo nela (dados/repo.tsx), ao vivo. A conta de cada cliente vem da conta aprendida ou do
// balancete (sem arquivo do sistema nem Conferência dos grupos desde 2026-09-29; o banco manda).
// Também mora aqui a trava das etapas: uma etapa só abre quando a anterior está resolvida.
import { creditor as cr } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useContasDaEmpresa, useDrive } from '../dados/repo';
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
  /** a etapa mais adiante que já foi aberta */
  alcancada: number;
}

const INICIAL: Estado = { competencia: '', relatorio: null, porMes: {}, origemBanco: '', decisoes: {}, passosFiscal: [], alcancada: 0 };

/** Os relatórios dos meses da competência, juntos (relatório novo: descarta as decisões e trava as etapas seguintes). */
function comOsMeses(e: Estado, porMes: Estado['porMes']): Estado {
  const meses = cr.mesesDaCompetencia(e.competencia).filter(m => porMes[m]);
  return {
    ...e, porMes,
    relatorio: meses.length ? cr.juntarRelatorios(meses.map(m => porMes[m].relatorio)) : null,
    origemBanco: meses.map(m => porMes[m].origem).join(' · '),
    decisoes: {}, passosFiscal: [], alcancada: Math.min(e.alcancada, indiceDaEtapa('competencia')),
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
}

export function derivar(e: Estado, contas: cr.ContasCreditor, aprendidos: cr.ClientesAprendidos, clientes: readonly cr.ContaDoBalancete[], porNf?: ReadonlyMap<string, readonly cr.ContaDaNota[]>): Derivado {
  const titulos = e.relatorio ? e.relatorio.grupos.flatMap(g => g.titulos) : [];
  const conferido = titulos.length > 0;
  const cruzamentos = cr.cruzarPeloBalancete(titulos, clientes, aprendidos, porNf);
  const auto = cr.decisoesAprendidas(titulos, cruzamentos, aprendidos, e.decisoes);
  const decisoes = { ...auto, ...e.decisoes };
  const pendentes = cr.pendentes(cruzamentos, decisoes);
  const lancamentos = cr.gerarLancamentos(titulos, cruzamentos, decisoes, contas);
  const fora = cr.titulosFora(titulos, cruzamentos, decisoes);
  const fechamento = e.relatorio ? cr.fecharPorDia(e.relatorio.grupos, lancamentos, fora, contas) : [];
  return { titulos, conferido, cruzamentos, pendentes, lancamentos, fora, fechamento, decisoes, aprendidas: Object.keys(auto).map(Number) };
}

/** A etapa já pode abrir? (o que ela precisa das anteriores) */
function requisitos(id: IdEtapa, e: Estado, d: Derivado): boolean {
  switch (id) {
    case 'competencia': return true;
    // sem o passo a passo do Fiscal (05/10/2026): as Contas abrem com o relatório lido
    // e o relatório de todos os meses da competência (por período, um por mês; ou o anexado inteiro)
    case 'cruzamento': return d.conferido && (!Object.keys(e.porMes).length || cr.mesesDaCompetencia(e.competencia).every(m => e.porMes[m]));
    case 'lancamentos': return d.conferido && d.pendentes.length === 0;
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
  const d = useMemo(() => derivar(estado, resolvidas.contas, clientes, contasClientes, porNf), [estado, resolvidas, clientes, contasClientes, porNf]);

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

  const etapas = ETAPAS;
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
      ...e, relatorio: rel, porMes: {}, origemBanco: origem, decisoes: {}, passosFiscal: [],
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
    concluir: () => {
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
