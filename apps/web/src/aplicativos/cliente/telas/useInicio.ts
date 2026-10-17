// ViewModel da Visão geral da Área do Cliente (Vitor, 16/10/2026): o que pagar primeiro (as próximas guias) e, embaixo,
// os avisos que pedem uma ação (documento novo, resposta do escritório, certificado perto de vencer). Sem números.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { avisos } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

export function useInicio({ token, area, hoje, irPara, copiar }: DaCasca) {
  const { toast } = useRetorno();
  const [baixando, setBaixando] = useState('');
  const guias = ac.guiasDeHoje(area.guias, hoje);

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  return {
    guias: guias.slice(0, 4), maisGuias: guias.length > 4,
    avisos: avisos(area, hoje),
    codigos: area.codigos, baixando, baixar, copiarCodigo: (c: string) => copiar(c, 'Código'), irPara,
  };
}
