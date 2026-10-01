// Aviso de versão nova: confere o versao.json do site (a cada 5 min e quando a aba volta a aparecer) e, se a
// versão publicada não é a desta página, mostra a faixa "Saiu uma versão nova do nads — Atualizar". Não recarrega
// sozinho (podia cortar um envio no meio). Sem versao.json (rodando local), não faz nada.
import { useEffect, useState } from 'react';
import { Icone } from './icones';

const A_CADA_MS = 5 * 60 * 1000;

export function AvisoDeVersaoNova({ atual }: { atual: string }) {
  const [nova, setNova] = useState('');
  useEffect(() => {
    let vivo = true;
    const conferir = () => {
      fetch('/versao.json?t=' + Date.now(), { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then((j: { versao?: string } | null) => { if (vivo && j?.versao && j.versao !== atual) setNova(j.versao); })
        .catch(() => { /* sem rede ou sem o arquivo: confere na próxima */ });
    };
    conferir();
    const t = setInterval(conferir, A_CADA_MS);
    const aoVoltar = () => { if (document.visibilityState === 'visible') conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [atual]);
  if (!nova) return null;
  return (
    <div className="versao-nova" role="status">
      <Icone nome="repeat" />
      <span>Saiu uma versão nova do nads ({nova}). Atualize para usar a mais recente.</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Atualizar</button>
    </div>
  );
}
