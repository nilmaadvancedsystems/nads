// ViewModel do Atualizar do Lançatudo (19/11/2026: "preciso que tenha a função de atualizar o balancete, ele vai chamar o alterdata
// do servidor e atualizar"). Ouve os pedidos mensais da empresa na fila do robô do Alterdata (a mesma da página Alterdata e da
// Importação): o mais novo do mês que já trouxe o razão é lido e entra no Registro no lugar do razão do Extrator. O botão pede
// de novo (um pedido novo, mesmo havendo um pronto), e a tela mostra o andamento do robô até o razão chegar.
import { tarefas as t } from '@nads/core';
import { useEffect, useState } from 'react';
import { ligadoAoBanco } from '../../../../comum/modoDesenvolvedor';
import { lerRazaoDoRobo, ouvirPedidosDoRazao, pedirRazaoDoMes, type PedidoDoRazao } from '../../dados/razaoDoRobo.firestore';

const ANDANDO = new Set(['pendente', 'pendentePc', 'trabalhando']);
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** a hora do pedido na hora daqui (o banco guarda em UTC) */
const quando = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''); };

// nos dados de exemplo (sem o banco) não há robô nem login do escritório: o Atualizar não aparece
const LIGADO = ligadoAoBanco();

export function useRazaoDoServidor(codigo: number | null, empresa: string, competencia: string, ligado = LIGADO) {
  const [pedidos, setPedidos] = useState<PedidoDoRazao[]>([]);
  const [erro, setErro] = useState('');
  const [pedindo, setPedindo] = useState(false);
  const [lido, setLido] = useState<{ id: string; lancamentos: t.LancamentoDoRobo[] } | null>(null);

  useEffect(() => {
    if (!ligado || !codigo) return;
    return ouvirPedidosDoRazao(codigo, setPedidos, e => setErro(mensagem(e)));
  }, [ligado, codigo]);

  const doMes = pedidos.filter(p => p.competencia === competencia && p.status !== 'cancelado');
  const andando = doMes.find(p => ANDANDO.has(p.status)) || null;
  const pronto = doMes.find(p => p.status === 'pronto' && p.razaoLido) || null;
  const ultimo = doMes[0] || null;

  // o razão do pedido pronto mais novo do mês (uma leitura por pedido)
  useEffect(() => {
    if (!pronto || lido?.id === pronto.id) return;
    let vivo = true;
    lerRazaoDoRobo(pronto).then(r => { if (vivo) setLido({ id: pronto.id, lancamentos: r.lancamentos }); }, e => { if (vivo) setErro(mensagem(e)); });
    return () => { vivo = false; };
  }, [pronto, lido?.id]);

  async function atualizar() {
    if (!codigo || pedindo) return;
    setPedindo(true); setErro('');
    try { await pedirRazaoDoMes(codigo, empresa, competencia, true, true); }
    catch (e) { setErro(mensagem(e)); }
    setPedindo(false);
  }

  const lancamentos = lido && pronto && lido.id === pronto.id ? lido.lancamentos : null;
  const falhou = !andando && ultimo && ultimo.status === 'erro' ? ultimo.erro || 'o robô não conseguiu gerar o razão' : '';
  const texto = pedindo ? 'Pedindo ao robô do Alterdata…'
    : andando ? (andando.esperandoContabil ? 'Na fila: ' + andando.esperandoContabil : (andando.etapa || 'O robô do Alterdata está gerando o razão') + (andando.pct ? ' · ' + andando.pct + '%' : ''))
    : erro ? 'Não deu para atualizar: ' + erro
    : falhou ? 'O robô não trouxe o razão: ' + falhou
    : pronto ? 'Razão do Alterdata de ' + quando(pronto.criadoEm)
    : '';
  return {
    disponivel: ligado && !!codigo,
    andando: pedindo || !!andando, pct: andando?.pct || 0,
    texto, comErro: !!(erro || falhou) && !andando,
    /** o razão do mês que o robô trouxe (null = ainda não tem) */
    lancamentos,
    atualizar: () => { void atualizar(); },
  };
}
