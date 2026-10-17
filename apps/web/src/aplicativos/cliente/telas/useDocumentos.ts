// ViewModel dos Documentos da Área do Cliente (Vitor, 16/10/2026): os documentos que o escritório deixou (balancete, DRE,
// folha, recibos, certidões…), com a busca, e o baixar (baixou, deixa de ser novo). O enviar ao escritório fica na mesma
// tela (useEnviar).
import { formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { ROTULO_DA_AREA, type DocumentoDoCliente } from '../dados/areaCliente';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { filtrarDocumentos } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

export function useDocumentos({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  const [busca, setBusca] = useState('');
  const [baixando, setBaixando] = useState('');

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const arq = await repoAreaCliente.baixarDocumento(token, id);
      if (arq) baixarArquivo(arq.nome, arq.arquivo); else toast('Não achamos este arquivo. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  return {
    docs: filtrarDocumentos(area.documentos, busca), total: area.documentos.length,
    busca, mudarBusca: setBusca, baixando, baixar,
    // a linha de baixo: novo, a área, o mês e quando chegou
    sobre: (d: DocumentoDoCliente) => [d.novo ? 'Novo' : '', ROTULO_DA_AREA[d.area], d.competencia ? formatos.rot(d.competencia) : '', 'chegou em ' + new Date(d.enviadoEm).toLocaleDateString('pt-BR')].filter(Boolean).join(' · '),
  };
}
