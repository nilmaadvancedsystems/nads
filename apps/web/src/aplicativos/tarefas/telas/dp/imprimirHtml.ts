// Imprimir um documento HTML pronto (Savio, 15/10/2026, as etiquetas da folha): num iframe escondido, para a página do
// nads não mudar e nada abrir em outra aba; a janela de impressão do navegador abre sobre a tela.
/** Imprime o documento HTML num iframe escondido (a página do nads não muda e nada abre em outra aba) */
export function imprimirHtml(html: string): void {
  const quadro = document.createElement('iframe');
  quadro.setAttribute('aria-hidden', 'true');
  quadro.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  const tirar = () => { if (quadro.isConnected) quadro.remove(); };
  quadro.onload = () => {
    const w = quadro.contentWindow;
    if (!w) { tirar(); return; }
    w.addEventListener('afterprint', tirar);
    w.focus();
    w.print();
    // se o navegador não avisar que acabou, tira o quadro depois de um tempo
    setTimeout(tirar, 5 * 60_000);
  };
  quadro.srcdoc = html;
  document.body.appendChild(quadro);
}
