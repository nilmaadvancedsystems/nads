// O DP › Envios no banco do Entregas (27/10/2026), nas regras de lá:
//   - dpArquivos/{AAAA-MM} (só leitura): clientes.<código>.arquivos [{ i, n, c, s }], os documentos do DP do mês na pasta
//     do cliente, que o robô da nuvem grava a cada releitura da pasta (robo/envios-do-dp.js);
//   - solicitacoesEmail: o pedido { tipo: 'envioDp', status: 'pendente', competencia, codigo, empresa, arquivos,
//     criadoEm, criadoPor, criadoPorEmail, criadoPorUid } (só o admin e o DP criam); o robô responde no próprio pedido
//     (status enviado ou erro, para, enviados, enviadoEm).
import { addDoc as addDocBruto, collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { entregas } from '@nads/core';
import { guardarPedido } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';
import type { ArquivoDoDp, EnvioDoDp, RepoEnviosDp } from './enviosDp';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é pedido
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const texto = (v: unknown) => (v == null ? '' : String(v));
const textos = (v: unknown) => (Array.isArray(v) ? v.map(texto) : []);

function envioDoBanco(id: string, d: Record<string, unknown>): EnvioDoDp {
  return {
    id, codigo: texto(d.codigo), empresa: texto(d.empresa), competencia: texto(d.competencia), status: texto(d.status), erro: texto(d.erro),
    para: textos(d.para), enviados: textos(d.enviados), criadoEm: texto(d.criadoEm), criadoPor: texto(d.criadoPor), enviadoEm: texto(d.enviadoEm),
  };
}

export function criarEnviosDpFirestore(quem: () => entregas.Quem | null): RepoEnviosDp {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const listas = new Map<string, { carregados: boolean; porCodigo: ReadonlyMap<string, readonly ArquivoDoDp[]> }>();
  const doMes = new Map<string, { carregados: boolean; porCodigo: ReadonlyMap<string, EnvioDoDp> }>();

  return {
    exemplos: false,
    arquivos(competencia) {
      if (!listas.has(competencia)) {
        listas.set(competencia, { carregados: false, porCodigo: new Map() });
        onSnapshot(doc(db, 'dpArquivos', competencia), s => {
          const clientes = (s.data()?.clientes || {}) as Record<string, { arquivos?: Record<string, unknown>[] }>;
          const porCodigo = new Map(Object.entries(clientes).map(([cod, c]) => [cod, (c?.arquivos || []).map(a => ({
            id: texto(a.i), nome: texto(a.n), pasta: texto(a.c), tamanho: Number(a.s) || 0,
          }))]));
          listas.set(competencia, { carregados: true, porCodigo });
          mudou();
        }, () => { listas.set(competencia, { carregados: true, porCodigo: new Map() }); mudou(); });
      }
      return listas.get(competencia)!;
    },
    envios(competencia) {
      if (!doMes.has(competencia)) {
        doMes.set(competencia, { carregados: false, porCodigo: new Map() });
        // só igualdade (sem orderBy, que pediria um índice): o mais novo de cada cliente escolhido aqui
        onSnapshot(query(collection(db, 'solicitacoesEmail'), where('tipo', '==', 'envioDp'), where('competencia', '==', competencia)), s => {
          const todos = s.docs.map(x => envioDoBanco(x.id, x.data())).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
          const porCodigo = new Map<string, EnvioDoDp>();
          for (const e of todos) porCodigo.set(e.codigo, e);
          doMes.set(competencia, { carregados: true, porCodigo });
          mudou();
        }, () => { doMes.set(competencia, { carregados: true, porCodigo: new Map() }); mudou(); });
      }
      return doMes.get(competencia)!;
    },
    async enviar({ codigo, empresa, competencia, arquivos }) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await addDoc(collection(db, 'solicitacoesEmail'), {
        tipo: 'envioDp', status: 'pendente', competencia, codigo: String(codigo), empresa, arquivos: [...arquivos],
        criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorEmail: q.email, criadoPorUid: q.uid,
      });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
