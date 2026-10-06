// A etapa aberta no Executor, para a tela própria dela (Vitor, 06/10/2026: as ferramentas que abriam em iframe viram
// telas da Tarefa). No lugar da URL e das mensagens da ponte (comum/ponte.ts): a tela recebe a empresa e os meses por
// aqui, diz o que falta para seguir (useRequisitosDaEtapa) e oferece os dados de teste do ⚡ (useDadosDeTesteDaEtapa).
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { ItemDeTeste } from '../../../../../comum/BotaoDeTeste';

export interface EtapaAberta {
  /** a empresa (o nome é a chave dos dados) */
  nome: string;
  codigo: number | null;
  /** a competência da vez ('aaaa-mm') e os meses que a etapa trabalha, em ordem (um só, ou o período) */
  competencia: string;
  meses: string[];
  /** o modo desenvolvedor: nada vai para o banco e o ⚡ aparece */
  dev: boolean;
}

/** O que falta para seguir (o Próximo da Tarefa só libera com tudo pronto). */
export interface RequisitosDaEtapa { pronto: boolean; faltam: string[] }

interface Ligacoes { requisitos: (r: RequisitosDaEtapa) => void; teste: (itens: ItemDeTeste[]) => void }

const Ctx = createContext<{ etapa: EtapaAberta; ligacoes: Ligacoes } | null>(null);

export function EtapaProvider({ etapa, onRequisitos, onTeste, children }: {
  etapa: EtapaAberta; onRequisitos: Ligacoes['requisitos']; onTeste: Ligacoes['teste']; children: ReactNode;
}) {
  const ligacoes = useRef<Ligacoes>({ requisitos: onRequisitos, teste: onTeste });
  ligacoes.current = { requisitos: onRequisitos, teste: onTeste };
  // as ligações sempre as mais novas, sem trocar o valor do contexto a cada desenho
  const estavel = useRef<Ligacoes>({ requisitos: r => ligacoes.current.requisitos(r), teste: i => ligacoes.current.teste(i) });
  return <Ctx.Provider value={{ etapa, ligacoes: estavel.current }}>{children}</Ctx.Provider>;
}

function useCtx() {
  const c = useContext(Ctx);
  if (!c) throw new Error('A tela da etapa precisa estar dentro do EtapaProvider');
  return c;
}

/** A empresa e os meses da etapa aberta. */
export function useEtapaAberta(): EtapaAberta {
  return useCtx().etapa;
}

/** Diz à Tarefa o que falta para seguir (a cada mudança). */
export function useRequisitosDaEtapa(r: RequisitosDaEtapa) {
  const { ligacoes } = useCtx();
  const chave = JSON.stringify(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { ligacoes.requisitos(r); }, [ligacoes, chave]);
}

/**
 * Os dados de teste que a tela implanta (o ⚡ do modo desenvolvedor): avisa a Tarefa (o ⚡ de cima) e devolve os itens
 * para o ⚡ da própria linha de importação (comum/BotaoDeTeste). Saiu da tela, as opções somem.
 */
export function useDadosDeTesteDaEtapa(opcoes: { id: string; rotulo: string }[], implantar: (id: string) => void): ItemDeTeste[] {
  const { ligacoes } = useCtx();
  const aoImplantar = useRef(implantar);
  useEffect(() => { aoImplantar.current = implantar; });
  const chave = JSON.stringify(opcoes);
  const itens = opcoes.map(o => ({ rotulo: o.rotulo, onClick: () => aoImplantar.current(o.id) }));
  useEffect(() => {
    ligacoes.teste(itens);
    return () => ligacoes.teste([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligacoes, chave]);
  return itens;
}
