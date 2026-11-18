// A Tela de Insights no banco do Entregas (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu quero", "esses paineis so vao ser vistos por diretor e admin", "Todos os seis"): nadsInsights/atual
// (lê só Diretor e admin; grava só o robô do PC, pelo Admin SDK). Um ouvinte de um documento só, para a TV ligada o dia todo
// não ler o banco inteiro.
import { tarefas as t } from '@nads/core';
import { doc, onSnapshot } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { EstadoDosInsights, RepoInsights } from './insights';

export function criarInsightsFirestore(): RepoInsights {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let estado: EstadoDosInsights = { carregado: false, resumo: null, erro: '' };
  let ouvindo = false;
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  return {
    exemplos: false,
    estado() {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(doc(bancoDoEntregas(), 'nadsInsights', 'atual'), s => {
          estado = { carregado: true, resumo: s.exists() ? t.lerResumoDosInsights(s.data()) : null, erro: '' };
          mudou();
        }, e => { estado = { carregado: true, resumo: null, erro: e.code === 'permission-denied' ? 'O banco ainda não deixa ler os números (falta a regra do Vitor).' : 'Não deu para ler os números agora.' }; mudou(); });
      }
      return estado;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
