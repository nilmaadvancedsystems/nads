// ViewModel da Visão geral da Área do Cliente (Vitor, 16/10/2026). "Melhora mais" de 17/10/2026 ("procura na net exemplos
// de portal de cliente"), no padrão dos portais das contabilidades (Assembly, TaxDome, a "Visão do Cliente" do Omie):
// o veredito com o que precisamos do cliente (dados/visaoGeral.ts), as guias do momento com o resumo do pagamento (quanto,
// até quando e como), a atividade recente e o envio rápido. Os quatro números saíram: o veredito diz a situação, o resumo
// do pagamento diz quanto, e cada um leva à ação no lugar dele.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { chaveDoMes } from '../dados/regras';
import { atividadeRecente, guiasDoMomento, pendenciasDoCliente, quandoFoi, vereditoDoMes, type AcaoDaPendencia } from '../dados/visaoGeral';
import type { DaCasca } from './useAreaCliente';

/** 'dd/mm/aaaa' → 'aaaa-mm' */
const mesDaData = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5);

export function useInicio({ token, area, hoje, irPara, copiar }: DaCasca, abrirEnvio: () => void) {
  const { toast } = useRetorno();
  const [baixando, setBaixando] = useState('');
  const guias = guiasDoMomento(area.guias, hoje);
  const mes = chaveDoMes(hoje);
  const pendencias = pendenciasDoCliente(area, hoje);
  const veredito = vereditoDoMes(pendencias, guias);
  const aVencer = guias.filter(g => g.situacao !== 'vencida');
  const pagasDoMes = area.secoes.pagas ? area.pagas.filter(p => mesDaData(p.pagoEm) === mes) : [];

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  /** a guia vencida não passa no banco: o chamado "Pedir um documento" já com o título */
  const pedirGuiaNova = (titulo: string) => irPara('chamados', { novoChamado: { tipo: 'documento', titulo } });

  function agir(a: AcaoDaPendencia) {
    switch (a.tipo) {
      case 'baixar-guia': void baixar(a.guia); break;
      case 'pedir-guia': pedirGuiaNova(a.titulo); break;
      case 'ver-chamado': irPara('chamados', { chamado: a.chamado }); break;
      case 'pedir-renovacao': irPara('chamados', { novoChamado: { tipo: 'documento', titulo: 'Renovação do certificado digital' } }); break;
      case 'enviar': abrirEnvio(); break;
      case 'ir': irPara(a.aba); break;
    }
  }

  // em dias até o vencimento (negativo: já venceu)
  const diasAte = (g: ac.GuiaDoCliente) => {
    const v = ac.dataDoVencimento(g.vencimento);
    if (!v) return 0;
    return Math.round((new Date(v.getFullYear(), v.getMonth(), v.getDate()).getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) / 86_400_000);
  };
  const faltam = (g: ac.GuiaDoCliente) => { const d = diasAte(g); return d > 0 ? 'em ' + d + (d === 1 ? ' dia' : ' dias') : ''; };
  const proxima = aVencer[0] ?? null;
  const atualizado = area.resumo?.atualizadoEm ? quandoFoi(area.resumo.atualizadoEm, hoje) : '';

  return {
    // a sobrelinha do veredito: o mês e quando o escritório atualizou ("Outubro de 2026 · atualizado hoje, 07:30")
    sobre: formatos.capital(hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })) + (atualizado ? ' · atualizado ' + (/^\d/.test(atualizado) ? 'em ' : '') + atualizado : ''),
    veredito, pendencias, agir,
    // as pagas do mês (as mesmas do "Já pago no mês")
    guias, pagas: pagasDoMes,
    // o resumo do pagamento: só quando tem guia por vencer (a vencida já está no veredito)
    resumo: aVencer.length ? {
      aPagar: aVencer.reduce((s, g) => s + g.valor, 0), quantas: aVencer.length,
      proximo: proxima ? proxima.vencimento.slice(0, 5) : '', faltam: proxima ? faltam(proxima) : '',
      pago: area.secoes.pagas ? { valor: pagasDoMes.reduce((s, p) => s + p.valor, 0), quantas: pagasDoMes.length } : undefined,
    } : null,
    // o Baixar carmim só quando o veredito não tem botão carmim (tudo em dia): a próxima guia a pagar
    destaque: pendencias.length === 0 ? proxima?.id ?? '' : '',
    temCodigo: guias.some(g => !!area.codigos[g.id]),
    faltam,
    atividade: atividadeRecente(area, new Date()).map(a => ({ ...a, quando: quandoFoi(a.em, hoje) })),
    baixarComprovante: async (id: string) => {
      const pdf = await repoAreaCliente.baixarComprovante(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('O comprovante ainda não chegou.');
    },
    codigos: area.codigos,
    baixando, baixar, pedirGuiaNova, irPara, copiarCodigo: (c: string) => copiar(c, 'Código'),
  };
}
