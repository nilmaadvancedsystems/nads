// O mural de avisos do escritório, no Início da Tarefas (27/10/2026: "informações do escritorio como avisos"): o admin e o
// diretor escrevem, fixam e apagam; toda a equipe lê. Interface + a versão de exemplo (na memória); a do banco é
// avisos.firestore.ts (coleção nadsAvisos do Entregas).
import { tarefas as t } from '@nads/core';

export interface RepoAvisos {
  exemplos: boolean;
  /** os avisos, ao vivo (carregados: já chegou do banco, ou falhou) */
  lista(): { carregados: boolean; avisos: t.AvisoDoEscritorio[] };
  publicar(texto: string, por: string): Promise<void>;
  fixar(id: string, fixado: boolean): Promise<void>;
  apagar(id: string): Promise<void>;
  assinar(f: () => void): () => void;
  versao(): number;
}

export function criarAvisosMemoria(): RepoAvisos {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const ha = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  let avisos: t.AvisoDoEscritorio[] = [
    { id: 'av-1', texto: 'Fechamento de outubro: as rotinas do Fiscal até o dia 10.', por: 'Vitor', em: ha(30), fixado: true },
    { id: 'av-2', texto: 'Sexta-feira o escritório fecha às 16h.', por: 'Vitor', em: ha(4) },
  ];
  return {
    exemplos: true,
    lista: () => ({ carregados: true, avisos }),
    async publicar(texto, por) {
      avisos = [...avisos, { id: 'av-' + Date.now(), texto: t.limparAviso(texto), por, em: new Date().toISOString() }];
      mudou();
    },
    async fixar(id, fixado) { avisos = avisos.map(a => (a.id === id ? { ...a, fixado } : a)); mudou(); },
    async apagar(id) { avisos = avisos.filter(a => a.id !== id); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
