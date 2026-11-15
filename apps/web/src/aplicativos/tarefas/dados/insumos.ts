// Os Insumos da Carteira (12/11/2026; 15/11/2026: o Financeiro decide quais são e o preço de cada um): os que cada pessoa
// registra, por cliente; para o Diretor e o Financeiro, os do mês de todos; e a lista dos insumos do Financeiro. Interface + a
// versão de exemplo (memória); a do banco é insumos.firestore.ts.
import { carteira } from '@nads/core';
import type { ListaAoVivo } from './agentes';
import type { QuemNaCarteira } from './carteira';

export interface RepoInsumos {
  readonly exemplos: boolean;
  /** quem está (o uid; '' sem login): só os dela abrem para mudar */
  meuUid(): string;
  /** os da pessoa (todos os meses) */
  meusInsumos(): ListaAoVivo<carteira.Insumo>;
  /** os do mês de todos (o Diretor e o Financeiro) */
  insumosDoMes(competencia: string): ListaAoVivo<carteira.Insumo>;
  /**
   * a lista dos insumos do Financeiro: o nome e o preço de cada um (15/11/2026: "o preço do insumo é o financeiro que decide, e
   * quais insumos são"); sem a lista gravada, Impressão, Envelope e Caixa sem preço. comLista: o Financeiro já gravou a dele
   */
  tipos(): ListaAoVivo<carteira.TipoConfigurado> & { comLista: boolean };
  /** o Financeiro grava a lista (os nomes e os preços) */
  salvarTipos(lista: carteira.TipoConfigurado[]): Promise<void>;
  /** cria (sem id) ou altera o registro da pessoa, com o nome e o preço do insumo de hoje */
  salvarInsumo(x: carteira.InsumoParaSalvar, id?: string): Promise<void>;
  apagarInsumo(id: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos: alguns registros de quem está e de mais duas pessoas. */
export function criarInsumosMemoria(quem: QuemNaCarteira): RepoInsumos {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const hoje = new Date();
  const mes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  const eu = () => quem() ?? { uid: 'uid-exemplo', nome: 'Você' };
  let seq = 0;
  const novoId = () => 'i-' + Date.now().toString(36) + '-' + ++seq;
  // a lista do Financeiro de exemplo, com os preços (e um insumo a mais, criado por ele)
  let tipos: carteira.TipoConfigurado[] = [
    { id: 'impressao', nome: 'Impressão', preco: 0.5 },
    { id: 'envelope', nome: 'Envelope', preco: 2 },
    { id: 'caixa', nome: 'Caixa', preco: 8.9 },
    { id: 'pasta-de-elastico', nome: 'Pasta de elástico', preco: 6.5 },
  ];
  const r = (id: string, uid: string, nome: string, dia: string, tipo: carteira.TipoDeInsumo, quantidade: number, cliente: string, codigo: number | null): carteira.Insumo => {
    const t = tipos.find(x => x.id === tipo);
    return { id, uid, nome, competencia: mes, data: mes + '-' + dia, tipo, nomeDoTipo: t?.nome ?? '', preco: t?.preco ?? 0, quantidade, cliente, codigo, criadoEm: mes + '-' + dia + 'T10:00:00.000Z' };
  };
  // os três tipos (impressão, envelope e caixa), de clientes do Cadastro e avulsos (sem código)
  let lista: carteira.Insumo[] = [
    r('i1', eu().uid, eu().nome, '03', 'impressao', 48, 'PADARIA EXEMPLO LTDA', 9001),
    r('i2', eu().uid, eu().nome, '03', 'envelope', 4, 'PADARIA EXEMPLO LTDA', 9001),
    r('i3', eu().uid, eu().nome, '05', 'caixa', 2, 'MERCADO EXEMPLO', 9002),
    r('i4', eu().uid, eu().nome, '06', 'impressao', 15, 'JOÃO DA SILVA (AVULSO)', null),
    r('i5', 'uid-clara', 'Clara', '04', 'impressao', 120, 'MERCADO EXEMPLO', 9002),
    r('i6', 'uid-clara', 'Clara', '06', 'caixa', 1, 'OFICINA EXEMPLO', 9003),
    r('i7', 'uid-felipe', 'Felipe', '07', 'envelope', 10, 'MARIA SOUZA (AVULSO)', null),
    r('i8', 'uid-felipe', 'Felipe', '08', 'pasta-de-elastico', 3, 'PADARIA EXEMPLO LTDA', 9001),
  ];
  const ao = (l: carteira.Insumo[]): ListaAoVivo<carteira.Insumo> => ({ carregada: true, lista: l, erro: '' });
  return {
    exemplos: true,
    meuUid: () => eu().uid,
    meusInsumos: () => ao(lista.filter(x => x.uid === eu().uid).sort(carteira.porDataDoInsumo)),
    insumosDoMes: c => ao(lista.filter(x => x.competencia === c).sort(carteira.porDataDoInsumo)),
    tipos: () => ({ carregada: true, lista: tipos, erro: '', comLista: true }),
    async salvarTipos(lista) { tipos = lista.map(t => ({ ...t, nome: t.nome.trim() })); mudou(); },
    async salvarInsumo(x, id) {
      const campos = { ...carteira.comPreco(x, tipos), cliente: x.cliente.trim(), competencia: x.data.slice(0, 7) };
      lista = id ? lista.map(o => (o.id === id ? { ...o, ...campos } : o))
        : [...lista, { ...campos, id: novoId(), uid: eu().uid, nome: eu().nome, criadoEm: new Date().toISOString() }];
      mudou();
    },
    async apagarInsumo(id) { lista = lista.filter(x => x.id !== id); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
