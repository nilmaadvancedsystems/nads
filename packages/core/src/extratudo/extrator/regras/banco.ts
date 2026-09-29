// Como o Extrator mora no banco (Firestore do projeto conferencia-nilma, coleção `extrator`):
//   extrator/{slug(nome)}                  → { nome, auditoria }
//   extrator/{slug(nome)}/arquivos/{id}    → um arquivo importado, com os lançamentos lidos dele
// Um documento por arquivo deixa cada um bem abaixo do limite de 1 MB do Firestore, e gravar uma
// importação nova não reescreve as antigas. Aqui ficam só as contas (o que gravar e como remontar);
// quem fala com o Firebase é apps/web/src/aplicativos/extratudo/dados/extrator.firestore.ts.
import { normalizarEmpresa } from './importacao';
import type { ArquivoImportado, EmpresaExtrator, RegistroAuditoria } from '../tipos';

export interface DocEmpresaExtrator { nome: string; auditoria: RegistroAuditoria[] }

/** O que muda no banco para ir de `antes` (o que já está gravado) para `depois`. */
export interface Gravacao {
  /** o documento da empresa, quando mudou (null = não precisa gravar) */
  empresa: DocEmpresaExtrator | null;
  /** arquivos novos ou alterados */
  arquivos: ArquivoImportado[];
  /** ids dos arquivos que saíram */
  apagar: string[];
}

const igual = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function gravacao(antes: EmpresaExtrator | null, depois: EmpresaExtrator): Gravacao {
  const docDepois: DocEmpresaExtrator = { nome: depois.nome, auditoria: depois.auditoria };
  const empresa = !antes || antes.nome !== depois.nome || !igual(antes.auditoria, depois.auditoria) ? docDepois : null;
  const porId = new Map((antes?.arquivos || []).map(a => [a.id, a]));
  const arquivos = depois.arquivos.filter(a => !porId.has(a.id) || !igual(porId.get(a.id), a));
  const ficam = new Set(depois.arquivos.map(a => a.id));
  const apagar = (antes?.arquivos || []).filter(a => !ficam.has(a.id)).map(a => a.id);
  return { empresa, arquivos, apagar };
}

/** Nada a gravar? */
export function semMudanca(g: Gravacao): boolean {
  return !g.empresa && !g.arquivos.length && !g.apagar.length;
}

/** Remonta a empresa a partir dos documentos lidos (arquivos na ordem de importação). */
export function empresaDoBanco(nome: string, doc: Partial<DocEmpresaExtrator> | null, arquivos: ArquivoImportado[]): EmpresaExtrator {
  const ordenados = [...arquivos].sort((a, b) => a.importadoEm.localeCompare(b.importadoEm) || a.id.localeCompare(b.id));
  return normalizarEmpresa({ nome, arquivos: ordenados, auditoria: doc?.auditoria || [] });
}
