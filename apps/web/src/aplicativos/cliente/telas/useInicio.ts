// ViewModel do Início da Área do Cliente (Vitor, 16/10/2026): o resumo do mês — as próximas guias, o que o escritório
// ainda está fazendo, os últimos chamados e o contato.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import type { DaCasca } from './useAreaCliente';

export function useInicio({ token, area, hoje, irPara }: DaCasca) {
  const { toast } = useRetorno();
  const [baixando, setBaixando] = useState('');
  const guias = ac.guiasDeHoje(area.guias, hoje);
  const mes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  const agendaDoMes = area.agenda.find(a => a.mes === mes)?.itens ?? [];

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  return {
    guias: guias.slice(0, 4),
    totalDeGuias: guias.length,
    valorEmAberto: guias.reduce((s, g) => s + g.valor, 0),
    vencidas: guias.filter(g => g.situacao === 'vencida').length,
    pendencias: ac.pendenciasDaAgenda(agendaDoMes),
    ultimosChamados: area.chamados.slice(0, 3),
    rotuloDaSituacao: ac.ROTULO_DA_SITUACAO_DO_CHAMADO,
    contato: area.resumo?.escritorio ?? {},
    atualizadoEm: area.resumo?.atualizadoEm ?? '',
    baixando, baixar, irPara,
  };
}
