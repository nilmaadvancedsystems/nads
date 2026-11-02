// Como o Extrator mora no banco (Firestore do projeto conferencia-nilma, coleção `extrator`):
//   extrator/{slug(nome)}                  → { nome, auditoria, bancos?, pedidos? }
//   extrator/{slug(nome)}/arquivos/{id}    → um arquivo importado, com os lançamentos lidos dele
// Um documento por arquivo deixa cada um bem abaixo do limite de 1 MB do Firestore, e gravar uma
// importação nova não reescreve as antigas. Aqui ficam só as contas (o que gravar e como remontar);
// quem fala com o Firebase é apps/web/src/aplicativos/extratudo/dados/extrator.firestore.ts.
import { bytesNoBanco, normalizarEmpresa } from './importacao';
import type { ArquivoImportado, BancoAdicionado, EmpresaExtrator, PedidoRegistrado, RegistroAuditoria } from '../tipos';

export interface DocEmpresaExtrator { nome: string; auditoria: RegistroAuditoria[]; bancos?: BancoAdicionado[]; pedidos?: PedidoRegistrado[] }

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
  const docDepois: DocEmpresaExtrator = { nome: depois.nome, auditoria: depois.auditoria, ...(depois.bancos ? { bancos: depois.bancos } : {}), ...(depois.pedidos ? { pedidos: depois.pedidos } : {}) };
  const empresa = !antes || antes.nome !== depois.nome || !igual(antes.auditoria, depois.auditoria) || !igual(antes.bancos || [], depois.bancos || []) || !igual(antes.pedidos || [], depois.pedidos || []) ? docDepois : null;
  const porId = new Map((antes?.arquivos || []).map(a => [a.id, a]));
  const arquivos = depois.arquivos.filter(a => !porId.has(a.id) || !igual(porId.get(a.id), a));
  const ficam = new Set(depois.arquivos.map(a => a.id));
  const apagar = (antes?.arquivos || []).filter(a => !ficam.has(a.id)).map(a => a.id);
  return { empresa, arquivos, apagar };
}

/** O limite de um documento do Firestore (1 MiB), com folga para o caminho e os nomes dos campos. */
export const LIMITE_DO_DOCUMENTO = 1_000_000;
/** O pedido de um lote do Firestore cabe 10 MiB e 500 gravações; com folga. */
const BYTES_POR_LOTE = 8_000_000;
const GRAVACOES_POR_LOTE = 400;

/**
 * A gravação em lotes que o banco aceita (30/10/2026: um lote só, com um arquivo grande demais ou grande no total,
 * falhava inteiro e nada gravava). O arquivo maior que um documento fica de fora (naoCabem: a tela diz qual); os outros
 * vão em lotes de até 8 MB e 400 gravações. O documento da empresa (a auditoria) e os apagados vão no último lote,
 * depois dos arquivos: se um lote de arquivos falhar, nada do que já estava é apagado.
 */
export function lotesDaGravacao(g: Gravacao): { lotes: Gravacao[]; naoCabem: ArquivoImportado[] } {
  const naoCabem: ArquivoImportado[] = [];
  const lotes: Gravacao[] = [];
  let atual: Gravacao = { empresa: null, arquivos: [], apagar: [] }, bytes = 0;
  const cheio = () => atual.arquivos.length + atual.apagar.length + (atual.empresa ? 1 : 0) >= GRAVACOES_POR_LOTE;
  const fechar = () => { lotes.push(atual); atual = { empresa: null, arquivos: [], apagar: [] }; bytes = 0; };
  for (const a of g.arquivos) {
    const t = bytesNoBanco(a);
    if (t > LIMITE_DO_DOCUMENTO) { naoCabem.push(a); continue; }
    if (atual.arquivos.length && (bytes + t > BYTES_POR_LOTE || cheio())) fechar();
    atual.arquivos.push(a); bytes += t;
  }
  // o fim: os apagados e a empresa, depois dos arquivos (no último lote, enquanto couberem)
  for (const id of g.apagar) { if (cheio()) fechar(); atual.apagar.push(id); }
  if (g.empresa) { if (cheio() || bytes + bytesNoBanco(g.empresa) > BYTES_POR_LOTE) fechar(); atual.empresa = g.empresa; }
  if (!semMudanca(atual)) lotes.push(atual);
  return { lotes, naoCabem };
}

/** Nada a gravar? */
export function semMudanca(g: Gravacao): boolean {
  return !g.empresa && !g.arquivos.length && !g.apagar.length;
}

/** Remonta a empresa a partir dos documentos lidos (arquivos na ordem de importação). */
export function empresaDoBanco(nome: string, doc: Partial<DocEmpresaExtrator> | null, arquivos: ArquivoImportado[]): EmpresaExtrator {
  const ordenados = [...arquivos].sort((a, b) => a.importadoEm.localeCompare(b.importadoEm) || a.id.localeCompare(b.id));
  return normalizarEmpresa({ nome, arquivos: ordenados, auditoria: doc?.auditoria || [], bancos: doc?.bancos, pedidos: doc?.pedidos });
}
