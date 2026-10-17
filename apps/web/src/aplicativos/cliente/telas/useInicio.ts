// ViewModel da Visão geral da Área do Cliente (Vitor, 16/10/2026): os números do mês (guias, funcionários, chamados e
// documentos), as próximas guias, o atendimento, os avisos (com o certificado digital) e as últimas conversas.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { chaveDoMes, notificacoes, resumoDoPessoal, situacaoDoCertificado } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

/** "a, b e c" */
const emFrase = (l: string[]) => (l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l[0] ?? '');

export function useInicio({ token, area, hoje, irPara, copiar }: DaCasca) {
  const { toast } = useRetorno();
  const [baixando, setBaixando] = useState('');
  const guias = ac.guiasDeHoje(area.guias, hoje);
  const mes = chaveDoMes(hoje);
  const agendaDoMes = area.agenda.find(a => a.mes === mes)?.itens ?? [];
  const pessoal = resumoDoPessoal(area.empregados, hoje);
  const emAberto = area.chamados.filter(c => c.situacao !== 'concluido');
  const docsDoMes = area.documentos.filter(d => d.enviadoEm.slice(0, 7) === mes);

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  return {
    mesAtual: hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    guias: guias.slice(0, 4),
    // as já pagas entram no fim da lista, como no protótipo ("Liquidado")
    pagas: area.pagas.slice(0, 2),
    baixarComprovante: async (id: string) => {
      const pdf = await repoAreaCliente.baixarComprovante(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('O comprovante ainda não chegou.');
    },
    totalDeGuias: guias.length,
    valorEmAberto: guias.reduce((s, g) => s + g.valor, 0),
    vencidas: guias.filter(g => g.situacao === 'vencida').length,
    // a notinha do número das guias: "DAS (11/10), FGTS (19/10)…" (as três primeiras)
    guiasEmPoucas: emFrase(guias.slice(0, 3).map(g => (g.tipo === 'outra' ? 'Guia' : g.tipo) + ' (' + g.vencimento.slice(0, 5) + ')')) + (guias.length > 3 ? '…' : ''),
    pessoal,
    chamadosEmAberto: emAberto.length,
    primeiroEmAberto: emAberto[0]?.titulo ?? '',
    // o resumo curto dos chamados em aberto, numa linha: "1 em andamento · 1 respondido"
    chamadosEmPoucas: [
      [emAberto.filter(c => c.situacao === 'aberto' || c.situacao === 'em andamento').length, 'em andamento', 'em andamento'] as const,
      [emAberto.filter(c => c.situacao === 'respondido').length, 'respondido', 'respondidos'] as const,
    ].filter(([n]) => n > 0).map(([n, um, varios]) => n + ' ' + (n === 1 ? um : varios)).join(' · '),
    // os avisos da coluna da direita: os recados do escritório e o que pede atenção (documentos novos, certificado,
    // resposta do escritório); as guias já estão na lista ao lado
    avisosDaVisao: [
      ...area.avisos.map(a => ({ id: 'a-' + a.id, titulo: a.titulo, texto: a.texto, ir: a.ir })),
      ...notificacoes({ ...area, guias }, hoje, g => g.tipo).filter(n => !n.id.startsWith('g-')),
    ].slice(0, 4),
    docsDoMes: docsDoMes.length,
    docsNovos: area.documentos.filter(d => d.novo).length,
    pendencias: ac.pendenciasDaAgenda(agendaDoMes),
    avisos: area.avisos,
    certificado: area.certificado ? { ...area.certificado, ...situacaoDoCertificado(area.certificado, hoje) } : null,
    ultimosChamados: area.chamados.slice(0, 3),
    ultimaMensagem: (c: ac.ChamadoDoCliente) => c.mensagens[c.mensagens.length - 1] ?? null,
    rotuloDaSituacao: ac.ROTULO_DA_SITUACAO_DO_CHAMADO,
    contato: area.resumo?.escritorio ?? {},
    atendimento: area.atendimento,
    atualizadoEm: area.resumo?.atualizadoEm ?? '',
    codigos: area.codigos,
    baixando, baixar, irPara, copiarCodigo: (c: string) => copiar(c, 'Código'),
  };
}
