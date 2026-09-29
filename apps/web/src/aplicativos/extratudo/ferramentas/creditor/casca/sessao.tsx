// Sessão do Creditor: o relatório do banco (já corrigido pela pessoa), o arquivo do sistema, as
// decisões do cruzamento e as contas. Vive só enquanto a empresa está aberta nesta seção (nada é
// gravado). Também mora aqui a trava das etapas: uma etapa só abre quando a anterior está resolvida.
// Relatório sem nenhum total impresso não tem o que conferir: a etapa Conferência some do fluxo.
import { creditor as cr } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaEtapa, ETAPAS, indiceDaEtapa, type Etapa, type IdEtapa } from './navegacao';

export interface Estado {
  relatorio: cr.RelatorioBanco | null;
  /** de onde veio: nome do arquivo, "texto colado", "exemplo" ou "digitado" */
  origemBanco: string;
  sistema: cr.LinhaSistema[] | null;
  origemSistema: string;
  decisoes: Record<number, cr.Decisao>;
  contas: cr.ContasCreditor;
  /** o relatório trouxe total impresso? (sem nenhum, a Conferência fica de fora) */
  conferir: boolean;
  /** a etapa mais adiante que já foi aberta */
  alcancada: number;
}

const INICIAL: Estado = { relatorio: null, origemBanco: '', sistema: null, origemSistema: '', decisoes: {}, contas: cr.CONTAS_PADRAO, conferir: true, alcancada: 0 };

/** Tudo o que sai do estado (as telas só leem daqui). */
export interface Derivado {
  titulos: cr.Titulo[];
  conferido: boolean;
  cruzamentos: cr.Cruzamento[];
  pendentes: cr.Cruzamento[];
  lancamentos: cr.Lancamento[];
  fora: cr.Titulo[];
  fechamento: cr.FechamentoDia[];
}

export function derivar(e: Estado): Derivado {
  const titulos = e.relatorio ? e.relatorio.grupos.flatMap(g => g.titulos) : [];
  const conferido = !!e.relatorio && (e.conferir ? cr.relatorioConferido(e.relatorio) : titulos.length > 0);
  const cruzamentos = e.sistema ? cr.cruzar(titulos, e.sistema) : [];
  const pendentes = cr.pendentes(cruzamentos, e.decisoes);
  const lancamentos = cr.gerarLancamentos(titulos, cruzamentos, e.decisoes, e.contas);
  const fora = cr.titulosFora(titulos, cruzamentos, e.decisoes);
  const fechamento = e.relatorio ? cr.fecharPorDia(e.relatorio.grupos, lancamentos, fora, e.contas) : [];
  return { titulos, conferido, cruzamentos, pendentes, lancamentos, fora, fechamento };
}

/** A etapa já pode abrir? (o que ela precisa das anteriores) */
function requisitos(id: IdEtapa, e: Estado, d: Derivado): boolean {
  switch (id) {
    case 'banco': return true;
    case 'conferencia': return !!e.relatorio && e.conferir;
    case 'sistema': return d.conferido;
    case 'cruzamento': return d.conferido && !!e.sistema;
    case 'lancamentos': return d.conferido && !!e.sistema && d.pendentes.length === 0;
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
  mudar: (f: (e: Estado) => Estado) => void;
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
  const d = useMemo(() => derivar(estado), [estado]);

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
    mudar: f => setEstado(f),
    podeAbrir, irPara,
    proxima: () => { const p = etapas[i + 1]; if (p && requisitos(p.id, estado, d)) abrir(p.id); },
    anterior: () => { if (i > 0) abrir(etapas[i - 1].id); },
    recomecar: () => { setEstado(INICIAL); navegar(caminhoDaEtapa(rota, 'banco')); },
  };
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

/** Id livre para um título digitado à mão. */
export function proximoIdTitulo(r: cr.RelatorioBanco): number {
  return r.grupos.flatMap(g => g.titulos).reduce((m, t) => Math.max(m, t.id), 0) + 1;
}
