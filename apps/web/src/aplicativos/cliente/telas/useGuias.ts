// ViewModel da aba Guias (Vitor, 16/10/2026): as guias por mês, as mais novas primeiro, e o baixar do PDF.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import type { DaCasca } from './useAreaCliente';

export function useGuias({ token, area, hoje }: DaCasca) {
  const { toast } = useRetorno();
  const [baixando, setBaixando] = useState('');
  const meses = ac.guiasPorCompetencia(ac.guiasDeHoje(area.guias, hoje));

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  return { meses, baixando, baixar, vazio: area.guias.length === 0 };
}
