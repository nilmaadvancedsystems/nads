// Sessão do Conciliadorzinho: tudo o que o original guardava no `state` global, vivo enquanto a
// empresa está aberta (nada é gravado; trocar de empresa, de ferramenta ou sair começa do zero, como o original).
// Também é aqui que mora irPara() com a trava das etapas (o antigo goStep/maxStep).
// Origem: conciliadorZINHO.html state (~L970), goStep (~L1082), resetApp (~L2228),
// runTotalsValidation (~L1717).
import { conciliadorzinho as cz } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaEtapa, etapas, type Etapa, type IdEtapa } from './navegacao';

export interface ArquivoExtrato { id: number; nome: string; tamanho: number; transacoes: cz.Transacao[] }
export interface DadosBandeira { arquivos: ArquivoExtrato[]; conta: string }
export interface ArquivoVendas { nome: string; tamanho: number; vendas: cz.Venda[]; meses: cz.MesContagem[] }
export interface ContasTela { vendas: string; taxas: string; caixaPadrao: boolean | null; caixa: string }
export interface ResultadoConciliacao {
  ordem: cz.IdBandeira[];
  conciliacao: cz.Conciliacao;
  conferencia: { ok: boolean; problemas: string[] };
}

export interface Estado {
  bandeiras: cz.IdBandeira[];
  dados: Partial<Record<cz.IdBandeira, DadosBandeira>>;
  vendas: ArquivoVendas | null;
  /** null = todos os meses do cartão; lista = só estes (os em comum com as vendas) */
  mesesPermitidos: cz.Mes[] | null;
  /** meses do cartão que ficaram de fora porque as vendas não cobrem */
  excluidos: cz.Mes[];
  contas: ContasTela;
  resultado: ResultadoConciliacao | null;
  /** a etapa mais adiante que já foi aberta (o antigo maxStep, a partir de 0) */
  alcancada: number;
}

const INICIAL: Estado = {
  bandeiras: [], dados: {}, vendas: null, mesesPermitidos: null, excluidos: [],
  contas: { vendas: '', taxas: '', caixaPadrao: null, caixa: '' }, resultado: null, alcancada: 0,
};

export const MSG_ETAPA_TRAVADA = 'Preencha os passos anteriores';

/** Todas as transações de uma bandeira (todos os arquivos dela). */
export function transacoesDa(e: Estado, b: cz.IdBandeira): cz.Transacao[] {
  return (e.dados[b]?.arquivos || []).flatMap(a => a.transacoes);
}

/** Transações de todas as bandeiras escolhidas (getAllBrandTransactions). */
export function todasTransacoes(e: Estado): cz.Transacao[] {
  return e.bandeiras.flatMap(b => transacoesDa(e, b));
}

export function transacoesPorBandeira(e: Estado): Partial<Record<cz.IdBandeira, cz.Transacao[]>> {
  const r: Partial<Record<cz.IdBandeira, cz.Transacao[]>> = {};
  for (const b of e.bandeiras) r[b] = transacoesDa(e, b);
  return r;
}

/** A conciliação completa com a conferência dos totais (runTotalsValidation, sem as barras de espera). */
export function conciliarTudo(e: Estado): ResultadoConciliacao {
  const transacoes = transacoesPorBandeira(e);
  const vendas = e.vendas?.vendas || [];
  const ordem = cz.ordemDasBandeiras(transacoes, e.bandeiras);
  const conciliacao = cz.conciliar({ ordem, transacoes, vendas, mesesPermitidos: e.mesesPermitidos });
  return { ordem, conciliacao, conferencia: cz.conferirTotais(conciliacao, ordem, transacoes, vendas, e.mesesPermitidos) };
}

interface Sessao {
  empresa: { nome: string; codigo: number | null };
  rota: string;
  etapa: IdEtapa;
  lista: Etapa[];
  estado: Estado;
  mudar: (f: (e: Estado) => Estado) => void;
  irPara: (etapa: IdEtapa) => void;
  podeAbrir: (etapa: IdEtapa) => boolean;
  proxima: () => void;
  anterior: () => void;
  recomecar: () => void;
}

const Ctx = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSessao fora do SessaoProvider');
  return s;
}

export function SessaoProvider({ empresa, rota, etapa, children }: { empresa: { nome: string; codigo: number | null }; rota: string; etapa: IdEtapa; children: ReactNode }) {
  const navegar = useNavigate();
  const { toast } = useRetorno();
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const lista = useMemo(() => etapas(estado.bandeiras), [estado.bandeiras]);
  const indice = useCallback((id: IdEtapa) => lista.findIndex(x => x.id === id), [lista]);

  const abrir = useCallback((id: IdEtapa, lst: Etapa[] = lista) => {
    const i = lst.findIndex(x => x.id === id);
    setEstado(e => ({ ...e, alcancada: Math.max(e.alcancada, i) }));
    navegar(caminhoDaEtapa(rota, id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [lista, navegar, rota]);

  const podeAbrir = useCallback((id: IdEtapa) => { const i = indice(id); return i >= 0 && i <= estado.alcancada; }, [indice, estado.alcancada]);

  const irPara = useCallback((id: IdEtapa) => {
    if (id === etapa) return;
    if (!podeAbrir(id)) { toast(MSG_ETAPA_TRAVADA); return; }
    abrir(id);
  }, [etapa, podeAbrir, abrir, toast]);

  const s: Sessao = {
    empresa, rota, etapa, lista, estado,
    mudar: f => setEstado(f),
    irPara, podeAbrir,
    proxima: () => { const i = indice(etapa); if (i >= 0 && i < lista.length - 1) abrir(lista[i + 1].id); },
    anterior: () => { const i = indice(etapa); if (i > 0) abrir(lista[i - 1].id); },
    recomecar: () => { setEstado(INICIAL); navegar(caminhoDaEtapa(rota, 'bandeiras')); },
  };
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

/** Abre uma etapa de uma lista nova (depois de trocar as bandeiras, a lista muda na mesma hora). */
export function useAbrirEtapa() {
  const s = useSessao();
  const navegar = useNavigate();
  return (id: IdEtapa, bandeiras: cz.IdBandeira[]) => {
    const i = etapas(bandeiras).findIndex(x => x.id === id);
    s.mudar(e => ({ ...e, alcancada: Math.max(e.alcancada, i) }));
    navegar(caminhoDaEtapa(s.rota, id));
  };
}
