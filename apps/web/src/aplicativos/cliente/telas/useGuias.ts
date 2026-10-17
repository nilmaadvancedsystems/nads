// ViewModel de Guias (Vitor, 16/10/2026): as guias para pagar agrupadas pelo mês de referência (o mais novo primeiro), o
// baixar do PDF e o copiar da linha digitável.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import type { DaCasca } from './useAreaCliente';

export function useGuias({ token, area, hoje, copiar }: DaCasca) {
  const { toast } = useRetorno();
  const [baixando, setBaixando] = useState('');
  const meses = ac.guiasPorCompetencia(ac.guiasDeHoje(area.guias, hoje)).map(m => ({ ...m, rotulo: formatos.capital(formatos.rot(m.competencia)) }));

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  return { meses, vazio: area.guias.length === 0, codigos: area.codigos, baixando, baixar, copiarCodigo: (c: string) => copiar(c, 'Código') };
}
