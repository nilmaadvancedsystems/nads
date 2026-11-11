// De onde o formulário do Mandei tira o link (11/11/2026, "liga ao banco"). O cliente abre /mandei/<código> sem login e só
// vê o documento daquele link (o DocDoLink do core): o que perguntamos, as respostas dele e os arquivos que já mandou.
//   - no banco (formulario.firestore.ts): ticketsLinks/{código} no Entregas e os anexos pelo enviosSecretario;
//   - nos dados de exemplo (aqui): o ticket do comum/mandeiExemplo.ts, neste navegador.
import { mandei as m } from '@nads/core';
import { exemplo, MAIOR_ARQUIVO_NO_EXEMPLO } from '../../../comum/mandeiExemplo';
import { criarFormularioFirestore } from './formulario.firestore';

export interface EstadoDoFormulario {
  carregado: boolean;
  /** o documento do link; null = o link não existe */
  doc: m.DocDoLink | null;
  /** o banco não respondeu ('' = sem problema) */
  erro: string;
}

export interface RepoFormulario {
  assinar(codigo: string, aoMudar: (e: EstadoDoFormulario) => void): () => void;
  /** a primeira vez que o cliente abriu (a central vê "Aberto") */
  abriu(codigo: string): Promise<void>;
  /** o rascunho: as respostas como estão (o cliente volta pelo link e continua) */
  rascunho(codigo: string, respostas: Record<string, m.RespostaDoItem>): Promise<void>;
  /** mandou: as respostas e a hora */
  enviar(codigo: string, respostas: Record<string, m.RespostaDoItem>): Promise<void>;
  /** o comprovante de uma resposta (a chave da linha ou do item) */
  anexar(codigo: string, chave: string, arquivo: File): Promise<void>;
  /** o maior arquivo que aceita, em bytes, e como dizer */
  maiorArquivo: number;
  limite: string;
}

const lerComoDataUrl = (f: File) => new Promise<string>((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => falha(r.error);
  r.readAsDataURL(f);
});

/** O documento do link a partir do ticket do exemplo (o de um link velho fica fechado). */
function docDoExemplo(codigo: string): m.DocDoLink | null {
  const t = exemplo.doLink(codigo);
  const l = t?.links.find(x => x.codigo === codigo);
  if (!t || !l) return null;
  return {
    ...m.docDoLink(t, l, new Date()),
    fechado: !!t.resolvidoEm || m.linkAtual(t).codigo !== codigo,
    ...(l.abertoEm ? { abertoEm: l.abertoEm } : {}),
    ...(t.respondidoEm ? { respondidoEm: t.respondidoEm } : {}),
  };
}

function criarFormularioMemoria(): RepoFormulario {
  const doLink = (codigo: string) => {
    const t = exemplo.doLink(codigo);
    if (!t || !m.linkValido(t, codigo, new Date())) throw new Error('Este link venceu.');
    return t;
  };
  return {
    assinar(codigo, aoMudar) {
      const avisar = () => aoMudar({ carregado: true, doc: docDoExemplo(codigo), erro: '' });
      avisar();
      return exemplo.assinar(avisar);
    },
    async abriu(codigo) { const t = doLink(codigo); exemplo.gravar(m.linkAberto(t, codigo, new Date())); },
    async rascunho(codigo, respostas) { exemplo.gravar(m.salvarRascunho(doLink(codigo), respostas, new Date())); },
    async enviar(codigo, respostas) { exemplo.gravar(m.responder(doLink(codigo), respostas, new Date())); },
    async anexar(codigo, chave, f) {
      const t = doLink(codigo);
      if (f.size > MAIOR_ARQUIVO_NO_EXEMPLO) throw new Error(f.name + ': maior que 2 MB (no exemplo).');
      const id = 'arq-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      if (!exemplo.guardarArquivo(id, await lerComoDataUrl(f))) throw new Error(f.name + ': não coube neste navegador.');
      exemplo.gravar(m.comArquivo(t, { id, nome: f.name, tamanho: f.size, itemId: chave, enviadoEm: new Date().toISOString(), status: 'na-fila' }));
    },
    maiorArquivo: MAIOR_ARQUIVO_NO_EXEMPLO, limite: '2 MB',
  };
}

export const repoDoFormulario: RepoFormulario = import.meta.env.VITE_FONTE === 'banco' ? criarFormularioFirestore() : criarFormularioMemoria();
