// De onde a Área do Cliente tira os dados (VITE_FONTE):
//   "banco"    → o espelho do link no Firestore do Entregas (areaCliente.firestore.ts); o token "exemplo" continua com os
//                dados de exemplo, para mostrar o site a quem pergunta sem abrir a empresa de ninguém;
//   "exemplos" → só os dados de exemplo (areaCliente.memoria.ts), nada sai do navegador.
import type { RepoAreaCliente } from './areaCliente';
import { criarRepoAreaClienteFirestore } from './areaCliente.firestore';
import { criarRepoAreaClienteMemoria, TOKEN_DE_EXEMPLO } from './areaCliente.memoria';

/** Escolhe o repositório pelo token em cada chamada. */
export function porToken(escolher: (token: string) => RepoAreaCliente): RepoAreaCliente {
  return {
    assinar: (token, aoMudar) => escolher(token).assinar(token, aoMudar),
    enviar: (token, tipo, arquivos) => escolher(token).enviar(token, tipo, arquivos),
    abrirChamado: (token, dados) => escolher(token).abrirChamado(token, dados),
    enviarFotoDoFuncionario: (token, id, foto) => escolher(token).enviarFotoDoFuncionario(token, id, foto),
    responderChamado: (token, id, texto) => escolher(token).responderChamado(token, id, texto),
    baixarGuia: (token, id) => escolher(token).baixarGuia(token, id),
    baixarDocumento: (token, id) => escolher(token).baixarDocumento(token, id),
    baixarComprovante: (token, id) => escolher(token).baixarComprovante(token, id),
  };
}

const memoria = criarRepoAreaClienteMemoria();

export const repoAreaCliente: RepoAreaCliente = import.meta.env.VITE_FONTE === 'banco'
  ? (() => { const banco = criarRepoAreaClienteFirestore(); return porToken(t => (t === TOKEN_DE_EXEMPLO ? memoria : banco)); })()
  : memoria;
