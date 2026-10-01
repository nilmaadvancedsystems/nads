// A abertura do app (Vitor, 01/10/2026: "a abertura revela a logo completa", "faça alguma animação interessante").
// Enquanto carrega: o N se monta no meio (as metades vermelha e prata entram de lados opostos e se encaixam), desliza
// para a esquerda e revela "Nilma" (um corte da esquerda para a direita, saindo do desfoque), um brilho metálico passa
// pelas letras, "CONTABILIDADE" abre do centro para fora e a logo respira até a tela abrir. As palavras são recortes da
// logo oficial (logo-nilma-completa-original.jpg: só o fundo branco virou transparente), nas mesmas medidas dela.
// vidro: por cima de uma área que está carregando (o fundo embaçado), só o N.
import { CAMINHO_N } from './icones';
import palavra from './logo-nilma-palavra.png';
import contabilidade from './logo-nilma-contabilidade.png';

function N({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 720 1176" aria-hidden="true">
      <g className="abertura-a"><path fill="url(#nlRed)" d={CAMINHO_N} /></g>
      <g className="abertura-b"><path fill="url(#nlSilver)" transform="rotate(180 360 588)" d={CAMINHO_N} /></g>
    </svg>
  );
}

export function AberturaN({ vidro }: { vidro?: boolean } = {}) {
  if (vidro) {
    return (
      <div className="abertura vidro" role="status" aria-label="Abrindo">
        <N className="abertura-n" />
      </div>
    );
  }
  return (
    <div className="abertura" role="status" aria-label="Abrindo">
      <div className="abertura-logo">
        <N className="abertura-logo-n" />
        <img className="abertura-palavra" src={palavra} alt="" />
        <span className="abertura-brilho" style={{ WebkitMaskImage: 'url(' + palavra + ')', maskImage: 'url(' + palavra + ')' }} />
        <img className="abertura-contabilidade" src={contabilidade} alt="" />
      </div>
    </div>
  );
}
