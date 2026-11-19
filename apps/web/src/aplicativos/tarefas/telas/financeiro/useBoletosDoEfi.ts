// ViewModel do boleto com Pix pelo Efí em Financeiro › Boletos (19/11/2026, fase 2 das APIs dos bancos): quantos clientes do
// mês ainda podem ter o boleto emitido, o Emitir pelo Efí (pergunta, junta os e-mails de cada cliente e grava os pedidos no
// contrato; o robô robo/boletos-efi.js emite e põe o boleto com o PDF na lista desta tela) e a situação dos pedidos que
// ainda não viraram boleto da lista (pedidos, com erro, de teste da homologação).
import { financeiro, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useBoletos, useHonorarios } from '../../dados/repo';
import { dataBr, hoje } from './formatosDaNota';

export function useBoletosDoEfi(competencia: string, noLote: ReadonlySet<string>) {
  const honorarios = useHonorarios();
  const boletos = useBoletos();
  const { toast, modal } = useRetorno();
  const operador = useOperador().operador?.nome || '';
  const contratos = honorarios.contratos().lista;
  const recebimentos = honorarios.recebimentos().lista;
  const cfg = honorarios.configDoBoleto().config;
  const [pedindo, setPedindo] = useState(false);

  const recebimentoDe = (id: string) => recebimentos.find(r => r.contratoId === id && r.competencia === competencia) ?? null;
  // quem já tem boleto no lote do mês (o PDF subido ou o do Efí) não ganha outro
  const podem = contratos.filter(c => !noLote.has(c.id) && !financeiro.porQueNaoEmitir(c, competencia, recebimentoDe(c.id)));
  const doMes = contratos.flatMap(c => { const b = c.boletosEfi?.[competencia]; return b ? [{ contrato: c, boleto: b }] : []; });
  const andando = doMes.filter(x => x.boleto.status === 'pedido' || x.boleto.status === 'emitindo').length;
  const erros = doMes.filter(x => x.boleto.status === 'erro' || (x.boleto.status === 'emitido' && x.boleto.erro))
    .map(x => ({ nome: x.contrato.nome, erro: x.boleto.erro || 'erro sem descrição' }));
  const testes = doMes.filter(x => x.boleto.status === 'emitido' && x.boleto.ambiente === 'homologacao').length;

  async function emitir() {
    if (!podem.length || pedindo) return;
    const dia = hoje();
    const ajustados = podem.filter(c => financeiro.vencimentoDoHonorario(competencia, financeiro.diaDoContrato(c, cfg), dia).ajustado).length;
    const total = podem.reduce((t, c) => t + c.valor, 0);
    const um = podem.length === 1;
    const ok = await modal<boolean>({
      icone: 'recibo', titulo: um ? 'Emitir o boleto pelo Efí?' : 'Emitir ' + podem.length + ' boletos pelo Efí?',
      texto: (um ? podem[0].nome + ' · ' + formatos.reais(podem[0].valor) + ', vencimento em ' + dataBr(financeiro.vencimentoDoHonorario(competencia, financeiro.diaDoContrato(podem[0], cfg), dia).vencimento) + '.'
        : formatos.reais(total) + ' em boletos de ' + financeiro.competenciaBr(competencia) + ', cada um no dia de vencimento do cliente (sem o dia, o ' + cfg.diaPadrao + ').')
        + (ajustados ? ' ' + (um ? 'O dia já passou: vence em 3 dias.' : ajustados + ' com o dia já passado vencem em 3 dias.') : '')
        + ' Saem com o QR do Pix' + (cfg.multa || cfg.jurosAoMes ? ', multa de ' + String(cfg.multa).replace('.', ',') + '% e juros de ' + String(cfg.jurosAoMes).replace('.', ',') + '% ao mês' : ', sem multa e juros')
        + ' e entram nesta lista para o disparo.' + (honorarios.exemplos ? ' Estes são dados de exemplo: nada vai para o Efí.' : ''),
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: um ? 'Emitir' : 'Emitir ' + podem.length, valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    setPedindo(true);
    try {
      const agora = new Date().toISOString();
      const pedidos = await Promise.all(podem.map(async c => ({
        contratoId: c.id, competencia,
        boleto: financeiro.pedidoDeBoleto(c, competencia, cfg, dia, await boletos.emailsDoContrato(c).catch(() => []), operador, agora),
      })));
      await honorarios.pedirBoletos(pedidos);
      toast((um ? 'Boleto pedido' : podem.length + ' boletos pedidos') + ': o robô emite no Efí em instantes.');
    } catch (e) { toast('Não consegui pedir os boletos. ' + (e instanceof Error ? e.message : '')); }
    finally { setPedindo(false); }
  }

  return {
    /** quantos clientes do mês podem ter o boleto emitido (ativos, com valor e documento, em aberto, sem boleto no Efí nem no lote) */
    podem: podem.length,
    pedindo, emitir: () => void emitir(),
    /** a faixa da situação (null = nada a dizer) */
    situacao: andando || erros.length || testes ? { andando, erros, testes } : null,
  };
}
