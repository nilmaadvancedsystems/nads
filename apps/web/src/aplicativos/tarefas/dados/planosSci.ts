// Os planos de contas do SCI que o escritório adiciona ou atualiza (26/11/2026: "Coloca uma opcao de adicionar um plano de
// contas, ou atualizar o plano"): config/sciPlanos do Entregas, gravado em Cadastro › Integração SCI. Quando chegam, valem no
// lugar dos que vêm no nads (sci.usarPlanosDoBanco). Interface + a versão de exemplo; a do banco é planosSci.firestore.ts.
import { sci } from '@nads/core';

/** Um plano gravado: as contas e quem mandou, quando e de qual arquivo. */
export interface PlanoSciGravado { id: string; linhas: readonly sci.LinhaDoPlanoSci[]; arquivo: string; por: string; em: string }

export interface RepoPlanosSci {
  exemplos: boolean;
  /** os planos gravados (pedir já começa a ouvir e a usar no core) */
  atual(): { carregada: boolean; planos: readonly PlanoSciGravado[] };
  salvar(id: string, linhas: readonly sci.LinhaDoPlanoSci[], arquivo: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Do documento do banco: { planos: { [id]: { texto, arquivo, por, em } } } (o texto: uma conta por linha, separada por tabulação). */
export function planosDoDocumento(doc: unknown): PlanoSciGravado[] {
  const planos = (doc && typeof doc === 'object' ? (doc as { planos?: unknown }).planos : null) as Record<string, Record<string, unknown>> | null;
  if (!planos || typeof planos !== 'object') return [];
  return Object.entries(planos).filter(([id]) => sci.idDePlanoValido(id)).map(([id, p]) => ({
    id, linhas: sci.linhasDoTextoDoPlanoSci(p?.texto), arquivo: String(p?.arquivo ?? ''), por: String(p?.por ?? ''), em: String(p?.em ?? ''),
  })).filter(p => p.linhas.length);
}

export function criarPlanosSciMemoria(): RepoPlanosSci {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let planos: PlanoSciGravado[] = [];
  return {
    exemplos: true,
    atual: () => ({ carregada: true, planos }),
    async salvar(id, linhas, arquivo) {
      planos = [...planos.filter(p => p.id !== id), { id, linhas, arquivo, por: 'exemplo', em: new Date().toISOString() }];
      sci.usarPlanosDoBanco(planos);
      ver++; for (const f of ouvintes) f();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
