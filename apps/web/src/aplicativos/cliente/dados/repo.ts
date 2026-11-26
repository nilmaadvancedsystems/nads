// De onde a Área do Cliente tira os dados (VITE_FONTE):
//   "banco"    → o espelho do link no Firestore do Entregas (areaCliente.firestore.ts); o token "exemplo" continua com os
//                dados de exemplo, para mostrar o site a quem pergunta sem abrir a empresa de ninguém; e o link da empresa de
//                teste (PERSONALY COMPANY, 13/11/2026) também mostra os dados de exemplo, sem nada ir ao banco;
//   "exemplos" → só os dados de exemplo (areaCliente.memoria.ts), nada sai do navegador.
import { areaCliente as ac } from '@nads/core';
import type { EstadoDaArea, RepoAreaCliente } from './areaCliente';
import { repoSciReport, type RepoSciReport } from './sciReport';
import { criarRepoAreaClienteFirestore } from './areaCliente.firestore';
import { criarRepoAreaClienteMemoria, TOKEN_DE_EXEMPLO } from './areaCliente.memoria';

/** Escolhe o repositório pelo token em cada chamada. */
export function porToken(escolher: (token: string) => RepoAreaCliente): RepoAreaCliente {
  return {
    assinar: (token, aoMudar) => escolher(token).assinar(token, aoMudar),
    enviar: (token, tipo, arquivos) => escolher(token).enviar(token, tipo, arquivos),
    abrirChamado: (token, dados) => escolher(token).abrirChamado(token, dados),
    responderChamado: (token, id, texto) => escolher(token).responderChamado(token, id, texto),
    avaliarChamado: (token, id, nota, comentario) => escolher(token).avaliarChamado(token, id, nota, comentario),
    baixarGuia: (token, id) => escolher(token).baixarGuia(token, id),
    baixarDocumento: (token, id) => escolher(token).baixarDocumento(token, id),
    baixarComprovante: (token, id) => escolher(token).baixarComprovante(token, id),
    baixarDocumentoDp: (token, id) => escolher(token).baixarDocumentoDp(token, id),
    notasDoMes: (token, codigo, mes) => escolher(token).notasDoMes(token, codigo, mes),
    extratoDoMes: (token, codigo, mes) => escolher(token).extratoDoMes(token, codigo, mes),
    pedirDanfe: (token, chave) => escolher(token).pedirDanfe(token, chave),
    confirmarRecebido: (token, id) => escolher(token).confirmarRecebido(token, id),
    marcarSemMovimento: (token, comp) => escolher(token).marcarSemMovimento(token, comp),
    aceitarPolitica: (token, versao) => escolher(token).aceitarPolitica(token, versao),
    entrar: (token, email, senha) => escolher(token).entrar(token, email, senha),
    criarSenha: (token, email) => escolher(token).criarSenha(token, email),
    sair: () => escolher('').sair(),
    acompanharConta: aoMudar => escolher('').acompanharConta(aoMudar),
    conferirCodigoDaSenha: codigo => escolher(codigo === 'exemplo' ? TOKEN_DE_EXEMPLO : '').conferirCodigoDaSenha(codigo),
    gravarSenha: (codigo, senha) => escolher(codigo === 'exemplo' ? TOKEN_DE_EXEMPLO : '').gravarSenha(codigo, senha),
  };
}

/** O estado da Área com as guias do SCI Report juntas às outras, como guias normais (26/11/2026). */
export function juntarGuiasDoSci(area: EstadoDaArea, sci: readonly ac.GuiaDoSciReport[]): EstadoDaArea {
  if (!area.valido || !sci.length) return area;
  const { aPagar, pagas } = ac.guiasDoSciNaArea(sci, area.guias);
  if (!aPagar.length && !pagas.length) return area;
  return {
    ...area, guias: [...area.guias, ...aPagar],
    pagas: [...area.pagas, ...pagas.map(p => ({ id: p.id, tipo: p.tipo, nome: p.nome, competencia: p.competencia, valor: p.valor, pagoEm: p.pagoEm, temComprovante: false }))],
    secoes: { ...area.secoes, pagas: area.secoes.pagas || pagas.length > 0 },
  };
}

/**
 * (26/11/2026; o dono: "tem que aparecer como um documento normal do nads, nao separado, tem que parecer que sci report
 * nem existe para o usuario") a Área com as guias do SCI Report por dentro: o assinar junta as guias da função às do
 * espelho, e o baixarGuia de uma delas pede o PDF à função. Fora isso, igual ao repositório de baixo.
 */
export function comGuiasDoSci(base: RepoAreaCliente, sci: RepoSciReport): RepoAreaCliente {
  return {
    ...base,
    assinar(token, aoMudar) {
      let vivo = true;
      let ultimo: EstadoDaArea | null = null;
      let guias: ac.GuiaDoSciReport[] = [];
      const mostrar = () => { if (vivo && ultimo) aoMudar(juntarGuiasDoSci(ultimo, guias)); };
      const parar = base.assinar(token, a => { ultimo = a; mostrar(); });
      void sci.guias(token).then(r => { if (r.estado === 'ok') { guias = r.guias; mostrar(); } }).catch(() => { /* sem as do SCI, a Área segue */ });
      return () => { vivo = false; parar(); };
    },
    baixarGuia: (token, id) => { const p = ac.publicadosIdDaGuia(id); return p ? sci.pdf(token, p) : base.baixarGuia(token, id); },
  };
}

const memoria = criarRepoAreaClienteMemoria();

export const repoAreaCliente: RepoAreaCliente = comGuiasDoSci(import.meta.env.VITE_FONTE === 'banco'
  ? (() => { const banco = criarRepoAreaClienteFirestore(undefined, { repo: memoria, token: TOKEN_DE_EXEMPLO }); return porToken(t => (t === TOKEN_DE_EXEMPLO ? memoria : banco)); })()
  : memoria, repoSciReport);
