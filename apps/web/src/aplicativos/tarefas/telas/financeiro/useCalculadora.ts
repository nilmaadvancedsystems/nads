// ViewModel da calculadora do Caixa (19/10/2026): o estado do redutor de @nads/core. O teclado do computador quem ouve é a
// janela (a View); aqui só se traduz a tecla (teclaDoTeclado) e se aplica.
import { financeiro } from '@nads/core';
import { useCallback, useReducer } from 'react';

export function useCalculadora() {
  const [estado, aoTecla] = useReducer(financeiro.calcular, financeiro.CALCULADORA_INICIAL);
  const teclar = useCallback((t: financeiro.TeclaDaCalculadora) => aoTecla(t), []);
  /** a tecla do computador; devolve se era da calculadora (a janela então segura o padrão do navegador) */
  const teclarDoTeclado = useCallback((key: string) => {
    const t = financeiro.teclaDoTeclado(key);
    if (t) aoTecla(t);
    return !!t;
  }, []);
  return { estado, teclar, teclarDoTeclado, resultado: financeiro.resultadoEmReais(estado) };
}
