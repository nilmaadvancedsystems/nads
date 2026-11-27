// A Projeção do Fator R no banco do Entregas (26/11/2026): fatorR/{ano}_{código}, um documento por empresa e ano, e o
// pgdas/{código} da empresa (só leitura; o robô do e-CAC grava). Abrir uma empresa lê os três anos e o PGDAS-D dela, uma vez
// (getDoc, sem ouvir); gravar atualiza a cópia da tela. Lê e grava o Fiscal e o admin (regras do banco).
import { tarefas as t } from '@nads/core';
import { doc, getDoc, writeBatch as writeBatchBruto } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { EmpresaDoFatorR, RepoFatorR } from './fatorR';
import { guardarLote } from '../../../comum/modoDesenvolvedor';

const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;
const f = t.fatorR;
const COLECAO = 'fatorR';

export function criarFatorRFirestore(quem: () => string): RepoFatorR {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const o of ouvintes) o(); };
  const empresas = new Map<string, EmpresaDoFatorR>();
  const chave = (codigo: number, anos: readonly number[]) => codigo + ':' + anos.join(',');
  const documento = (d: t.fatorR.FatorRDoAno) => ({
    ano: d.ano, codigo: d.codigo, receita: d.receita, folha: d.folha, doPdf: d.doPdf,
    atualizadoEm: new Date().toISOString(), atualizadoPor: quem().slice(0, 100),
  });
  return {
    exemplos: false,
    daEmpresa(codigo, anos) {
      const k = chave(codigo, anos);
      const ja = empresas.get(k);
      if (ja) return ja;
      empresas.set(k, { carregada: false, falhou: false, anos: new Map(), pgdas: null, pgdasConsultadoEm: '' });
      // o PGDAS-D à parte: sem ele (ou sem a permissão de lê-lo), a projeção segue com o digitado
      const doPgdas = getDoc(doc(db, 'pgdas', String(codigo))).then(s => t.pgdas.lerPgdasDaEmpresa(s.data())).catch(() => null);
      void Promise.all([Promise.all(anos.map(a => getDoc(doc(db, COLECAO, f.idDoFatorR(a, codigo))))), doPgdas]).then(([snaps, pg]) => {
        empresas.set(k, {
          carregada: true, falhou: false, pgdas: pg, pgdasConsultadoEm: pg?.consultadoEm || '',
          anos: new Map(anos.map((a, i) => [a, f.lerFatorRDoAno(snaps[i].data()) ?? f.fatorRVazio(a, codigo)])),
        });
        mudou();
      }, () => { empresas.set(k, { carregada: true, falhou: true, anos: new Map(anos.map(a => [a, f.fatorRVazio(a, codigo)])), pgdas: null, pgdasConsultadoEm: '' }); mudou(); });
      return empresas.get(k) as EmpresaDoFatorR;
    },
    async salvar(docs) {
      if (!docs.length) return;
      const b = writeBatch(db);
      const gravados = docs.map(d => ({ ...d, ...documento(d) }));
      for (const d of gravados) b.set(doc(db, COLECAO, f.idDoFatorR(d.ano, d.codigo)), documento(d));
      await b.commit();
      // a cópia da tela (as vistas que têm o ano gravado)
      for (const [k, v] of empresas) {
        if (!v.carregada || v.falhou) continue;
        const anos = new Map(v.anos);
        let mexeu = false;
        for (const d of gravados) if (anos.has(d.ano) && k.startsWith(d.codigo + ':')) { anos.set(d.ano, d); mexeu = true; }
        if (mexeu) empresas.set(k, { ...v, anos });
      }
      mudou();
    },
    assinar(o) { ouvintes.add(o); return () => { ouvintes.delete(o); }; },
    versao: () => ver,
  };
}
