// O catálogo de componentes do nads (Vitor, 02/10/2026: "um mini site com TODOS os componentes da aplicação, menu
// lateral com as telas que têm aquele componente e menu superior com o tipo"). Cada peça é desenhada com as MESMAS
// peças do sistema (@nads/ui e o nads.css): mudar uma peça aqui é mudar no sistema todo, e o contrário também.
import type { NomeIcone, OpcoesModal } from '@nads/ui';
import type { ReactNode } from 'react';

export type IdTipo =
  | 'botoes' | 'selos' | 'icones' | 'logos' | 'campos' | 'tabelas' | 'menus' | 'janelas' | 'avisos' | 'abas'
  | 'cabecalhos' | 'laterais' | 'cartoes' | 'listas' | 'carregamento' | 'graficos' | 'cores' | 'textos';

/** prefixo: o começo do código das peças do tipo (BT-01, SE-02…) */
export interface Tipo { id: IdTipo; nome: string; icone: NomeIcone; descricao: string; prefixo: string }

/** Uma tela do sistema (o menu lateral do catálogo). */
export interface Tela { id: string; app: string; nome: string; caminho?: string }

/** Uma peça: o nome, como se escreve (classes / componente), onde aparece e o desenho ao vivo. */
export interface Peca {
  /** o código da peça para falar dela (BT-01, JN-07…): o prefixo do tipo + a ordem; peça nova entra no fim do tipo */
  cod?: string;
  id: string;
  tipo: IdTipo;
  nome: string;
  descricao?: string;
  /** o componente React do @nads/ui (ex.: "MenuSuspenso") */
  componente?: string;
  /** as classes do nads.css (ex.: "btn btn-primary") */
  classes?: string[];
  /** as telas onde ela aparece (ids de TELAS) */
  telas: string[];
  /** como usar (o trecho de código, curto) */
  uso?: string;
  /** o desenho ao vivo, com as peças do sistema */
  demo: () => ReactNode;
  /** o desenho precisa da largura toda (cabeçalhos, tabelas) */
  largo?: boolean;
  /**
   * ▶ Reproduzir, de verdade (a peça completa): a janela abre por cima da tela, o aviso aparece, a abertura roda.
   * Sem isto, o ▶ só redesenha a peça (a animação de entrada roda de novo).
   */
  aoVivo?: (c: AoVivo) => void;
  /**
   * A peça saiu do sistema (Vitor, 02/10/2026): continua no catálogo, em preto e branco e com o nome riscado, dizendo
   * para onde foi — excluída, movida (para outra tela) ou substituída por outra peça (o id dela) — e o motivo. Guarda o
   * código. Só aqui: na aplicação, a peça simplesmente foi trocada.
   */
  removida?: { como: 'excluida' | 'movida' | 'substituida'; por?: string; para?: string; em: string; motivo: string };
}

export interface AoVivo {
  modal: (o: OpcoesModal<unknown>) => Promise<unknown>;
  toast: (texto: string) => void;
  /** a abertura com o N na tela inteira por uns segundos (completa: a logo inteira; vidro: o N no vidro) */
  abertura: (tipo: 'completa' | 'vidro') => void;
}
