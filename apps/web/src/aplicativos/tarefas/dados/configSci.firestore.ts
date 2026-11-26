// config/sci no banco do Entregas (24/11/2026): a integração com as APIs da SCI, que o admin liga (a regra do config: lê
// quem é membro, grava o admin). Os tokens NUNCA ficam aqui (metadado da VM, arquivo do PC e Secret Manager da função).
// (26/11/2026) Os tokens de cliente cadastrados pela tela vão em config/sciTokens já EMBARALHADOS com a chave pública (só o
// robô da nuvem desembaralha); o robô grava o teste de cada um em config/sciTokensTeste.
import { sci } from '@nads/core';
import { doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoConfigSci } from './configSci';
import { guardar } from '../../../comum/modoDesenvolvedor';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;

export function criarConfigSciFirestore(quem: () => string): RepoConfigSci {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: { carregada: boolean; config: sci.integracao.ConfigDoSci } = { carregada: false, config: sci.integracao.CONFIG_DO_SCI_DESLIGADA };
  let ouvindo = false;
  let tokens: Record<string, sci.integracao.TokenGuardado> = {};
  let testes: Record<string, sci.integracao.TesteDoToken> = {};
  let ouvindoTokens = false;
  return {
    exemplos: false,
    atual() {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(doc(db, 'config', 'sci'), s => { estado = { carregada: true, config: sci.integracao.configDoSci(s.data()) }; mudou(); },
          () => { estado = { carregada: true, config: sci.integracao.CONFIG_DO_SCI_DESLIGADA }; mudou(); });
      }
      return estado;
    },
    tokens() {
      if (!ouvindoTokens) {
        ouvindoTokens = true;
        onSnapshot(doc(db, 'config', 'sciTokens'), s => { tokens = sci.integracao.tokensDoDocumento(s.data()); mudou(); }, () => { /* sem permissão: fica vazio */ });
        onSnapshot(doc(db, 'config', 'sciTokensTeste'), s => { testes = sci.integracao.testesDoDocumento(s.data()); mudou(); }, () => { /* idem */ });
      }
      return { tokens, testes };
    },
    async gravarToken(codigo, token) {
      const cifrado = token === null ? null : await sci.integracao.cifrarToken(token);
      await setDoc(doc(db, 'config', 'sciTokens'), sci.integracao.documentoDosTokens(tokens, codigo, cifrado, quem(), new Date()));
    },
    async salvar(config) {
      await setDoc(doc(db, 'config', 'sci'), sci.integracao.documentoDaConfigDoSci(config, quem(), new Date()));
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
