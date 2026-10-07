// O print da tela para o feedback: o navegador pede a aba (getDisplayMedia), pega um quadro e fecha a captura; ou a
// imagem de um arquivo / colada. Tudo vira JPEG comprimido (até 1600 px de largura), para caber no documento.
const LARGURA_MAX = 1600;

function desenhar(fonte: CanvasImageSource, largura: number, altura: number): string {
  const k = Math.min(1, LARGURA_MAX / largura);
  const c = document.createElement('canvas');
  c.width = Math.round(largura * k);
  c.height = Math.round(altura * k);
  c.getContext('2d')!.drawImage(fonte, 0, 0, c.width, c.height);
  // se ficar grande demais, comprime mais
  let q = 0.72;
  let url = c.toDataURL('image/jpeg', q);
  while (url.length > 850000 && q > 0.3) { q -= 0.12; url = c.toDataURL('image/jpeg', q); }
  return url;
}

export async function capturarTela(): Promise<string> {
  const opcoes = { video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true } as unknown as DisplayMediaStreamOptions;
  const fluxo = await navigator.mediaDevices.getDisplayMedia(opcoes);
  try {
    const v = document.createElement('video');
    v.srcObject = fluxo;
    v.muted = true;
    await v.play();
    await new Promise(r => setTimeout(r, 250));
    return desenhar(v, v.videoWidth, v.videoHeight);
  } finally {
    fluxo.getTracks().forEach(t => t.stop());
  }
}

export async function imagemDoArquivo(f: Blob): Promise<string> {
  const bmp = await createImageBitmap(f);
  return desenhar(bmp, bmp.width, bmp.height);
}
