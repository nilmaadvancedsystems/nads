// A logo da Nilma para os papéis impressos (21/10/2026: as etiquetas do envelope e o protocolo de tributos do
// Cadastro): o N, a palavra "Nilma" e "CONTABILIDADE" num SVG só, em texto (vai dentro do HTML de impressão, que é
// impresso por um quadro à parte e não enxerga os arquivos do site). Branca, para a faixa preta; ou colorida.
// O desenho vai uma vez só no documento (definicao, um <symbol>) e cada etiqueta só o usa (uso): com 200 etiquetas, o
// caminho da logo (35 KB) não se repete 200 vezes.
import { CAMINHO_N } from './icones';
import { CAMINHO_CONTABILIDADE, CAMINHO_NILMA } from './logoNilma';

export interface LogoParaImprimir { definicao: string; uso: string }

export function logoNilmaParaImprimir(tom: 'branca' | 'colorida'): LogoParaImprimir {
  const branca = tom === 'branca';
  const vermelho = branca ? '#fff' : '#C8323A';
  const prata = branca ? '#fff' : '#8A8A8F';
  const texto = branca ? '#fff' : '#4A4A4F';
  const id = 'logo-nilma-' + tom;
  // o N (720 × 1176) à esquerda; a palavra (2109 × 507) e o CONTABILIDADE (3320 × 264) à direita, na mesma largura
  const palavra = 2496 / 2109;
  const contab = 2496 / 3320;
  const caixa = '0 0 3330 1176';
  const definicao = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="${id}" viewBox="${caixa}">`
    + `<path fill="${vermelho}" d="${CAMINHO_N}"/><path fill="${prata}" transform="rotate(180 360 588)" d="${CAMINHO_N}"/>`
    + `<path fill="${vermelho}" fill-rule="evenodd" transform="translate(830 150) scale(${palavra.toFixed(4)})" d="${CAMINHO_NILMA}"/>`
    + `<path fill="${texto}" fill-rule="evenodd" transform="translate(830 860) scale(${contab.toFixed(4)})" d="${CAMINHO_CONTABILIDADE}"/>`
    + `</symbol></svg>`;
  const uso = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${caixa}" role="img" aria-label="Nilma Contabilidade"><use href="#${id}"/></svg>`;
  return { definicao, uso };
}
