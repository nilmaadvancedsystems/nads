// ViewModel do enviar ao escritório (Vitor, 16/10/2026; dentro de Documentos): escolher os arquivos (soltar ou procurar),
// o tipo (extrato, nota, comprovante, outro) e Enviar; cada arquivo é conferido antes (PDF, JPG, PNG, XML ou ZIP, até
// 700 KB, o limite das regras do banco); embaixo, os últimos que o escritório recebeu.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { repoAreaCliente } from '../dados/repo';
import type { DaCasca } from './useAreaCliente';

/** o mesmo arquivo com o tipo certo pela extensão (o navegador às vezes manda vazio ou octet-stream e a regra recusa) */
export const comMime = (a: File) => new File([a], a.name, { type: ac.mimeDoEnvio(a.name), lastModified: a.lastModified });

export function useEnviar({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  const [tipo, setTipo] = useState<ac.TipoDeEnvio>('extrato');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);

  /** os escolhidos entram na lista (sem repetir o nome); os que não passam viram aviso */
  function escolher(novos: File[]) {
    const problemas = novos.map(a => ac.erroDoEnvio({ nome: a.name, tamanho: a.size }));
    setErros(problemas.filter(Boolean));
    const bons = novos.filter((_, i) => !problemas[i]);
    setArquivos(atuais => [...atuais.filter(a => !bons.some(b => b.name === a.name)), ...bons]);
  }

  async function enviar() {
    if (!arquivos.length) { setErros(['Escolha o arquivo primeiro.']); return; }
    setEnviando(true);
    try {
      await repoAreaCliente.enviar(token, tipo, arquivos.map(comMime));
      toast(arquivos.length === 1 ? 'Recebemos o arquivo.' : 'Recebemos os ' + arquivos.length + ' arquivos.');
      setArquivos([]); setErros([]);
    } finally { setEnviando(false); }
  }

  return {
    limite: ac.LIMITE_DO_ENVIO, aceitar: ac.ACEITAR_NO_CAMPO,
    tipo, mudarTipo: setTipo, tipos: ac.TIPOS_DE_ENVIO,
    arquivos, escolher, tirar: (nome: string) => setArquivos(a => a.filter(x => x.name !== nome)),
    enviar, enviando, erros,
    recibos: area.envios.slice(0, 5), legivel: ac.tamanhoLegivel, dataHora: formatos.dataHora,
    rotuloDoTipo: (t: string) => ac.TIPOS_DE_ENVIO.find(x => x.valor === t)?.rotulo ?? 'Outro documento',
  };
}
