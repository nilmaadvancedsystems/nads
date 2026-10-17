// ViewModel de Guias e obrigações (Vitor, 16/10/2026, a "Agenda de tributos e obrigações" do protótipo): o mês escolhido
// e, nele, as três colunas — os próximos vencimentos (as guias para pagar, com baixar e copiar a linha digitável), o que
// foi quitado (com o comprovante) e os avisos da contabilidade (os recados do escritório e o certificado digital); embaixo,
// a agenda do que o escritório entrega no mês.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { chaveDoMes, situacaoDoCertificado } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

/** 'dd/mm/aaaa' → 'aaaa-mm' */
const mesDaData = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5);

export function useGuias({ token, area, hoje, irPara, copiar }: DaCasca) {
  const { toast } = useRetorno();
  const [baixando, setBaixando] = useState('');
  const [mes, setMes] = useState(chaveDoMes(hoje));
  // até o mês que vem (o robô monta a agenda um mês na frente)
  const ultimo = chaveDoMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));
  const guias = ac.guiasDeHoje(area.guias, hoje).filter(g => mesDaData(g.vencimento) === mes);
  const pagas = area.pagas.filter(p => mesDaData(p.pagoEm) === mes);
  // o que o escritório entrega no mês; o "não se aplica" não aparece para o cliente
  const agenda: ac.ItemDaAgenda[] = (area.agenda.find(a => a.mes === mes)?.itens ?? []).filter(i => i.situacao !== 'nao se aplica').sort((x, y) => x.vence.localeCompare(y.vence));

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  async function comprovante(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarComprovante(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('O comprovante ainda não chegou. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  return {
    mes, mudarMes: setMes, ultimo,
    guias, codigos: area.codigos, baixando, baixar, copiarCodigo: (c: string) => copiar(c, 'Código'),
    pagas, comprovante,
    certificado: area.certificado ? { ...area.certificado, ...situacaoDoCertificado(area.certificado, hoje) } : null,
    avisos: area.avisos, irPara, agenda,
    // "em 4 dias", "há 5 dias"; no dia, nada (o selo já diz "Vence hoje")
    faltam: (g: ac.GuiaDoCliente) => {
      const venc = ac.dataDoVencimento(g.vencimento);
      if (!venc) return '';
      const dias = Math.round((new Date(venc.getFullYear(), venc.getMonth(), venc.getDate()).getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) / 86_400_000);
      return dias > 0 ? 'em ' + dias + (dias === 1 ? ' dia' : ' dias') : dias < 0 ? 'há ' + -dias + (dias === -1 ? ' dia' : ' dias') : '';
    },
  };
}
