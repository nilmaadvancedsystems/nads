// A entrega de documentos aos clientes no nads (16/10/2026: "quero integrar no app … o entregas, só que preciso que fique
// tudo no visual igual"; "quero só a parte de entregas"): a rota (as paradas), o painel do mês, registrar, confirmar e
// tirar da rota, nos MESMOS documentos do Entregas (entregas, entregas/{id}/anexos/comprovante, clientes,
// config/rotaPadrao), que a página antiga continua usando junto. As regras puras ficam no core (entregas/documentos.ts).
// Interface + a versão de exemplo; a do banco é entregasDeDocumentos.firestore.ts.
import { entregas } from '@nads/core';
import type { ListaAoVivo } from './agentes';

export interface ComprovanteDaEntrega { assinatura: string; foto: string }

export interface RepoEntregasDeDocumentos {
  readonly exemplos: boolean;
  /** quem está: o e-mail da conta (as regras do banco conferem o entregadoPor com o login) e o nome */
  quem(): entregas.QuemEntrega | null;
  /** os clientes do cadastro do Entregas (ao vivo) */
  clientes(): ListaAoVivo<entregas.ClienteDaRota>;
  /** a ordem fixa da rota do escritório (config/rotaPadrao; uma leitura) */
  rotaPadrao(): entregas.RotaPadrao;
  /** as paradas na rota (status 'pendente'), ao vivo */
  naRota(): ListaAoVivo<entregas.Entrega>;
  /** as entregas da competência, ao vivo (uma competência por vez) */
  doMes(competencia: string): ListaAoVivo<entregas.Entrega>;
  /** todas as entregas do cliente (o histórico; uma leitura) */
  doCliente(clienteId: string): Promise<entregas.Entrega[]>;
  /** a assinatura e a foto da entrega (entregas/{id}/anexos/comprovante) */
  comprovante(entregaId: string): Promise<ComprovanteDaEntrega>;
  /** põe na rota (status 'pendente'); devolve o id */
  registrar(n: entregas.EntregaNova): Promise<string>;
  /** confirma (ou registra como não entregue) uma ou mais paradas, com o mesmo comprovante */
  confirmar(lista: readonly entregas.Entrega[], c: entregas.Confirmacao): Promise<void>;
  /** de volta à rota depois de não entregue (a tentativa seguinte) */
  novaTentativa(lista: readonly entregas.Entrega[], motivo: string): Promise<void>;
  /** a nova ordem da rota (o ordemRota de cada parada, na ordem dos ids) */
  reordenar(ids: readonly string[]): Promise<void>;
  /** tira da rota / exclui (com o comprovante e as guias anexadas) */
  excluir(e: entregas.Entrega): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Uma assinatura de exemplo (um rabisco). */
const ASSINATURA_EXEMPLO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120"><rect width="360" height="120" fill="#fff"/>'
  + '<path d="M30 80 C60 20 80 110 110 60 S150 30 170 75 S220 100 240 50 S300 40 330 70" fill="none" stroke="#16211E" stroke-width="2.2" stroke-linecap="round"/></svg>');

