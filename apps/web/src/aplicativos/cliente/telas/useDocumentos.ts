// ViewModel da Central de documentos (Vitor, 16/10/2026, do protótipo): os documentos que o escritório deixou (balancete,
// DRE, folha, recibos, certidões…), com a busca, a área e o mês; os novos marcados; visualizar e baixar (baixou, deixa de
// ser novo). O enviar documentos fica na mesma aba (useEnviar).
import { formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { ROTULO_DA_AREA, type AreaDoDocumento, type DocumentoDoCliente } from '../dados/areaCliente';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { filtrarDocumentos, mesesDosDocumentos } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

export function useDocumentos({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  const [busca, setBusca] = useState('');
  const [areaDoc, setAreaDoc] = useState('');
  const [mes, setMes] = useState('');
  const [baixando, setBaixando] = useState('');

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const arq = await repoAreaCliente.baixarDocumento(token, id);
      if (arq) baixarArquivo(arq.nome, arq.arquivo); else toast('Não achamos este arquivo. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  const docs = filtrarDocumentos(area.documentos, { busca, area: areaDoc, mes });
  return {
    docs, total: area.documentos.length, novos: area.documentos.filter(d => d.novo).length,
    busca, mudarBusca: setBusca, area: areaDoc, mudarArea: setAreaDoc, mes, mudarMes: setMes,
    areas: Object.entries(ROTULO_DA_AREA).map(([valor, rotulo]) => ({ valor: valor as AreaDoDocumento, rotulo })),
    meses: mesesDosDocumentos(area.documentos).map(m => ({ valor: m, rotulo: formatos.rot(m) })),
    limpar: () => { setBusca(''); setAreaDoc(''); setMes(''); },
    filtrando: !!(busca || areaDoc || mes),
    baixando, baixar,
    rotuloDaArea: (d: DocumentoDoCliente) => ROTULO_DA_AREA[d.area],
    referente: (d: DocumentoDoCliente) => d.competencia ? 'referente a ' + formatos.rot(d.competencia) : '',
    enviadoEm: (d: DocumentoDoCliente) => new Date(d.enviadoEm).toLocaleDateString('pt-BR'),
  };
}
