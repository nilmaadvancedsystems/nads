// O cofre liberado sozinho para a equipe (Vitor, 19/11/2026: "libere para todos os usuarios do nads o acesso as senhas, sem pedir
// permissao"; escolheu "Liberar sozinho", o cofre continua embaralhado). Em toda aba do nads de quem já tem o cofre (a cópia da
// chave na versão atual e a chave privada neste navegador), ouve só os pedidos de acesso (cofreChaves e cofreConfig, pequenos; o
// cofre em si não é baixado) e libera na hora o pedido de quem é da equipe e está ativo: tranca a chave do cofre para a chave
// pública do pedido, como o Liberar da tela de Acesso faz.
import { cofre as c } from '@nads/core';
import { collection, doc, onSnapshot, setDoc as gravarBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { idDaChave, lerChavePrivada } from './chaveLocal';
import { bancoDoEntregas } from './entregas.firestore';

const setDoc = guardar(gravarBruto) as typeof gravarBruto;

/** o uid de quem fez o pedido: o id da chave é o uid + '-' + o aparelho */
export const uidDoPedido = (id: string): string => (id.lastIndexOf('-') > 0 ? id.slice(0, id.lastIndexOf('-')) : id);

/**
 * Liga a liberação sozinha para quem está no nads; devolve o desligar. daEquipe: o uid é da equipe e está ativo (lido na hora,
 * a lista da equipe muda).
 */
export function liberarPedidosSozinho(eu: { uid: string; nome: string }, daEquipe: (uid: string) => boolean): () => void {
  const db = bancoDoEntregas();
  const meuId = idDaChave(eu.uid);
  let config: c.ConfigDoCofre | null = null;
  let pessoas: c.ChaveDaPessoa[] = [];
  // a chave do cofre aberta por esta aba (uma por versão)
  let chave: { versao: number; k: CryptoKey } | null = null;
  const feitos = new Set<string>();
  let parado = false;
  let rodando = false;

  async function rodar() {
    if (rodando || parado || !config) return;
    rodando = true;
    try {
      const versao = config.versao;
      const minha = pessoas.find(p => p.id === meuId);
      if (!minha?.trancada || minha.versao !== versao) return;
      const pedidos = pessoas.filter(p => (!p.trancada || p.versao !== versao) && p.publica && p.id !== meuId && daEquipe(uidDoPedido(p.id)) && !feitos.has(p.id + '|' + versao));
      if (!pedidos.length) return;
      if (!chave || chave.versao !== versao) {
        const privada = await lerChavePrivada(meuId);
        if (!privada) return;
        chave = { versao, k: await c.destrancar(minha.trancada, privada) };
      }
      for (const p of pedidos) {
        if (parado) return;
        feitos.add(p.id + '|' + versao);
        await setDoc(doc(db, 'cofreChaves', p.id), { trancada: await c.trancarPara(chave.k, p.publica), versao, liberadoPor: eu.nome + ' (sozinho)', liberadoEm: new Date().toISOString() }, { merge: true })
          .catch(() => { feitos.delete(p.id + '|' + versao); });
      }
    } catch { /* a cópia não abre com esta chave: não libera daqui */ } finally { rodando = false; }
  }

  const pararConfig = onSnapshot(doc(db, 'cofreConfig', 'atual'), s => { config = s.exists() ? (s.data() as c.ConfigDoCofre) : null; void rodar(); }, () => undefined);
  const pararChaves = onSnapshot(collection(db, 'cofreChaves'), s => { pessoas = s.docs.map(d => ({ ...(d.data() as c.ChaveDaPessoa), id: d.id })); void rodar(); }, () => undefined);
  return () => { parado = true; pararConfig(); pararChaves(); };
}
