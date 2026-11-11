// O Importador LCDPR dentro da empresa (16/10/2026: "quero integrar no app o importador lcpr e o entregas, só que preciso
// que fique tudo no visual igual para não destoar do app"; "coloque o lcdpr como parte da empresa 62 de carlos lucas
// apenas"): as regras e os cadastros ficam no MESMO documento da página antiga do Entregas (lcdpr/config), que continua
// funcionando junto. Os lançamentos importados ficam mês a mês (11/11/2026) em lcdprEmpresas/{empresa}/meses/{AAAA-MM}, e a
// conta de pagamento lembrada de cada fornecedor em lcdprEmpresas/{empresa}; os históricos e as contas do movimento do
// Alterdata em lcdprEmpresas/{empresa}/cadastros/alterdata.
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

/** Um mês do LCDPR (lcdprEmpresas/{empresa}/meses/{AAAA-MM}), ao vivo. */
export interface MesNoBanco {
  carregado: boolean;
  mes: lcdpr.MesDoLcdpr;
  /** a mudança ainda não foi para o banco (as mudanças seguidas vão juntas, de segundo em segundo) */
  salvando: boolean;
  erro: string;
}

/** Os históricos e as contas aprendidos do movimento do Alterdata (lcdprEmpresas/{empresa}/cadastros/alterdata), ao vivo. */
export interface CadastrosNoBanco { carregados: boolean; cadastros: lcdpr.CadastrosDoAlterdata }

/** A conta de pagamento lembrada de cada fornecedor da empresa (lcdprEmpresas/{empresa}), ao vivo. */
export interface ContasNoBanco { carregadas: boolean; contas: lcdpr.ContasDosFornecedores }

export interface RepoLcdpr {
  readonly exemplos: boolean;
  /** as regras e os cadastros, ao vivo (pedir já começa a ouvir) */
  config(): ConfigDoLcdpr;
  /** grava o documento inteiro (como a página antiga faz) */
  salvar(c: lcdpr.ConfigLcdpr): Promise<void>;
  /** o mês da empresa (11/11/2026: o controle mês a mês), ao vivo */
  mes(empresa: number, competencia: string): MesNoBanco;
  /** grava o mês (a tela já mostra na hora; o banco recebe a última versão de segundo em segundo). O erro chega em aoFalhar. */
  salvarMes(m: lcdpr.MesDoLcdpr, aoFalhar: (msg: string) => void): void;
  /** a conta lembrada de cada fornecedor */
  contas(empresa: number): ContasNoBanco;
  salvarContas(empresa: number, contas: lcdpr.ContasDosFornecedores): Promise<void>;
  /** os históricos e as contas do Alterdata (11/11/2026) */
  cadastros(empresa: number): CadastrosNoBanco;
  salvarCadastros(empresa: number, c: lcdpr.CadastrosDoAlterdata): Promise<void>;
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
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const meses = new Map<string, MesNoBanco>();
  const contas = new Map<number, ContasNoBanco>();
  const cadastros = new Map<number, CadastrosNoBanco>();
  return {
    exemplos: true,
    cadastros(empresa) {
      if (!cadastros.has(empresa)) cadastros.set(empresa, { carregados: true, cadastros: lcdpr.cadastrosVazios() });
      return cadastros.get(empresa)!;
    },
    async salvarCadastros(empresa, c) { cadastros.set(empresa, { carregados: true, cadastros: c }); mudou(); },
    config: () => estado,
    async salvar(c) { estado = { ...estado, config: c }; mudou(); },
    // nos exemplos, o mês começa vazio (o "Puxar do SIEG" traz as notas de exemplo) e fica só na memória
    mes(empresa, competencia) {
      const k = empresa + '_' + competencia;
      if (!meses.has(k)) meses.set(k, { carregado: true, mes: lcdpr.mesVazio(empresa, competencia), salvando: false, erro: '' });
      return meses.get(k)!;
    },
    salvarMes(m) { meses.set(m.empresa + '_' + m.competencia, { carregado: true, mes: m, salvando: false, erro: '' }); mudou(); },
    contas(empresa) {
      if (!contas.has(empresa)) contas.set(empresa, { carregadas: true, contas: {} });
      return contas.get(empresa)!;
    },
    async salvarContas(empresa, c) { contas.set(empresa, { carregadas: true, contas: c }); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
