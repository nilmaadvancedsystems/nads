// ViewModel das guias do SCI Report na aba Guias e obrigações (24/11/2026: "teria como usar a area do cliente do nads e
// apenas consumir a api do sci report?"). Busca na hora, pela função do Firebase, toda vez que a aba abre; mostra as do mês
// escolhido e abre o PDF pela URL temporária que a função devolve.
import type { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { repoSciReport, type GuiasDoSci } from '../dados/sciReport';

/** 'dd/mm/aaaa' → 'aaaa-mm' */
const mesDaData = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5);

export function useGuiasDoSci(token: string, mes: string) {
  const { toast } = useRetorno();
  const [resposta, setResposta] = useState<{ token: string; r: GuiasDoSci } | null>(null);
  const [abrindo, setAbrindo] = useState('');

  useEffect(() => {
    let vivo = true;
    void repoSciReport.guias(token).then(r => { if (vivo) setResposta({ token, r }); });
    return () => { vivo = false; };
  }, [token]);

  const r = resposta?.token === token ? resposta.r : null;
  const todas: ac.GuiaDoSciReport[] = r?.estado === 'ok' ? r.guias : [];

  async function abrir(id: string) {
    // a aba nova abre já, no clique (depois da espera o navegador bloquearia); o endereço do PDF chega em seguida
    const aba = window.open('', '_blank');
    if (aba) aba.opener = null;
    setAbrindo(id);
    try {
      const url = await repoSciReport.urlDoPdf(token, id);
      if (aba) aba.location.href = url; else window.location.assign(url);
    } catch (e) {
      aba?.close();
      toast(e instanceof Error ? e.message : 'Não deu para abrir a guia agora.');
    } finally { setAbrindo(''); }
  }

  return {
    /** o card aparece quando a empresa tem alguma guia no SCI Report (em qualquer mês da janela) ou quando deu erro */
    mostra: todas.length > 0 || r?.estado === 'erro',
    erro: r?.estado === 'erro' ? r.mensagem : '',
    guias: todas.filter(g => mesDaData(g.vencimento) === mes),
    abrindo, abrir: (id: string) => void abrir(id),
  };
}
