// A Área do Cliente no banco do Entregas (Vitor, 16/10/2026), como no contrato docs/area-do-cliente/contrato.md:
//   areasCliente/{token}            { codigos, nome, criadoEm, criadoPor, atualizadoEm }  (o escritório grava; revogar = apagar)
//   areasClientePorEmpresa/{codigo} { token, atualizadoEm }                                (para achar o link da empresa)
//   chamados/{id}                   a equipe lê e grava (responder, mudar a situação); o robô cria e espelha para o cliente
//   areaClienteRecebidos/{id}       a equipe lê; só o robô grava
// O cliente nunca lê estas coleções: só o espelho por token, que o robô grava.
import { arrayUnion, collection, deleteDoc as deleteDocBruto, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc as setDocBruto, updateDoc as updateDocBruto, type Query } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { maisRecente, novoToken, SITUACOES_DO_CHAMADO, type ChamadoNaEquipe, type LinkDaEmpresa, type ListaAoVivo, type MensagemNaEquipe, type RecebidoDoCliente, type RepoAreaCliente } from './areaCliente';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const codigos = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
/** o instante do banco como ISO (o Timestamp do Firestore, ou o texto que o robô gravou) */
const instante = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') return ((v as { toDate: () => Date }).toDate()).toISOString();
  return '';
};

const TIPOS_DE_CHAMADO = ['admissao', 'ferias', 'demissao', 'duvida', 'documento', 'outro'] as const;
const TIPOS_DE_ENVIO = ['extrato', 'nota', 'comprovante', 'outro'] as const;
const dentro = <T extends string>(lista: readonly T[], v: unknown, padrao: T): T => (lista.includes(v as T) ? (v as T) : padrao);

function mensagem(x: unknown): MensagemNaEquipe | null {
  if (!x || typeof x !== 'object') return null;
  const m = x as Record<string, unknown>;
  if (!texto(m.texto)) return null;
  return { de: m.de === 'cliente' ? 'cliente' : 'escritorio', autor: texto(m.autor), texto: texto(m.texto), em: instante(m.em) };
}

