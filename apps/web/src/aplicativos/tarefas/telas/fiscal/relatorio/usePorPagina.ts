// Quantas empresas por página no Fiscal (28/10/2026: "um filtro que o usuário escolhe quantas empresas tem por página"); 0 =
// todas. A mesma escolha vale no Relatório Simples, no Presumido e na REINF. Fica guardada na pessoa (03/11/2026: "tem que
// ser recolocado toda vez que abre o app, deixe para salvar isso automatico"; só no navegador, ele se perdia em outro
// endereço do app ou com os dados do navegador limpos) e, para abrir já certo, aqui.
import { useState } from 'react';
import { useRepoPessoal } from '../../../dados/repo';

const POR_PAGINA = [25, 50, 100, 0] as const;
const CHAVE_POR_PAGINA = 'nads-relatorio-por-pagina';
const PREFERENCIA_POR_PAGINA = 'relatorioPorPagina';
const porPaginaValido = (s: string | null | undefined): number | null => {
  const n = Number(s);
  return s != null && s !== '' && (POR_PAGINA as readonly number[]).includes(n) ? n : null;
};
function porPaginaDoNavegador(): number {
  try { return porPaginaValido(localStorage.getItem(CHAVE_POR_PAGINA)) ?? 25; } catch { return 25; }
}

export function usePorPagina() {
  // a escolhida agora vale; senão a guardada na pessoa; até o banco responder, a deste navegador
  const pessoal = useRepoPessoal();
  const [escolhida, setEscolhida] = useState<number | null>(null);
  return {
    porPagina: escolhida ?? porPaginaValido(pessoal.preferencia(PREFERENCIA_POR_PAGINA)) ?? porPaginaDoNavegador(),
    porPaginaOpcoes: POR_PAGINA.map(n => ({ valor: n, rotulo: n ? String(n) : 'Todas' })),
    escolher(n: number) {
      setEscolhida(n);
      try { localStorage.setItem(CHAVE_POR_PAGINA, String(n)); } catch { /* sem armazenamento no navegador: fica a da pessoa */ }
      pessoal.guardarPreferencia(PREFERENCIA_POR_PAGINA, String(n)).catch(() => { /* sem internet: vale agora e neste navegador */ });
    },
  };
}
