// O SIEG no banco do Entregas (06/10/2026), nas regras de lá (admin, fiscal e contábil leem; pede o fiscal ou o admin):
//   - siegContagens/{codigo}_{AAAA-MM} e siegSaidas/{codigo}_{AAAA-MM} (só leitura): o robô do PC grava;
//   - pedidosSieg: o pedido {status: 'pendente', codigo, competencia, criadoEm, criadoPor, criadoPorUid} (só essas
//     chaves); o robô escreve o andamento, o concluído ou o erro no próprio pedido;
//   - robo/sieg (só leitura): o robô ligado (com as credenciais) e o ponto.
import { tarefas as t } from '@nads/core';
import { addDoc, collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { PedidoSieg, RepoSieg } from './sieg';

type Quem = { nome: string; uid: string } | null;
const texto = (v: unknown) => (v == null ? '' : String(v));
const soDigitos = (v: unknown) => texto(v).replace(/\D/g, '');

export function criarSiegFirestore(quem: () => Quem): RepoSieg {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let robo = { carregado: false, ligado: false, motivo: '', em: '' };
  let ouvindoRobo = false;
  const contagens = new Map<string, { carregada: boolean; dados: t.sieg.ContagemSieg | null }>();
  const saidas = new Map<string, { carregadas: boolean; dados: t.sieg.SaidasSieg | null }>();
  const notas = new Map<string, { carregadas: boolean; dados: t.sieg.NotasSieg | null }>();
  const pedidos = new Map<string, PedidoSieg | null>();

  const tipos = (r: unknown) => {
    const x = (r || {}) as Record<string, unknown>;
    return { NFe: Number(x.NFe) || 0, NFCe: Number(x.NFCe) || 0, NFSe: Number(x.NFSe) || 0, CTe: Number(x.CTe) || 0, CFe: Number(x.CFe) || 0 };
  };

  return {
    exemplos: false,
    robo() {
      if (!ouvindoRobo) {
        ouvindoRobo = true;
        onSnapshot(doc(db, 'robo', 'sieg'), s => { const d = s.data() || {}; robo = { carregado: true, ligado: !!d.ligado, motivo: texto(d.motivo), em: texto(d.em) }; mudou(); },
          () => { robo = { carregado: true, ligado: false, motivo: 'sem acesso', em: '' }; mudou(); });
      }
      return robo;
    },
    contagem(codigo, competencia) {
      const k = soDigitos(codigo) + '_' + competencia;
      if (!contagens.has(k)) {
        contagens.set(k, { carregada: false, dados: null });
        onSnapshot(doc(db, 'siegContagens', k), s => {
          const d = s.data();
          contagens.set(k, { carregada: true, dados: d ? { codigo: texto(d.codigo), competencia: texto(d.competencia), em: texto(d.em), emitidas: tipos(d.emitidas), recebidas: tipos(d.recebidas) } : null });
          mudou();
        }, () => { contagens.set(k, { carregada: true, dados: null }); mudou(); });
      }
      return contagens.get(k)!;
    },
    saidas(codigo, competencia) {
      const k = soDigitos(codigo) + '_' + competencia;
      if (!saidas.has(k)) {
        saidas.set(k, { carregadas: false, dados: null });
        onSnapshot(doc(db, 'siegSaidas', k), s => {
          const d = s.data();
          saidas.set(k, {
            carregadas: true,
            dados: d ? {
              codigo: texto(d.codigo), competencia: texto(d.competencia), em: texto(d.em),
              series: Array.isArray(d.series) ? (d.series as Record<string, unknown>[]).map(x => ({
                modelo: texto(x.modelo), serie: texto(x.serie), valor: Number(x.valor) || 0,
                numeros: Array.isArray(x.numeros) ? (x.numeros as unknown[]).map(Number) : [],
                canceladas: Array.isArray(x.canceladas) ? (x.canceladas as unknown[]).map(Number) : [],
              })) : [],
            } : null,
          });
          mudou();
        }, () => { saidas.set(k, { carregadas: true, dados: null }); mudou(); });
      }
      return saidas.get(k)!;
    },
    pedido(codigo, competencia, tipo = 'saidas') {
      const k = soDigitos(codigo) + '_' + competencia;
      if (!pedidos.has('saidas|' + k)) {
        pedidos.set('saidas|' + k, null);
        pedidos.set('contagem|' + k, null);
        pedidos.set('xmls|' + k, null);
        // os últimos pedidos da empresa e mês: o mais novo de cada tipo (sem tipo = as saídas, os pedidos de antes)
        // só igualdades (sem orderBy: pedia um índice que não existe e o erro sumia calado; 07/10/2026): o mais novo aqui
        onSnapshot(query(collection(db, 'pedidosSieg'), where('codigo', '==', soDigitos(codigo)), where('competencia', '==', competencia)), s => {
          const todos = s.docs.map(x => x.data()).sort((a, b) => texto(b.criadoEm).localeCompare(texto(a.criadoEm)));
          for (const t of ['saidas', 'contagem', 'xmls'] as const) {
            const d = todos.find(x => (x.tipo || 'saidas') === t);
            const r = d?.resultado as Record<string, unknown> | undefined;
            pedidos.set(t + '|' + k, d ? {
              status: texto(d.status), andamento: texto(d.andamento), erro: texto(d.erro), em: texto(d.criadoEm),
              ...(r ? { resultado: { arquivos: Number(r.arquivos) || 0, novos: Number(r.novos) || 0, pasta: texto(r.pasta), emitidas: Number(r.emitidas) || 0, recebidas: Number(r.recebidas) || 0 } } : {}),
            } : null);
          }
          mudou();
        }, () => undefined);
      }
      return pedidos.get(tipo + '|' + k) || null;
    },
    async pedirSaidas(codigo, competencia) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await addDoc(collection(db, 'pedidosSieg'), { status: 'pendente', codigo: soDigitos(codigo), competencia, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
    },
    notas(codigo, competencia) {
      const k = soDigitos(codigo) + '_' + competencia;
      if (!notas.has(k)) {
        notas.set(k, { carregadas: false, dados: null });
        onSnapshot(doc(db, 'siegNotas', k), s => {
          const d = s.data();
          notas.set(k, {
            carregadas: true,
            dados: d ? {
              codigo: texto(d.codigo), competencia: texto(d.competencia), em: texto(d.em), pasta: texto(d.pasta),
              arquivos: Number(d.arquivos) || 0, novos: Number(d.novos) || 0, itensCortados: !!d.itensCortados,
              emitidas: Array.isArray(d.emitidas) ? (d.emitidas as t.sieg.NotaDoSieg[]) : [],
              recebidas: Array.isArray(d.recebidas) ? (d.recebidas as t.sieg.NotaDoSieg[]) : [],
            } : null,
          });
          mudou();
        }, () => { notas.set(k, { carregadas: true, dados: null }); mudou(); });
      }
      return notas.get(k)!;
    },
    async pedirXmls(codigo, competencia) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await addDoc(collection(db, 'pedidosSieg'), { status: 'pendente', tipo: 'xmls', codigo: soDigitos(codigo), competencia, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
    },
    async pedirContagem(codigo, competencia) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await addDoc(collection(db, 'pedidosSieg'), { status: 'pendente', tipo: 'contagem', codigo: soDigitos(codigo), competencia, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
