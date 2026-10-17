// ViewModel do enviar documento (Vitor, 16/10/2026; a janela da Central de documentos): o tipo do que está sendo mandado,
// a conferência de cada arquivo (PDF, JPG, PNG, XML ou ZIP, até 700 KB) e o que foi enviado nesta janela.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { repoAreaCliente } from '../dados/repo';
import type { DaCasca } from './useAreaCliente';

/** o mesmo arquivo com o tipo certo pela extensão */
export const comMime = (a: File) => new File([a], a.name, { type: ac.mimeDoEnvio(a.name), lastModified: a.lastModified });

export function useEnviar({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  const [tipo, setTipo] = useState<ac.TipoDeEnvio>('extrato');
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  // o que foi enviado nesta janela (a lista do escritório chega pelo espelho)
  const [enviados, setEnviados] = useState<string[]>([]);

  async function enviar(arquivos: File[]) {
    const problemas = arquivos.map(a => ac.erroDoEnvio({ nome: a.name, tamanho: a.size }));
    setErros(problemas.filter(Boolean));
    const bons = arquivos.filter((_, i) => !problemas[i]);
    if (!bons.length) return;
    setEnviando(true);
    try {
      // o tipo vem da extensão: o navegador às vezes manda vazio ou octet-stream e a regra do banco recusa
      await repoAreaCliente.enviar(token, tipo, bons.map(comMime));
      setEnviados(e => [...e, ...bons.map(b => b.name)]);
      toast(bons.length === 1 ? 'Recebemos o arquivo.' : 'Recebemos os ' + bons.length + ' arquivos.');
    } finally { setEnviando(false); }
  }

  return {
    limite: ac.LIMITE_DO_ENVIO,
    enviados,
    tipo, mudarTipo: setTipo, tipos: ac.TIPOS_DE_ENVIO, aceitar: ac.ACEITAR_NO_CAMPO, enviar, enviando, erros,
    recibos: area.envios, legivel: ac.tamanhoLegivel,
    rotuloDoTipo: (t: string) => ac.TIPOS_DE_ENVIO.find(x => x.valor === t)?.rotulo ?? 'Outro documento',
  };
}
