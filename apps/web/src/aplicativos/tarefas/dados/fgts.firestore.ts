// O FGTS Digital no banco do Entregas (07/10/2026), nas regras de lá (o admin e o DP):
//   - robo/fgts (só leitura): o robô ligado (com o certificado do escritório) ou o motivo, e de quem é o certificado;
//   - pedidosFgts: o pedido {status: 'pendente', modo, cnpj, codigo, empresa, competencia, criadoEm, criadoPor,
//     criadoPorUid} (só essas chaves); o robô escreve o andamento (passos), o resultado ou o erro no próprio pedido,
//     o PDF em pedidosFgts/{id}/arquivo/pdf e as fotos das telas em pedidosFgts/{id}/telas.
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, updateDoc as updateDocBruto, where } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';

const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
import { bancoDoEntregas } from './entregas.firestore';
import type { ModoFgts, PedidoFgts, RepoFgts, RoboFgts } from './fgts';
// a verificação do gov.br (08/10/2026): pedidosFgts/{id}/ao-vivo/tela (o robô escreve) e pedidosFgts/{id}/cliques
// ({x, y, em, por}: o DP ou o admin cria; o robô repete no navegador e apaga)

type Quem = { nome: string; uid: string } | null;
const texto = (v: unknown) => (v == null ? '' : String(v));

function pedidoDoBanco(id: string, d: Record<string, unknown>): PedidoFgts {
  return {
    id, cnpj: texto(d.cnpj), codigo: texto(d.codigo), empresa: texto(d.empresa), competencia: texto(d.competencia),
    modo: (d.modo === 'emitir' ? 'emitir' : 'ensaio') as ModoFgts, status: texto(d.status), erro: texto(d.erro),
    resultado: texto(d.resultado), pdfNome: texto(d.pdfNome), numeroGuia: texto(d.numeroGuia), valor: texto(d.valor), vencimento: texto(d.vencimento), criadoEm: texto(d.criadoEm), criadoPor: texto(d.criadoPor), fimEm: texto(d.fimEm),
    passos: Array.isArray(d.passos) ? (d.passos as Record<string, unknown>[]).map(p => ({ n: Number(p.n) || 0, nome: texto(p.nome), url: texto(p.url), texto: texto(p.texto), quando: texto(p.quando) })) : [],
  };
}

export function criarFgtsFirestore(quem: () => Quem): RepoFgts {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let robo: RoboFgts = { carregado: false, ligado: false, motivo: '', certificado: null };
  let ouvindoRobo = false;
  const doMes = new Map<string, { carregados: boolean; porCnpj: ReadonlyMap<string, PedidoFgts> }>();

  return {
    exemplos: false,
    robo() {
      if (!ouvindoRobo) {
        ouvindoRobo = true;
        onSnapshot(doc(db, 'robo', 'fgts'), s => {
          const d = s.data() || {};
          const c = d.certificado as Record<string, unknown> | null | undefined;
          robo = { carregado: true, ligado: !!d.ligado, motivo: s.exists() ? texto(d.motivo) : 'o robô ainda não ligou o FGTS', certificado: c ? { titular: texto(c.titular), validade: texto(c.validade) } : null };
          mudou();
        }, () => { robo = { carregado: true, ligado: false, motivo: 'sem acesso', certificado: null }; mudou(); });
      }
      return robo;
    },
    pedidos(competencia) {
      if (!doMes.has(competencia)) {
        doMes.set(competencia, { carregados: false, porCnpj: new Map() });
        // só igualdade (sem orderBy, que pediria um índice): o mais novo de cada CNPJ escolhido aqui
        onSnapshot(query(collection(db, 'pedidosFgts'), where('competencia', '==', competencia)), s => {
          const todos = s.docs.map(x => pedidoDoBanco(x.id, x.data())).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
          const porCnpj = new Map<string, PedidoFgts>();
          for (const p of todos) porCnpj.set(p.cnpj, p);
          doMes.set(competencia, { carregados: true, porCnpj });
          mudou();
        }, () => { doMes.set(competencia, { carregados: true, porCnpj: new Map() }); mudou(); });
      }
      return doMes.get(competencia)!;
    },
    async pedir({ cnpj, codigo, empresa, competencia, modo }) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await addDoc(collection(db, 'pedidosFgts'), { status: 'pendente', modo, cnpj, codigo: String(codigo), empresa, competencia, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
    },
    async cancelar(id) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await updateDoc(doc(db, 'pedidosFgts', id), { status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: q.nome });
    },
    async pdf(id) {
      const s = await getDoc(doc(db, 'pedidosFgts', id, 'arquivo', 'pdf'));
      const d = s.data();
      return d ? { base64: texto(d.base64), nome: texto(d.nome) } : null;
    },
    async telas(id) {
      const s = await getDocs(collection(db, 'pedidosFgts', id, 'telas'));
      return s.docs.map(x => ({ n: x.id, nome: texto(x.data().nome), imagem: texto(x.data().imagem) })).sort((a, b) => a.n.localeCompare(b.n));
    },
    aoVivo(id, chegou) {
      return onSnapshot(doc(db, 'pedidosFgts', id, 'ao-vivo', 'tela'), s => {
        const d = s.data();
        chegou(d ? { imagem: texto(d.imagem), largura: Number(d.largura) || 1280, altura: Number(d.altura) || 900, quando: texto(d.quando) } : null);
      }, () => chegou(null));
    },
    async clicar(id, x, y) {
      await addDoc(collection(db, 'pedidosFgts', id, 'cliques'), { x: Math.round(x), y: Math.round(y), em: new Date().toISOString(), por: quem()?.nome || '' });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
