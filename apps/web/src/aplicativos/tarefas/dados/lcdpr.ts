// O Importador LCDPR dentro da empresa (16/10/2026: "quero integrar no app o importador lcpr e o entregas, só que preciso
// que fique tudo no visual igual para não destoar do app"; "coloque o lcdpr como parte da empresa 62 de carlos lucas
// apenas"): as regras e os cadastros ficam no MESMO documento da página antiga do Entregas (lcdpr/config), que continua
// funcionando junto. Os lançamentos importados não vão para lugar nenhum (como lá): moram na sessão da tela.
// Interface + a versão de exemplo; a do banco é lcdpr.firestore.ts.
import { lcdpr } from '@nads/core';

export interface ConfigDoLcdpr {
  carregada: boolean;
  config: lcdpr.ConfigLcdpr;
  /** o documento ainda não existe no banco: valem os padrões (a primeira mudança grava tudo) */
  semDocumento: boolean;
  /** por que não deu para ler (ex.: a regra do banco não deixa) */
  erro: string;
}

export interface RepoLcdpr {
  readonly exemplos: boolean;
  /** as regras e os cadastros, ao vivo (pedir já começa a ouvir) */
  config(): ConfigDoLcdpr;
  /** grava o documento inteiro (como a página antiga faz) */
  salvar(c: lcdpr.ConfigLcdpr): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos: os padrões da página antiga, com um CPF de produtor fictício; nada vai para o banco. */
export function criarLcdprMemoria(): RepoLcdpr {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const inicial = lcdpr.configPadrao();
  inicial.config.cpfProdutor = '52998224725';
  let estado: ConfigDoLcdpr = { carregada: true, config: inicial, semDocumento: false, erro: '' };
  return {
    exemplos: true,
    config: () => estado,
    async salvar(c) { estado = { ...estado, config: c }; ver++; for (const f of ouvintes) f(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
