// Sessão da empresa aberta no Extrator (ViewModel compartilhado pelas telas): a empresa guardada,
// aplicar() para gravar, irPara() e o que a pessoa escolheu em cada tela (período, tolerância,
// filtro, busca), que não se perde ao trocar de aba. Zera ao trocar de empresa.
import { extrator as x } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAplicar, useEmpresa } from '../dados/repo';
import { caminho } from './caminho';

export type FiltroSituacao = 'pendencias' | x.Situacao | 'todos';

export interface EstadoConferencia {
  /** 'aaaa-mm', 'tudo' ou null (= o último mês do extrato) */
  periodo: string | null;
  /** dias de diferença aceitos na data */
  tolerancia: number;
  situacao: FiltroSituacao;
  busca: string;
}

export interface EstadoLancamentos { lado: x.Lado; busca: string }

export const CONFERENCIA_INICIAL: EstadoConferencia = { periodo: null, tolerancia: 3, situacao: 'pendencias', busca: '' };

/** Os avisos de "falta importar". */
export const AVISO_IMPORTAR = {
  banco: { titulo: 'Falta o extrato do banco', html: 'Importe os <b>extratos bancários</b> (PDF) para conferir.', botao: 'Importar extrato' },
  sistema: { titulo: 'Faltam os lançamentos do sistema', html: 'Importe o <b>razão da conta do banco</b> (Excel, CSV ou PDF) para conferir com o extrato.', botao: 'Importar lançamentos' },
} as const;

export interface Sessao {
  nome: string;
  rota: string;
  codigo: number | null;
  empresa: x.EmpresaExtrator;
  aplicar: (acao: (e: x.EmpresaExtrator) => x.EmpresaExtrator) => x.EmpresaExtrator;
  pagina: string;
  irPara: (pagina: string) => void;
  conferencia: EstadoConferencia;
  setConferencia: (f: (c: EstadoConferencia) => EstadoConferencia) => void;
  lancamentos: EstadoLancamentos;
  setLancamentos: (f: (c: EstadoLancamentos) => EstadoLancamentos) => void;
  /** o que falta importar para conferir (null = nada) */
  falta: x.Lado | null;
  avisoImportar: (lado: x.Lado) => void;
}

const Ctx = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSessao fora da empresa aberta');
  return s;
}

export function SessaoProvider({ nome, rota, codigo, pagina, children }: { nome: string; rota: string; codigo: number | null; pagina: string; children: ReactNode }) {
  const navegar = useNavigate();
  const { modal } = useRetorno();
  const empresa = useEmpresa(nome);
  const aplicar = useAplicar(nome);
  const [conferencia, setConf] = useState<EstadoConferencia>(CONFERENCIA_INICIAL);
  const [lancamentos, setLanc] = useState<EstadoLancamentos>({ lado: 'banco', busca: '' });

  const irPara = useCallback((destino: string) => {
    navegar(caminho(rota + '/' + destino));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navegar, rota]);

  const temBanco = empresa.arquivos.some(a => a.lado === 'banco');
  const temSistema = empresa.arquivos.some(a => a.lado === 'sistema');
  const falta: x.Lado | null = !temBanco ? 'banco' : !temSistema ? 'sistema' : null;

  const avisoImportar = useCallback((lado: x.Lado) => {
    const a = AVISO_IMPORTAR[lado];
    void modal({ icone: 'upload', titulo: a.titulo, html: a.html, botoes: [{ rotulo: 'Agora não', valor: false, variante: 'btn-outline' }, { rotulo: a.botao, valor: true, variante: 'btn-primary' }] })
      .then(ok => { if (ok) irPara('importacao/arquivos'); });
  }, [modal, irPara]);

  const valor: Sessao = {
    nome, rota, codigo, empresa, aplicar, pagina, irPara,
    conferencia, setConferencia: setConf, lancamentos, setLancamentos: setLanc,
    falta, avisoImportar,
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
