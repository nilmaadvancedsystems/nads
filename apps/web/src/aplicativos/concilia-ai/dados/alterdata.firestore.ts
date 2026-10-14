// O balancete do Alterdata no banco do Entregas (14/10/2026), nas regras de lá (o contábil e o admin):
//   - robo/alterdata (só leitura): o robô do PC ligado ({ligado, onde, atualizadoEm});
//   - pedidosAlterdata: o pedido {status: 'pendente', tipo: 'balancete', codigo, empresa, competencia, criadoEm, criadoPor,
//     criadoPorUid} (só essas chaves); o robô escreve o andamento (passos), o erro ou o fim no próprio pedido e o .xlsx em
//     pedidosAlterdata/{id}/arquivo/xlsx. Cancelar = status 'cancelado' (+ canceladoEm, canceladoPor) enquanto pendente/trabalhando.
import { addDoc as addDocBruto, collection, doc, getDoc, onSnapshot, updateDoc as updateDocBruto } from 'firebase/firestore';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from '../../tarefas/dados/entregas.firestore';
import type { PedidoAlterdata, QuemPedeAlterdata, RepoAlterdata, RoboAlterdata } from './alterdata';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): o pedido ao robô é recusado e o cancelamento só finge
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;

const texto = (v: unknown) => (v == null ? '' : String(v));

function pedidoDoBanco(id: string, d: Record<string, unknown>): PedidoAlterdata {
  return {
    id, codigo: Number(d.codigo) || 0, empresa: texto(d.empresa), competencia: texto(d.competencia), status: texto(d.status), erro: texto(d.erro),
    arquivoNome: texto(d.arquivoNome), criadoEm: texto(d.criadoEm), criadoPor: texto(d.criadoPor), fimEm: texto(d.fimEm),
    passos: Array.isArray(d.passos) ? (d.passos as Record<string, unknown>[]).map(p => ({ n: Number(p.n) || 0, nome: texto(p.nome), quando: texto(p.quando) })) : [],
  };
}

export function criarAlterdataFirestore(quem: () => QuemPedeAlterdata | null): RepoAlterdata {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let robo: RoboAlterdata = { carregado: false, ligado: false, onde: '' };
  let ouvindoRobo = false;

  return {
    exemplos: false,
    podePedir: () => quem()?.podePedir ?? false,
    robo() {
      if (!ouvindoRobo) {
        ouvindoRobo = true;
        onSnapshot(doc(db, 'robo', 'alterdata'), s => {
          const d = s.data() || {};
          robo = { carregado: true, ligado: s.exists() && !!d.ligado, onde: texto(d.onde) };
          mudou();
        }, () => { robo = { carregado: true, ligado: false, onde: '' }; mudou(); });
      }
      return robo;
    },
    async pedir({ codigo, empresa, competencia }) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      const ref = await addDoc(collection(db, 'pedidosAlterdata'), { status: 'pendente', tipo: 'balancete', codigo: Math.trunc(codigo), empresa, competencia, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
      return ref.id;
    },
    ouvir(id, aoMudar) {
      return onSnapshot(doc(db, 'pedidosAlterdata', id), s => aoMudar(s.exists() ? pedidoDoBanco(s.id, s.data()) : null), () => aoMudar(null));
    },
    async arquivo(id) {
      const s = await getDoc(doc(db, 'pedidosAlterdata', id, 'arquivo', 'xlsx'));
      const d = s.data();
      return d ? { base64: texto(d.base64), nome: texto(d.nome) } : null;
    },
    async cancelar(id) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await updateDoc(doc(db, 'pedidosAlterdata', id), { status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: q.nome });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
