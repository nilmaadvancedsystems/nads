// O QR de um texto (16/10/2026, a cópia fiel do Entregas): o PIX do escritório, o link do cliente e o link de assinar.
// Desenhado no aparelho (a biblioteca qrcode), sem rede; enquanto não fica pronto, ''.
import { useEffect, useState } from 'react';
import { qrDoTexto } from './arquivosDaEntrega';

export function useQr(texto: string, tamanho = 200): string {
  const [qr, setQr] = useState<{ texto: string; url: string }>({ texto: '', url: '' });
  useEffect(() => {
    if (!texto) return;
    let vivo = true;
    qrDoTexto(texto, tamanho).then(url => { if (vivo) setQr({ texto, url }); }, () => undefined);
    return () => { vivo = false; };
  }, [texto, tamanho]);
  return texto && qr.texto === texto ? qr.url : '';
}
