// Os Insumos da Carteira (12/11/2026): as impressões, as pastas, os envelopes e as caixas que cada pessoa registra, por
// cliente; e, para o Diretor e o Financeiro, os do mês de todos. Interface + a versão de exemplo (memória); a do banco é
// insumos.firestore.ts.
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
  /** cria (sem id) ou altera o registro da pessoa */
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
  const r = (id: string, uid: string, nome: string, dia: string, tipo: carteira.TipoDeInsumo, quantidade: number, cliente: string, codigo: number | null): carteira.Insumo => ({
    id, uid, nome, competencia: mes, data: mes + '-' + dia, tipo, quantidade, cliente, codigo, criadoEm: mes + '-' + dia + 'T10:00:00.000Z',
  });
  let lista: carteira.Insumo[] = [
    r('i1', eu().uid, eu().nome, '03', 'impressao', 48, 'PADARIA EXEMPLO LTDA', 9001),
    r('i2', eu().uid, eu().nome, '03', 'pasta', 2, 'PADARIA EXEMPLO LTDA', 9001),
    r('i3', eu().uid, eu().nome, '05', 'envelope', 6, 'MERCADO EXEMPLO', 9002),
    r('i4', 'uid-clara', 'Clara', '04', 'impressao', 120, 'MERCADO EXEMPLO', 9002),
    r('i5', 'uid-clara', 'Clara', '06', 'caixa', 1, 'OFICINA EXEMPLO', 9003),
    r('i6', 'uid-felipe', 'Felipe', '07', 'impressao', 35, 'PADARIA EXEMPLO LTDA', 9001),
  ];
  const ao = (l: carteira.Insumo[]): ListaAoVivo<carteira.Insumo> => ({ carregada: true, lista: l, erro: '' });
  return {
    exemplos: true,
    meuUid: () => eu().uid,
    meusInsumos: () => ao(lista.filter(x => x.uid === eu().uid).sort(carteira.porDataDoInsumo)),
    insumosDoMes: c => ao(lista.filter(x => x.competencia === c).sort(carteira.porDataDoInsumo)),
    async salvarInsumo(x, id) {
      const campos = { ...x, cliente: x.cliente.trim(), competencia: x.data.slice(0, 7) };
      lista = id ? lista.map(o => (o.id === id ? { ...o, ...campos } : o))
        : [...lista, { ...campos, id: novoId(), uid: eu().uid, nome: eu().nome, criadoEm: new Date().toISOString() }];
      mudou();
    },
    async apagarInsumo(id) { lista = lista.filter(x => x.id !== id); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