export function criarAreaClienteFirestore(quem: () => string): RepoAreaCliente {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  /** Uma coleção ao vivo, que só começa a ouvir quando alguém pede (e conta o erro da regra, em vez de esconder). */
  function aoVivo<T>(consulta: () => Query, ler: (id: string, x: Record<string, unknown>) => T | null, ordem?: (a: T, b: T) => number) {
    let estado: ListaAoVivo<T> = { carregada: false, lista: [], erro: '' };
    let ouvindo = false;
    return () => {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(consulta(), s => {
          const lista = s.docs.map(d => ler(d.id, d.data())).filter((x): x is T => x != null);
          estado = { carregada: true, lista: ordem ? lista.sort(ordem) : lista, erro: '' };
          mudou();
        }, e => { estado = { carregada: true, lista: [], erro: e.message }; mudou(); });
      }
      return estado;
    };
  }

  const links = aoVivo<LinkDaEmpresa>(() => collection(db, 'areasClientePorEmpresa'), (id, x) => {
    const codigo = Number(id);
    const token = texto(x.token);
    return Number.isFinite(codigo) && token ? { codigo, token, atualizadoEm: instante(x.atualizadoEm) } : null;
  });

  const chamados = aoVivo<ChamadoNaEquipe>(() => query(collection(db, 'chamados'), orderBy('atualizadoEm', 'desc'), limit(400)), (id, x) => ({
    id, token: texto(x.token), codigos: codigos(x.codigos), empresa: texto(x.empresa),
    tipo: dentro(TIPOS_DE_CHAMADO, x.tipo, 'outro'), titulo: texto(x.titulo), situacao: dentro(SITUACOES_DO_CHAMADO, x.situacao, 'aberto'),
    mensagens: (Array.isArray(x.mensagens) ? x.mensagens : []).map(mensagem).filter((m): m is MensagemNaEquipe => m != null),
    criadoEm: instante(x.criadoEm), atualizadoEm: instante(x.atualizadoEm),
  }), maisRecente);

  const recebidos = aoVivo<RecebidoDoCliente>(() => query(collection(db, 'areaClienteRecebidos'), orderBy('recebidoEm', 'desc'), limit(400)), (id, x) => ({
    id, token: texto(x.token), codigo: numero(x.codigo), empresa: texto(x.empresa), nome: texto(x.nome),
    tipo: dentro(TIPOS_DE_ENVIO, x.tipo, 'outro'), tamanho: numero(x.tamanho), pastaDrive: texto(x.pastaDrive), recebidoEm: instante(x.recebidoEm),
  }));

  /** Grava o token novo para as empresas do link: primeiro o link, depois os ponteiros (o ponteiro nunca aponta para nada). */
  async function criar(token: string, cods: number[], nome: string, criadoPor: string, criadoEm: string): Promise<void> {
    const agora = new Date().toISOString();
    // as regras aceitam só estas 5 chaves (codigos de 1 a 50, nome até 200); o cliente lê este doc: criadoPor é o NOME, nunca o e-mail
    await setDoc(doc(db, 'areasCliente', token), { codigos: cods.slice(0, 50), nome: nome.slice(0, 200), criadoEm, criadoPor: criadoPor || 'Escritório', atualizadoEm: agora });
    for (const c of cods) await setDoc(doc(db, 'areasClientePorEmpresa', String(c)), { token, atualizadoEm: agora });
  }

  return {
    exemplos: false,
    links, chamados, recebidos,
    async gerar(e) {
      const ponteiro = await getDoc(doc(db, 'areasClientePorEmpresa', String(e.codigo)));
      const existente = texto(ponteiro.data()?.token);
      if (existente) return { codigo: e.codigo, token: existente, atualizadoEm: instante(ponteiro.data()?.atualizadoEm) };
      const token = novoToken();
      const agora = new Date().toISOString();
      await criar(token, [e.codigo], e.nome, quem(), agora);
      return { codigo: e.codigo, token, atualizadoEm: agora };
    },
    async trocar(e) {
      const ponteiro = await getDoc(doc(db, 'areasClientePorEmpresa', String(e.codigo)));
      const antigo = texto(ponteiro.data()?.token);
      // o link novo herda as empresas e o nome do antigo (um link pode cobrir um grupo de empresas)
      const velho = antigo ? (await getDoc(doc(db, 'areasCliente', antigo))).data() : undefined;
      const cods = codigos(velho?.codigos);
      const token = novoToken();
      const agora = new Date().toISOString();
      await criar(token, cods.length ? cods : [e.codigo], texto(velho?.nome) || e.nome, quem(), instante(velho?.criadoEm) || agora);
      if (antigo) await deleteDoc(doc(db, 'areasCliente', antigo));
      return { codigo: e.codigo, token, atualizadoEm: agora };
    },
    async revogar(codigo) {
      const ponteiro = await getDoc(doc(db, 'areasClientePorEmpresa', String(codigo)));
      const token = texto(ponteiro.data()?.token);
      if (!token) return;
      const velho = (await getDoc(doc(db, 'areasCliente', token))).data();
      // o doc do token primeiro: sem ele, o cliente já não lê o espelho
      await deleteDoc(doc(db, 'areasCliente', token));
      for (const c of new Set([codigo, ...codigos(velho?.codigos)])) await deleteDoc(doc(db, 'areasClientePorEmpresa', String(c)));
    },
    async responder(id, resposta) {
      const agora = new Date().toISOString();
      // arrayUnion: se o robô acrescentou uma mensagem do cliente no meio-tempo, a resposta não a apaga
      await updateDoc(doc(db, 'chamados', id), { mensagens: arrayUnion({ de: 'escritorio', autor: quem() || 'Escritório', texto: resposta, em: agora }), situacao: 'respondido', atualizadoEm: agora });
    },
    async mudarSituacao(id, situacao) {
      await updateDoc(doc(db, 'chamados', id), { situacao, atualizadoEm: new Date().toISOString() });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
