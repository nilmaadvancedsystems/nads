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

  const pendencias = ac.pendenciasDaAgenda(agendaDoMes);
  return {
    guias: guias.slice(0, 4),
    totalDeGuias: guias.length,
    valorEmAberto: guias.reduce((s, g) => s + g.valor, 0),
    vencidas: guias.filter(g => g.situacao === 'vencida').length,
    // a notinha do número das guias: "DAS (11/10), FGTS (19/10)…" (as três primeiras)
    guiasEmPoucas: guias.slice(0, 3).map(g => (g.tipo === 'outra' ? 'Guia' : g.tipo) + ' (' + g.vencimento.slice(0, 5) + ')').join(', ') + (guias.length > 3 ? '…' : ''),
    precisaAtencao: guias.some(g => g.situacao !== 'a vencer'),
    pendencias,
    pendenciasEmPoucas: pendencias.slice(0, 2).map(i => i.nome).join(', ') + (pendencias.length > 2 ? '…' : ''),
    ultimosChamados: area.chamados.slice(0, 3),
    ultimaMensagem: (c: ac.ChamadoDoCliente) => c.mensagens[c.mensagens.length - 1] ?? null,
    rotuloDaSituacao: ac.ROTULO_DA_SITUACAO_DO_CHAMADO,
    contato: area.resumo?.escritorio ?? {},
    atualizadoEm: area.resumo?.atualizadoEm ?? '',
    baixando, baixar, irPara,
  };
}