/** Nos exemplos: seis clientes fictícios, algumas paradas na rota e entregas do mês (nada sai deste navegador). */
export function criarEntregasDeDocumentosMemoria(): RepoEntregasDeDocumentos {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const quem: entregas.QuemEntrega = { email: 'exemplo@nilma.local', nome: 'Pessoa de exemplo' };
  const clientes: entregas.ClienteDaRota[] = [
    ['c1', 'ALFA COMERCIO EXEMPLO LTDA', '101', '11.222.333/0001-81', 'central', ''],
    ['c2', 'BETA SERVICOS EXEMPLO ME', '102', '22.333.444/0001-90', 'superior', 'predio-1'],
    ['c3', 'GAMA EXEMPLO TRANSPORTES', '103', '33.444.555/0001-02', 'superior', 'predio-1'],
    ['c4', 'DELTA EXEMPLO PADARIA', '104', '44.555.666/0001-13', 'inferior', ''],
    ['c5', 'EPSILON EXEMPLO FARMACIA', '105', '55.666.777/0001-24', 'central', ''],
    ['c6', 'ZETA EXEMPLO CONSTRUCOES', '106', '66.777.888/0001-35', '', ''],
  ].map(([id, nome, cod, doc, zona, grupo]) => ({ id, nome, codigoOrigem: cod, documento: doc, telefone: '(38) 99999-0000', ativo: true, entrega: id !== 'c6', zona, grupoLocal: grupo }));
  const hoje = new Date();
  const mes = (k: number) => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const iso = (horas: number) => new Date(hoje.getTime() - horas * 3600e3).toISOString();
  const rotulo = (id: string) => entregas.rotuloDoCliente(clientes.find(c => c.id === id) as entregas.ClienteDaRota);
  const base = (id: string, cli: string, d: Record<string, unknown>) => entregas.entregaDoDocumento(id, {
    clienteId: cli, clienteNome: rotulo(cli), competencia: mes(1), entregadoPor: quem.email, entregadoPorNome: 'Maria (exemplo)', ...d,
  });
  let lista: entregas.Entrega[] = [
    base('e1', 'c1', { status: 'confirmada', itens: [{ tipo: 'DAS', valor: 480.9 }, { tipo: 'FGTS', valor: 210 }], recebedor: 'João (exemplo)', temAssinatura: true, criadoEm: iso(50), confirmadoEm: iso(30) }),
    base('e2', 'c2', { status: 'pendente', itens: [{ tipo: 'DARF', valor: 132.5 }], zona: 'superior', criadoEm: iso(5) }),
    base('e3', 'c3', { status: 'pendente', itens: [{ tipo: 'Honorário', valor: null }], zona: 'superior', criadoEm: iso(4) }),
    base('e4', 'c4', { status: 'falha', itens: [{ tipo: 'DAS', valor: 95.3 }], motivoFalha: 'Estabelecimento fechado', temFoto: true, criadoEm: iso(28), confirmadoEm: iso(26) }),
    base('e5', 'c4', { status: 'pendente', itens: [{ tipo: 'DAS', valor: 95.3 }], zona: 'inferior', tentativa: 2, motivoTentativaAnterior: 'Estabelecimento fechado', criadoEm: iso(3) }),
    base('e6', 'c1', { status: 'confirmada', competencia: mes(2), itens: [{ tipo: 'DAS', valor: 455.1 }], recebedor: 'João (exemplo)', temAssinatura: true, criadoEm: iso(800), confirmadoEm: iso(790) }),
  ];
  const comprovantes = new Map<string, ComprovanteDaEntrega>([['e1', { assinatura: ASSINATURA_EXEMPLO, foto: '' }], ['e6', { assinatura: ASSINATURA_EXEMPLO, foto: '' }]]);
  const viva = <T,>(l: T[]): ListaAoVivo<T> => ({ carregada: true, lista: l, erro: '' });
  return {
    exemplos: true,
    quem: () => quem,
    clientes: () => viva(clientes),
    rotaPadrao: () => ({ zonas: { c4: 'inferior' }, ordem: { c4: 1 } }),
    naRota: () => viva(lista.filter(e => e.status === 'pendente')),
    doMes: competencia => viva(lista.filter(e => e.competencia === competencia)),
    async doCliente(id) { return lista.filter(e => e.clienteId === id); },
    async comprovante(id) { return comprovantes.get(id) || { assinatura: '', foto: '' }; },
    async registrar(n) {
      const id = 'ex-' + Date.now();
      lista = [...lista, entregas.entregaDoDocumento(id, entregas.dadosDaEntregaNova(n, quem, new Date().toISOString()))];
      if (n.foto) comprovantes.set(id, { assinatura: '', foto: n.foto });
      mudou();
      return id;
    },
    async confirmar(paradas, c) {
      const agora = new Date().toISOString();
      const ids = new Set(paradas.map(p => p.id));
      lista = lista.map(e => (ids.has(e.id) ? entregas.entregaDoDocumento(e.id, { ...e, ...entregas.dadosDaConfirmacao(e, c, quem, agora) }) : e));
      const comp = entregas.comprovanteDaConfirmacao(c);
      if (comp) for (const id of ids) comprovantes.set(id, { assinatura: '', foto: '', ...comprovantes.get(id), ...comp });
      mudou();
    },
    async novaTentativa(paradas, motivo) {
      const agora = new Date().toISOString();
      lista = [...lista, ...paradas.map((e, k) => entregas.entregaDoDocumento('ex-' + Date.now() + '-' + k, entregas.dadosDaNovaTentativa(e, motivo, quem, agora)))];
      mudou();
    },
    async reordenar(ids) {
      lista = lista.map(e => (ids.includes(e.id) ? { ...e, ordemRota: ids.indexOf(e.id) } : e));
      mudou();
    },
    async excluir(e) { lista = lista.filter(x => x.id !== e.id); comprovantes.delete(e.id); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
