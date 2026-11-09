// Onde a pessoa está no Contábil, para Usuários (Vitor, 09/11/2026: "além de online/offline, mostrasse em qual etapa a pessoa
// está, apenas no contábil por enquanto"): grava (com o último sinal) e apaga, em usuarios/{uid}.nadsOnde. Quando bater fica
// na tela (ondeEstou.tsx). No modo desenvolvedor, não grava.
import type { usuarios } from '@nads/core';
import { modoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { repoDeAcesso } from '../../dados/fonte';

export type OndeAberto = Omit<usuarios.OndeNoNads, 'em'>;

function gravar(onde: OndeAberto) {
  if (!modoDesenvolvedor()) void repoDeAcesso().marcarOnde({ ...onde, em: new Date().toISOString() }).catch(() => undefined);
}
function limpar() {
  if (!modoDesenvolvedor()) void repoDeAcesso().marcarOnde(null).catch(() => undefined);
}

export function useOndeEstou() {
  return { gravar, limpar };
}
