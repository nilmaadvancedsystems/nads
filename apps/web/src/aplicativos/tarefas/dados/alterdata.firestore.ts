// O balancete e o razão do Alterdata no banco do Entregas (04/11/2026), nas regras de lá (o admin e o Contábil):
//   - pedidosAlterdata: o pedido {status: 'pendente', tipo: 'mensal', codigo, empresa, competencia, criadoEm, criadoPor,
//     criadoPorUid} (só essas chaves; o tipo 'balancete' é o da Conferência). O robô escreve o andamento (passos), os
//     arquivos ({balancete|razao: {status, nome, tamanho, partes, erro}}) e, se o mesmo mês já saiu, mesmoQue;
//   - os pedaços dos arquivos em pedidosAlterdata/{id}/partes/{relatorio}-{nnn} ({dados: base64});
//   - robo/alterdata (só leitura): o Contábil de cada máquina do robô (maquinas.{servidor|pc}.contabil).
import { addDoc, collection, doc, getDocs, onSnapshot, query, updateDoc as updateDocBruto, where } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';
import { pedidoAndando, type ArquivoDoAlterdata, type ContabilDoRobo, type PedidoMensalDoAlterdata, type RelatorioDoAlterdata, type RepoAlterdata } from './alterdata';

const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;

type Quem = { nome: string; uid: string } | null;
const texto = (v: unknown) => (v == null ? '' : String(v));

function arquivoDoBanco(v: unknown): ArquivoDoAlterdata | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const a = v as Record<string, unknown>;
  const imp = a.importado && typeof a.importado === 'object' ? a.importado as Record<string, unknown> : null;
  return {
    status: a.status === 'pronto' ? 'pronto' : 'erro', nome: texto(a.nome), tamanho: Number(a.tamanho) || 0, partes: Number(a.partes) || 0, erro: texto(a.erro),
    ...(imp ? { importado: { contas: Number(imp.contas) || 0, ...(imp.lancamentos != null ? { lancamentos: Number(imp.lancamentos) || 0 } : {}), ...(imp.erro ? { erro: texto(imp.erro) } : {}) } } : {}),
  };
}

function andamentoDoBanco(v: unknown): PedidoMensalDoAlterdata['andamento'] {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  return { pct: Math.max(0, Math.min(100, Number(a.pct) || 0)), etapa: texto(a.etapa), clique: texto(a.clique), em: texto(a.em) };
}

function pedidoDoBanco(id: string, d: Record<string, unknown>): PedidoMensalDoAlterdata {
  const arq = (d.arquivos || {}) as Record<string, unknown>;
  const arquivos: PedidoMensalDoAlterdata['arquivos'] = {};
  for (const r of ['balancete', 'razao'] as const) { const a = arquivoDoBanco(arq[r]); if (a) arquivos[r] = a; }
  return {
    id, codigo: Number(d.codigo) || 0, empresa: texto(d.empresa), competencia: texto(d.competencia), status: texto(d.status), erro: texto(d.erro),
    passos: Array.isArray(d.passos) ? (d.passos as Record<string, unknown>[]).map(p => ({ n: Number(p.n) || 0, nome: texto(p.nome), quando: texto(p.quando) })) : [],
    arquivos, andamento: andamentoDoBanco(d.andamento), mesmoQue: texto(d.mesmoQue), criadoEm: texto(d.criadoEm), criadoPor: texto(d.criadoPor), inicioEm: texto(d.inicioEm), fimEm: texto(d.fimEm),
  };
}

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function criarAlterdataFirestore(quem: () => Quem): RepoAlterdata {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const daEmpresa = new Map<number, { carregados: boolean; lista: readonly PedidoMensalDoAlterdata[] }>();
  let fila: { carregada: boolean; ids: readonly string[] } = { carregada: false, ids: [] };
  let ouvindoFila = false;
  let robo: ContabilDoRobo = { carregado: false, maquinas: [] };
  let ouvindoRobo = false;

  return {
    exemplos: false,
    pedidos(codigo) {
      if (!daEmpresa.has(codigo)) {
        daEmpresa.set(codigo, { carregados: false, lista: [] });
        // só igualdades (sem orderBy, que pediria um índice): a ordem aqui
        onSnapshot(query(collection(db, 'pedidosAlterdata'), where('codigo', '==', codigo), where('tipo', '==', 'mensal')), s => {
          const lista = s.docs.map(x => pedidoDoBanco(x.id, x.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
          daEmpresa.set(codigo, { carregados: true, lista });
          mudou();
        }, () => { daEmpresa.set(codigo, { carregados: true, lista: [] }); mudou(); });
      }
      return daEmpresa.get(codigo)!;
    },
    fila() {
      if (!ouvindoFila) {
        ouvindoFila = true;
        onSnapshot(query(collection(db, 'pedidosAlterdata'), where('status', 'in', ['pendente', 'trabalhando'])), s => {
          // a ordem do robô: quem está com ele primeiro, depois a ordem de chegada
          const ids = s.docs.map(x => ({ id: x.id, st: texto(x.data().status), em: texto(x.data().criadoEm) }))
            .sort((a, b) => (a.st === b.st ? a.em.localeCompare(b.em) : a.st === 'trabalhando' ? -1 : 1)).map(x => x.id);
          fila = { carregada: true, ids };
          mudou();
        }, () => { fila = { carregada: true, ids: [] }; mudou(); });
      }
      return fila;
    },
    robo() {
      if (!ouvindoRobo) {
        ouvindoRobo = true;
        onSnapshot(doc(db, 'robo', 'alterdata'), s => {
          const m = ((s.data() || {}).maquinas || {}) as Record<string, Record<string, unknown>>;
          robo = { carregado: true, maquinas: Object.entries(m).map(([onde, x]) => ({ onde, contabil: texto(x.contabil), em: texto(x.em) })) };
          mudou();
        }, () => { robo = { carregado: true, maquinas: [] }; mudou(); });
      }
      return robo;
    },
    async pedir({ codigo, empresa, competencia }) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      // o mesmo mês já na fila não entra de novo (duas pessoas ao mesmo tempo: o robô gera uma vez só)
      const ja = daEmpresa.get(codigo);
      if (ja?.carregados && pedidoAndando(ja.lista, competencia)) return;
      await addDoc(collection(db, 'pedidosAlterdata'), { status: 'pendente', tipo: 'mensal', codigo, empresa: empresa.slice(0, 200), competencia, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
    },
    async cancelar(id) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await updateDoc(doc(db, 'pedidosAlterdata', id), { status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: q.nome });
    },
    async arquivo(p, relatorio: RelatorioDoAlterdata) {
      const a = p.arquivos[relatorio];
      if (!a || a.status !== 'pronto' || !a.partes) return null;
      const id = p.mesmoQue || p.id;
      const s = await getDocs(collection(db, 'pedidosAlterdata', id, 'partes'));
      const pedacos = s.docs.filter(x => x.id.startsWith(relatorio + '-')).sort((x, y) => x.id.localeCompare(y.id)).map(x => texto(x.data().dados));
      if (pedacos.length !== a.partes) throw new Error('faltam pedaços do arquivo (' + pedacos.length + ' de ' + a.partes + ')');
      return { bytes: base64ParaBytes(pedacos.join('')), nome: a.nome };
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
