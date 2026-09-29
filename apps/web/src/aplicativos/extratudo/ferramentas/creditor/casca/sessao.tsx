// Sessão do Creditor: a competência, o relatório do banco (já corrigido pela pessoa), o arquivo do
// sistema e as decisões do cruzamento. Vive só enquanto a empresa está aberta nesta seção (nada disso é gravado).
// As contas não: vêm do balancete da empresa e do que foi salvo nela (dados/repo.tsx), ao vivo; e a
// conta de cada cliente já conciliado resolve sozinha a NF que não está no sistema (aprendizado).
// Também mora aqui a trava das etapas: uma etapa só abre quando a anterior está resolvida.
// Relatório sem nenhum total impresso não tem o que conferir: a etapa Conferência some do fluxo.
import { creditor as cr } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useContasDaEmpresa } from '../dados/repo';
import { caminhoDaEtapa, ETAPAS, indiceDaEtapa, type Etapa, type IdEtapa } from './navegacao';

export interface Estado {
  /** "AAAA-MM" ('' = ainda não escolhida) */
  competencia: string;
  relatorio: cr.RelatorioBanco | null;
  /** de onde veio: nome do arquivo, "texto colado", "exemplo" ou "digitado" */
  origemBanco: string;
  sistema: cr.LinhaSistema[] | null;
  origemSistema: string;
  decisoes: Record<number, cr.Decisao>;
  /** os passos da etapa Fiscal que a pessoa marcou como feitos */
  passosFiscal: string[];
  /** o relatório trouxe total impresso? (sem nenhum, a Conferência fica de fora) */
  conferir: boolean;
  /** a etapa mais adiante que já foi aberta */
  alcancada: number;
}

const INICIAL: Estado = { competencia: '', relatorio: null, origemBanco: '', sistema: null, origemSistema: '', decisoes: {}, passosFiscal: [], conferir: true, alcancada: 0 };

/** Os passos da etapa Fiscal (a ordem e o texto de cada um ficam na tela). */
export const PASSOS_FISCAL = ['baixar', 'exportar-contabil', 'exportar-planilha'] as const;
export type PassoFiscal = (typeof PASSOS_FISCAL)[number];

/** Tudo o que sai do estado (as telas só leem daqui). */
export interface Derivado {
  titulos: cr.Titulo[];
  conferido: boolean;
  cruzamentos: cr.Cruzamento[];
  pendentes: cr.Cruzamento[];
  lancamentos: cr.Lancamento[];
  fora: cr.Titulo[];
  fechamento: cr.FechamentoDia[];
  /** a baixa no Fiscal foi feita (todos os passos marcados) */
  fiscalFeito: boolean;
  /** as decisões que valem: as da pessoa por cima das resolvidas pela conta aprendida */
  decisoes: Record<number, cr.Decisao>;
  /** títulos resolvidos pela conta aprendida do cliente */
  aprendidas: number[];
}

export function derivar(e: Estado, contas: cr.ContasCreditor, aprendidos: cr.ClientesAprendidos): Derivado {
  const titulos = e.relatorio ? e.relatorio.grupos.flatMap(g => g.titulos) : [];
  const conferido = !!e.relatorio && (e.conferir ? cr.relatorioConferido(e.relatorio) : titulos.length > 0);
  const cruzamentos = e.sistema ? cr.cruzar(titulos, e.sistema) : [];
  const auto = cr.decisoesAprendidas(titulos, cruzamentos, aprendidos, e.decisoes);
  const decisoes = { ...auto, ...e.decisoes };
  const pendentes = cr.pendentes(cruzamentos, decisoes);
  const lancamentos = cr.gerarLancamentos(titulos, cruzamentos, decisoes, contas);
  const fora = cr.titulosFora(titulos, cruzamentos, decisoes);
  const fechamento = e.relatorio ? cr.fecharPorDia(e.relatorio.grupos, lancamentos, fora, contas) : [];
  const fiscalFeito = PASSOS_FISCAL.every(p => e.passosFiscal.includes(p));
  return { titulos, conferido, cruzamentos, pendentes, lancamentos, fora, fechamento, fiscalFeito, decisoes, aprendidas: Object.keys(auto).map(Number) };
}

/** A etapa já pode abrir? (o que ela precisa das anteriores) */
function requisitos(id: IdEtapa, e: Estado, d: Derivado): boolean {
  switch (id) {
    case 'competencia': return true;
    case 'banco': return cr.competenciaValida(e.competencia);
    case 'conferencia': return !!e.relatorio && e.conferir;
    case 'fiscal': return d.conferido;
    case 'sistema': return d.conferido && d.fiscalFeito;
    case 'cruzamento': return d.conferido && d.fiscalFeito && !!e.sistema;
    case 'lancamentos': return d.conferido && d.fiscalFeito && !!e.sistema && d.pendentes.length === 0;
  }
}

