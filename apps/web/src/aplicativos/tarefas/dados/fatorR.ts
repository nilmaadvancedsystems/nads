// A Projeção do Fator R (26/11/2026: a planilha "PROJEÇÃO FATOR R 6.0" do Fiscal em Fiscal › Ferramentas): os documentos da
// empresa por ano (fatorR/{ano}_{código}, a receita e a folha digitadas ou do PDF) e o PGDAS-D dela que o robô do e-CAC
// trouxe (pgdas/{código}). Lido uma vez ao abrir a empresa (sem ficar ouvindo: as leituras do banco já passam da cota).
// Interface + a versão de exemplo; a do banco é fatorR.firestore.ts.
import { tarefas as t } from '@nads/core';

const f = t.fatorR;

export interface EmpresaDoFatorR {
  carregada: boolean;
  /** a leitura dos documentos falhou (sem permissão, sem internet) */
  falhou: boolean;
  anos: ReadonlyMap<number, t.fatorR.FatorRDoAno>;
  /** o PGDAS-D do robô; null = a empresa ainda não tem (ou a leitura dele falhou) */
  pgdas: t.fatorR.PgdasParaOFatorR | null;
  /** quando o robô consultou (ISO); '' sem o PGDAS-D */
  pgdasConsultadoEm: string;
}

export interface RepoFatorR {
  exemplos: boolean;
  /** pedir já lê (uma vez) os documentos dos anos e o PGDAS-D da empresa */
  daEmpresa(codigo: number, anos: readonly number[]): EmpresaDoFatorR;
  /** grava os documentos (com quem e quando) e já mostra na tela */
  salvar(docs: readonly t.fatorR.FatorRDoAno[]): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

const chave = (codigo: number, anos: readonly number[]) => codigo + ':' + anos.join(',');

/** Os números de exemplo (sem o banco): a receita e a folha digitadas até 2025 e, de 2026, o PGDAS-D do robô. */
export function exemploDoFatorR(codigo: number, hoje: Date): { docs: t.fatorR.FatorRDoAno[]; pgdas: t.fatorR.PgdasParaOFatorR } {
  const base = 30000 + (codigo % 7) * 5000;
  const docs = new Map<number, t.fatorR.FatorRDoAno>();
  const pgdas: { meses: Record<string, { receita: number }>; folhas: Record<string, { valor: number }> } = { meses: {}, folhas: {} };
  const atual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  const ultimoFechado = f.somarMeses(atual, -1);
  f.competenciasEntre(f.somarMeses(atual, -24), ultimoFechado).forEach((c, i) => {
    const receita = Math.round((base + ((i * 3917) % 9000)) * 100) / 100;
    const folha = Math.round((base * 0.27 + ((i * 1733) % 1500)) * 100) / 100;
    if (c >= hoje.getFullYear() + '-01') { pgdas.meses[c] = { receita }; if (c < ultimoFechado) pgdas.folhas[c] = { valor: folha }; return; }
    const ano = Number(c.slice(0, 4));
    let d = docs.get(ano) ?? f.fatorRVazio(ano, codigo);
    d = f.comValorDoMes(f.comValorDoMes(d, c, 'receita', receita), c, 'folha', folha);
    docs.set(ano, d);
  });
  return { docs: [...docs.values()], pgdas };
}

export function criarFatorRMemoria(semente: (codigo: number) => { docs: t.fatorR.FatorRDoAno[]; pgdas: t.fatorR.PgdasParaOFatorR | null } = () => ({ docs: [], pgdas: null })): RepoFatorR {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const guardados = new Map<string, t.fatorR.FatorRDoAno>();
  const pgdas = new Map<number, t.fatorR.PgdasParaOFatorR | null>();
  const vistas = new Map<string, EmpresaDoFatorR>();
  const daSemente = (codigo: number) => {
    if (pgdas.has(codigo)) return;
    const s = semente(codigo);
    pgdas.set(codigo, s.pgdas);
    for (const d of s.docs) guardados.set(f.idDoFatorR(d.ano, d.codigo), d);
  };
  return {
    exemplos: true,
    daEmpresa(codigo, anos) {
      const k = chave(codigo, anos);
      let v = vistas.get(k);
      if (!v) {
        daSemente(codigo);
        const p = pgdas.get(codigo) || null;
        v = { carregada: true, falhou: false, pgdas: p, pgdasConsultadoEm: p ? new Date().toISOString() : '',
          anos: new Map(anos.map(a => [a, guardados.get(f.idDoFatorR(a, codigo)) ?? f.fatorRVazio(a, codigo)])) };
        vistas.set(k, v);
      }
      return v;
    },
    async salvar(docs) {
      for (const d of docs) guardados.set(f.idDoFatorR(d.ano, d.codigo), { ...d, atualizadoEm: new Date().toISOString(), atualizadoPor: 'exemplo' });
      vistas.clear(); ver++; for (const o of ouvintes) o();
    },
    assinar(o) { ouvintes.add(o); return () => { ouvintes.delete(o); }; },
    versao: () => ver,
  };
}
