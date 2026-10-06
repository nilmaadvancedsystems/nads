// Sessão do Conversor: o extrato lido e o banco escolhido. Vive só enquanto a aba está aberta: nada é gravado (nem
// em banco de dados, nem no navegador). Também mora aqui a trava das etapas.
import { conversor as cv } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaEtapa, ETAPAS, indiceDaEtapa, type Etapa, type IdEtapa } from './navegacao';

export interface Estado {
  extrato: cv.ExtratoConvertido | null;
  /** o banco do .xls (o nome da aba e do arquivo); começa com o que o leitor achou */
  banco: string;
  lendo: boolean;
  /** a etapa mais adiante que já foi aberta */
  alcancada: number;
}

const INICIAL: Estado = { extrato: null, banco: '', lendo: false, alcancada: 0 };

const temLinhas = (e: Estado) => !!e.extrato && !e.extrato.erro && e.extrato.linhas.length > 0;

/** A etapa já pode abrir? (o banco é o nome da aba e do arquivo: sem ele não segue) */
function requisitos(id: IdEtapa, e: Estado): boolean {
  return id === 'arquivo' || (temLinhas(e) && !!e.banco);
}

interface Sessao {
  etapa: IdEtapa;
  etapas: Etapa[];
  estado: Estado;
  ler: (f: File) => Promise<void>;
  tirar: () => void;
  escolherBanco: (b: string) => void;
  podeAbrir: (id: IdEtapa) => boolean;
  irPara: (id: IdEtapa) => void;
  proxima: () => void;
  podeSeguir: boolean;
  temProxima: boolean;
  recomecar: () => void;
}

const Ctx = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSessao fora do SessaoProvider do Conversor');
  return s;
}

export const MSG_ETAPA_TRAVADA = 'Escolha o extrato e o banco primeiro';

export function SessaoProvider({ etapa, children }: { etapa: IdEtapa; children: ReactNode }) {
  const navegar = useNavigate();
  const { toast } = useRetorno();
  const [estado, setEstado] = useState<Estado>(INICIAL);

  const podeAbrir = useCallback((id: IdEtapa) => indiceDaEtapa(id) <= estado.alcancada && requisitos(id, estado), [estado]);

  const abrir = useCallback((id: IdEtapa) => {
    setEstado(e => ({ ...e, alcancada: Math.max(e.alcancada, indiceDaEtapa(id)) }));
    navegar(caminhoDaEtapa(id));
    window.scrollTo({ top: 0 });
  }, [navegar]);

  const proxima = ETAPAS[indiceDaEtapa(etapa) + 1];
  const s: Sessao = {
    etapa, etapas: ETAPAS, estado,
    ler: async f => {
      setEstado(e => ({ ...e, lendo: true }));
      const extrato = await cv.converterArquivo(f.name, new Uint8Array(await f.arrayBuffer()));
      // arquivo novo: volta a travar as etapas seguintes
      setEstado({ extrato, banco: extrato.banco, lendo: false, alcancada: 0 });
    },
    tirar: () => setEstado(INICIAL),
    escolherBanco: b => setEstado(e => ({ ...e, banco: b })),
    podeAbrir,
    irPara: id => {
      if (id === etapa) return;
      if (!podeAbrir(id)) { toast(MSG_ETAPA_TRAVADA); return; }
      abrir(id);
    },
    proxima: () => { if (proxima && requisitos(proxima.id, estado)) abrir(proxima.id); },
    podeSeguir: !!proxima && requisitos(proxima.id, estado),
    temProxima: !!proxima,
    recomecar: () => { setEstado(INICIAL); navegar(caminhoDaEtapa('arquivo')); },
  };
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}
