// O que os aplicativos pedem e gravam do cadastro. A tela nunca sabe onde o dado mora.
// A lógica (carregar só a empresa pedida, nunca gravar antes de ela chegar, gravar só o que mudou) fica aqui,
// uma vez só; quem fala com o banco é a "porta": no site, os dados/cadastro.firestore.ts de cada aplicativo
// (a Tarefas e o Extratudo); nos exemplos, a porta em memória (repo.memoria.ts).
import { slug } from '../../formatos';
import { cadastroDoDocumento, cadastroVazio, documentoDoCadastro, planoDoDocumento } from './regras';
import type { CadastroDaEmpresa, PlanoDeContas } from './tipos';

type Doc = Record<string, unknown> | null;

/** Quem fala com o banco (ou com o navegador, nos exemplos). id = slug(nome da empresa). */
export interface PortaCadastro {
  /** ouve o cadastro da empresa; devolve como parar */
  ouvirCadastro(id: string, aoChegar: (doc: Doc) => void, aoFalhar: (err: Error) => void): () => void;
  /** ouve o plano de contas da empresa */
  ouvirPlano(id: string, aoChegar: (doc: Doc) => void, aoFalhar: (err: Error) => void): () => void;
  /** grava o cadastro e, se vier, o plano (juntos, num lote) */
  gravar(id: string, cadastro: Record<string, unknown>, plano?: Record<string, unknown>): Promise<void>;
}

export interface RepoCadastro {
  /** true = dados de exemplo */
  readonly exemplos: boolean;
  /** o cadastro da empresa, ao vivo. Pedir já começa a ouvir. */
  cadastro(nome: string, codigo: number | null): CadastroDaEmpresa;
  plano(nome: string): PlanoDeContas | null;
  /** o cadastro quando chegar do banco (para quem precisa dele uma vez, como o check automático da Tarefas) */
  obter(nome: string, codigo: number | null): Promise<CadastroDaEmpresa>;
  /** o cadastro e o plano já chegaram? (antes disso, nada é gravado) */
  carregada(nome: string): boolean;
  salvar(nome: string, c: CadastroDaEmpresa): void;
  /** troca o plano (e grava o cadastro junto, com o registro no histórico) */
  salvarPlano(nome: string, p: PlanoDeContas, c: CadastroDaEmpresa): void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
  /** quem mostra os erros do banco (o toast da tela) */
  definirAviso(fn: (mensagem: string) => void): void;
}

interface Carga {
  codigo: number | null;
  cadastro: CadastroDaEmpresa;
  cadastroChegou: boolean;
  plano: PlanoDeContas | null;
  planoChegou: boolean;
}

export function criarRepoCadastro(porta: PortaCadastro, exemplos: boolean): RepoCadastro {
  const cargas = new Map<string, Carga>();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let avisar = (m: string) => console.warn(m);
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  function carregar(nome: string, codigo: number | null = null): Carga {
    const pronta = cargas.get(nome);
    if (pronta) {
      if (pronta.codigo == null && codigo != null) pronta.codigo = codigo;
      return pronta;
    }
    const c: Carga = { codigo, cadastro: cadastroVazio(nome, codigo), cadastroChegou: false, plano: null, planoChegou: false };
    cargas.set(nome, c);
    const id = slug(nome);
    const falhou = (err: Error) => avisar('Não consegui ler o cadastro de "' + nome + '" na nuvem: ' + err.message);
    porta.ouvirCadastro(id, doc => {
      c.cadastro = cadastroDoDocumento(nome, c.codigo, doc);
      c.cadastroChegou = true;
      mudou();
    }, falhou);
    porta.ouvirPlano(id, doc => {
      c.plano = planoDoDocumento(doc);
      c.planoChegou = true;
      mudou();
    }, falhou);
    return c;
  }

  const chegou = (c: Carga) => c.cadastroChegou && c.planoChegou;

  function gravar(nome: string, c: CadastroDaEmpresa, p?: PlanoDeContas) {
    const carga = carregar(nome);
    if (!chegou(carga)) return; // antes de a empresa chegar do banco, nunca grava
    carga.cadastro = { ...c, codigo: c.codigo ?? carga.codigo };
    if (p) carga.plano = p;
    mudou(); // a tela já vê a mudança; o banco confirma pelo ouvinte
    porta.gravar(slug(nome), documentoDoCadastro(carga.cadastro), p ? { ...p } : undefined)
      .catch((err: Error) => avisar('Não deu para salvar o cadastro de "' + nome + '" na nuvem: ' + err.message));
  }

  return {
    exemplos,
    cadastro: (nome, codigo) => carregar(nome, codigo).cadastro,
    plano: nome => carregar(nome).plano,
    obter(nome, codigo) {
      const c = carregar(nome, codigo);
      if (chegou(c)) return Promise.resolve(c.cadastro);
      return new Promise(resolver => {
        const f = () => { if (chegou(c)) { ouvintes.delete(f); resolver(c.cadastro); } };
        ouvintes.add(f);
      });
    },
    carregada: nome => chegou(carregar(nome)),
    salvar: (nome, c) => gravar(nome, c),
    salvarPlano: (nome, p, c) => gravar(nome, c, p),
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
    definirAviso(fn) { avisar = fn; },
  };
}
