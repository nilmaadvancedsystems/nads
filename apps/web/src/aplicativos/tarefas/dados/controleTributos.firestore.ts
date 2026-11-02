// O controle de tributos do Fiscal no banco do Entregas: controleTributos/{AAAA-MM}_{código} (a linha da empresa) e
// controleTributosFolha/{AAAA-MM}_{grupo} (as observações e a retificação). Lê a equipe do nads; grava o Fiscal e o admin.
import { tarefas as t } from '@nads/core';
import { collection, doc, onSnapshot, query, setDoc as setDocBruto, where } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { ControleDoMes, RepoControleTributos } from './controleTributos';
import { guardar } from '../../../comum/modoDesenvolvedor';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const MARCAS = new Set(['ok', 'na']);
const ENTREGAS = new Set(['impresso', 'zap', 'email', 'nao']);
const mapaDeTextos = (v: unknown, max: number): Record<string, string> => Object.fromEntries(Object.entries(v && typeof v === 'object' ? v as Record<string, unknown> : {})
  .filter(([, x]) => typeof x === 'string' && x).map(([k, x]) => [k, texto(x, max)]));
const marcas = (v: unknown) => Object.fromEntries(Object.entries(mapaDeTextos(v, 4)).filter(([, x]) => MARCAS.has(x))) as Record<string, t.MarcaDoControle>;
const entregue = (v: unknown) => (typeof v === 'string' && ENTREGAS.has(v) ? v : '') as t.EntregaDoControle;

function linhaDoDocumento(d: Record<string, unknown>): t.LinhaDoControle | null {
  const codigo = Number(d.codigo);
  if (!Number.isFinite(codigo) || typeof d.competencia !== 'string') return null;
  return {
    competencia: d.competencia, codigo, grupo: d.grupo === 'lp' ? 'lp' : 'sn', valores: mapaDeTextos(d.valores, 30), data: texto(d.data, 10),
    marcas: marcas(d.marcas), entregue: entregue(d.entregue), atualizadoEm: texto(d.atualizadoEm, 40), atualizadoPor: texto(d.atualizadoPor, 100),
  };
}
function folhaDoDocumento(d: Record<string, unknown> | undefined): t.FolhaDoControle {
  const obs = Array.isArray(d?.observacoes) ? d.observacoes.filter((o): o is string => typeof o === 'string') : [];
  const rets = Array.isArray(d?.retificacoes) ? d.retificacoes as Record<string, unknown>[] : [];
  return {
    observacoes: obs.slice(0, t.MAX_OBSERVACOES),
    retificacoes: rets.slice(0, t.MAX_RETIFICACOES).map(r => ({
      codigo: typeof r.codigo === 'number' ? r.codigo : null, referencia: texto(r.referencia, 30), valores: mapaDeTextos(r.valores, 30), marcas: marcas(r.marcas), entregue: entregue(r.entregue),
    })),
  };
}

export function criarControleTributosFirestore(quem: () => string): RepoControleTributos {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const meses = new Map<string, ControleDoMes>();
  return {
    exemplos: false,
    doMes(competencia) {
      const ja = meses.get(competencia);
      if (ja) return ja;
      meses.set(competencia, { carregada: false, linhas: new Map(), folhas: new Map() });
      const por = (m: Partial<ControleDoMes>) => { meses.set(competencia, { ...(meses.get(competencia) as ControleDoMes), ...m }); mudou(); };
      onSnapshot(query(collection(db, 'controleTributos'), where('competencia', '==', competencia)), s => {
        const linhas = new Map<number, t.LinhaDoControle>();
        for (const d of s.docs) { const l = linhaDoDocumento(d.data()); if (l) linhas.set(l.codigo, l); }
        por({ carregada: true, linhas });
      }, () => por({ carregada: true }));
      for (const g of t.GRUPOS_DO_CONTROLE) {
        onSnapshot(doc(db, 'controleTributosFolha', t.idDaFolhaDoControle(competencia, g.id)),
          s => por({ folhas: new Map((meses.get(competencia) as ControleDoMes).folhas).set(g.id, folhaDoDocumento(s.data())) }), () => undefined);
      }
      return meses.get(competencia) as ControleDoMes;
    },
    async salvarLinha(l) {
      await setDoc(doc(db, 'controleTributos', t.idDaLinhaDoControle(l.competencia, l.codigo)), {
        competencia: l.competencia, codigo: l.codigo, grupo: l.grupo, valores: { ...l.valores }, data: l.data, marcas: { ...l.marcas }, entregue: l.entregue,
        atualizadoEm: new Date().toISOString(), atualizadoPor: quem().slice(0, 100),
      });
    },
    async salvarFolha(competencia, grupo, folha) {
      await setDoc(doc(db, 'controleTributosFolha', t.idDaFolhaDoControle(competencia, grupo)), {
        observacoes: folha.observacoes.slice(0, t.MAX_OBSERVACOES).map(o => o.slice(0, 500)),
        retificacoes: folha.retificacoes.slice(0, t.MAX_RETIFICACOES).map(r => ({ codigo: r.codigo, referencia: r.referencia.slice(0, 30), valores: { ...r.valores }, marcas: { ...r.marcas }, entregue: r.entregue })),
        atualizadoEm: new Date().toISOString(), atualizadoPor: quem().slice(0, 100),
      });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
