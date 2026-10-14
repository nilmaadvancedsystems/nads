// O painel dos agentes do Claude Code no banco do Entregas, por computador (14/10/2026): painelMaquinas (os computadores
// cadastrados; o id do documento é a chave secreta) e painelMaquinas/{chave}/sessoes (o resumo vivo de cada conversa,
// que o gancho registro.js do computador grava). Só o admin lê e grava os computadores; as conversas, só lê (a regra).
// Ao vivo: os computadores e, de cada computador ativo, as 30 conversas mais recentes das últimas 24 h.
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where, type Unsubscribe } from 'firebase/firestore';
import { chaveNova, pastaDe, type AgenteNoPainel, type ListaAoVivo, type MaquinaDoPainel, type RepoAgentes, type SessaoDeAgentes } from './agentes';
import { bancoDoEntregas } from './entregas.firestore';

const texto = (v: unknown) => (v == null ? '' : String(v));
const COLECAO = 'painelMaquinas';

function lerAgora(x: unknown): AgenteNoPainel['agora'] {
  const a = x as Record<string, unknown> | null | undefined;
  return a && typeof a === 'object' ? { fer: texto(a.ferramenta), txt: texto(a.texto), ts: texto(a.ts) } : null;
}

function lerSessao(maquina: string, id: string, x: Record<string, unknown>): SessaoDeAgentes {
  const subs = (Array.isArray(x.agentes) ? (x.agentes as Record<string, unknown>[]) : []).map((a, i): AgenteNoPainel => ({
    chave: 'sub-' + i, tipo: texto(a.tipo) || 'subagente', modelo: texto(a.modelo), status: texto(a.status) || 'parado', msg: '', agora: lerAgora(a.agora), hist: [],
  }));
  const status = texto(x.status) || 'parado';
  return {
    sessao: id, maquina, titulo: texto(x.titulo), cwd: texto(x.cwd), projeto: pastaDe(texto(x.cwd)), status, nivel: texto(x.nivel),
    modelo: texto(x.modelo), pedido: texto(x.pedido), aviso: texto(x.aviso), ultimo: texto(x.ultimo), maisAgentes: 0,
    agentes: [{ chave: 'principal', tipo: 'principal', modelo: '', status: 'parado', msg: '', agora: lerAgora(x.agora), hist: [] }, ...subs],
  };
}

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Só o admin vê o painel dos agentes.' : err.message);

export function criarAgentesFirestore(): RepoAgentes {
  let maquinas: ListaAoVivo<MaquinaDoPainel> | null = null;
  // as conversas de cada computador ativo: o ouvinte e o que chegou
  const porMaquina = new Map<string, { parar: Unsubscribe; carregada: boolean; lista: SessaoDeAgentes[]; erro: string }>();
  let sessoes: ListaAoVivo<SessaoDeAgentes> = { carregada: false, lista: [], erro: '' };
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  function juntar() {
    const partes = [...porMaquina.values()];
    sessoes = {
      carregada: !!maquinas?.carregada && partes.every(p => p.carregada),
      lista: partes.flatMap(p => p.lista).sort((a, b) => b.ultimo.localeCompare(a.ultimo)),
      erro: maquinas?.erro || partes.find(p => p.erro)?.erro || '',
    };
    mudou();
  }

  /** Liga o ouvinte das conversas de cada computador ativo e desliga o dos que saíram ou foram desativados. */
  function sincronizar(lista: MaquinaDoPainel[]) {
    const ativas = new Set(lista.filter(m => m.ativo).map(m => m.chave));
    for (const [chave, p] of porMaquina) if (!ativas.has(chave)) { p.parar(); porMaquina.delete(chave); }
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    for (const chave of ativas) {
      if (porMaquina.has(chave)) continue;
      const parte = { parar: (() => {}) as Unsubscribe, carregada: false, lista: [] as SessaoDeAgentes[], erro: '' };
      porMaquina.set(chave, parte);
      parte.parar = onSnapshot(query(collection(bancoDoEntregas(), COLECAO, chave, 'sessoes'), where('ultimo', '>=', desde), orderBy('ultimo', 'desc'), limit(30)), s => {
        parte.carregada = true; parte.erro = '';
        parte.lista = s.docs.map(d => lerSessao(chave, d.id, d.data()));
        juntar();
      }, err => { parte.carregada = true; parte.erro = erroDe(err); juntar(); });
    }
    juntar();
  }

  function iniciar() {
    if (maquinas) return;
    maquinas = { carregada: false, lista: [], erro: '' };
    onSnapshot(collection(bancoDoEntregas(), COLECAO), s => {
      const lista = s.docs.map((d): MaquinaDoPainel => {
        const x = d.data();
        return { chave: d.id, nome: texto(x.nome) || 'Sem nome', ativo: x.ativo !== false, criadoEm: texto(x.criadoEm), criadoPor: texto(x.criadoPor) };
      }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      maquinas = { carregada: true, lista, erro: '' };
      sincronizar(lista);
    }, err => { maquinas = { carregada: true, lista: [], erro: erroDe(err) }; juntar(); });
  }

  return {
    exemplos: false,
    maquinas() { iniciar(); return maquinas!; },
    sessoes() { iniciar(); return sessoes; },
    async cadastrar(nome, quem) {
      const chave = chaveNova();
      await setDoc(doc(bancoDoEntregas(), COLECAO, chave), { nome, ativo: true, criadoEm: new Date().toISOString(), criadoPor: quem });
      return chave;
    },
    async renomear(chave, nome) { await updateDoc(doc(bancoDoEntregas(), COLECAO, chave), { nome }); },
    async ativar(chave, ativo) { await updateDoc(doc(bancoDoEntregas(), COLECAO, chave), { ativo }); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