interface Sessao {
  empresa: { nome: string; codigo: number | null };
  rota: string;
  etapa: IdEtapa;
  /** as etapas deste relatório (sem a Conferência quando não há total impresso) */
  etapas: Etapa[];
  estado: Estado;
  d: Derivado;
  /** as contas da empresa: as que valem (salvas, sugeridas pelo balancete ou padrão) e o balancete */
  contas: {
    resolvidas: cr.ContasResolvidas;
    balancete: cr.BalanceteDaEmpresa;
    carregada: boolean;
    escolher: (campo: keyof cr.ContasCreditor, valor: string) => void;
    /** esquece o que foi salvo: voltam as sugestões do balancete (e os históricos padrão) */
    esquecer: () => void;
  };
  mudar: (f: (e: Estado) => Estado) => void;
  /** relatório novo (anexado ou do Drive): descarta as decisões e volta a travar as etapas seguintes */
  usarRelatorio: (rel: cr.RelatorioBanco, origem: string) => void;
  /** abre a etapa sem conferir os requisitos agora (quem chama acabou de mudar o estado que a libera) */
  avancarPara: (id: IdEtapa) => void;
  /** a conciliação terminou (o arquivo foi baixado): salva as contas e aprende os clientes */
  concluir: () => void;
  podeAbrir: (id: IdEtapa) => boolean;
  irPara: (id: IdEtapa) => void;
  proxima: () => void;
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
  const { toast } = useRetorno();
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const daEmpresa = useContasDaEmpresa(empresa.nome);
  const { balancete, config, clientes, salvar, salvarClientes } = daEmpresa;
  const resolvidas = useMemo(() => cr.resolverContas(balancete, config), [balancete, config]);
  const d = useMemo(() => derivar(estado, resolvidas.contas, clientes), [estado, resolvidas, clientes]);

  const podeAbrir = useCallback((id: IdEtapa) => indiceDaEtapa(id) <= estado.alcancada && requisitos(id, estado, d), [estado, d]);

  const abrir = useCallback((id: IdEtapa) => {
    const i = indiceDaEtapa(id);
    setEstado(e => ({ ...e, alcancada: Math.max(e.alcancada, i) }));
    navegar(caminhoDaEtapa(rota, id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navegar, rota]);

  const irPara = useCallback((id: IdEtapa) => {
    if (id === etapa) return;
    if (!podeAbrir(id)) { toast(MSG_ETAPA_TRAVADA); return; }
    abrir(id);
  }, [etapa, podeAbrir, abrir, toast]);

  const etapas = estado.conferir ? ETAPAS : ETAPAS.filter(x => x.id !== 'conferencia');
  const i = etapas.findIndex(x => x.id === etapa);
  const s: Sessao = {
    empresa, rota, etapa, etapas, estado, d,
    contas: {
      resolvidas, balancete, carregada: daEmpresa.carregada,
      escolher: (campo, valor) => salvar(cr.escolherConta(config, campo, valor, balancete)),
      esquecer: () => salvar(cr.CONFIG_VAZIA),
    },
    mudar: f => setEstado(f),
    usarRelatorio: (rel, origem) => setEstado(e => ({
      ...e, relatorio: rel, origemBanco: origem, decisoes: {}, passosFiscal: [], conferir: cr.temTotalImpresso(rel),
      alcancada: Math.min(e.alcancada, indiceDaEtapa('banco')),
    })),
    avancarPara: abrir,
    concluir: () => {
      salvar(cr.confirmarContas(config, resolvidas));
      salvarClientes(cr.aprender(clientes, d.titulos, d.cruzamentos, d.decisoes, new Date()));
    },
    podeAbrir, irPara,
    proxima: () => { const p = etapas[i + 1]; if (p && requisitos(p.id, estado, d)) abrir(p.id); },
    anterior: () => { if (i > 0) abrir(etapas[i - 1].id); },
    recomecar: () => { setEstado(INICIAL); navegar(caminhoDaEtapa(rota, 'competencia')); },
  };
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

/** Id livre para um título digitado à mão. */
export function proximoIdTitulo(r: cr.RelatorioBanco): number {
  return r.grupos.flatMap(g => g.titulos).reduce((m, t) => Math.max(m, t.id), 0) + 1;
}
