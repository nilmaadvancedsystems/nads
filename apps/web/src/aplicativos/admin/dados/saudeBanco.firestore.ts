// O resumo diário da saúde do banco no banco do Entregas (só leitura; as regras deixam só o admin): robo/saudeBanco, que o
// robô da nuvem grava uma vez por dia (robo/saude-banco.js). Muda uma vez por dia: em vez de ouvir ao vivo, lê ao abrir e
// de novo a cada 15 min enquanto alguém acompanha. O histórico das coleções (usado pelo robô) não vem para a tela.
import { entregas as e } from '@nads/core';
import { doc, getDoc } from 'firebase/firestore';
import { bancoDoEntregas } from '../../tarefas/dados/entregas.firestore';
import type { DocsDaSaudeDoBanco, RepoSaudeDoBanco } from './saudeBanco';

const A_CADA_MS = 15 * 60 * 1000;

export function criarSaudeDoBancoFirestore(): RepoSaudeDoBanco {
  const db = bancoDoEntregas();
  let docs: DocsDaSaudeDoBanco = { carregado: false, semPermissao: false, resumo: null };
  let ver = 0;
  let quantos = 0;
  let relogio: ReturnType<typeof setInterval> | null = null;
  const ouvintes = new Set<() => void>();
  const mudou = (d: DocsDaSaudeDoBanco) => { docs = d; ver++; for (const f of ouvintes) f(); };

  async function ler() {
    try {
      const s = await getDoc(doc(db, 'robo', 'saudeBanco'));
      mudou({ carregado: true, semPermissao: false, resumo: e.lerResumoDaSaudeDoBanco(s.exists() ? s.data() : null) });
    } catch (err) {
      const negado = /permission|insufficient/i.test(err instanceof Error ? err.message : String(err));
      mudou({ carregado: true, semPermissao: negado, resumo: docs.resumo });
    }
  }

  return {
    exemplos: false,
    docs: () => docs,
    acompanhar() {
      quantos++;
      if (!relogio) { void ler(); relogio = setInterval(() => void ler(), A_CADA_MS); }
      return () => {
        quantos--;
        if (!quantos && relogio) { clearInterval(relogio); relogio = null; }
      };
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
