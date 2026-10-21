// ViewModel da Saúde do banco (o site do admin): o placar e as linhas da saúde (entregas.saudeDoBanco), a última gravação de
// cada robô e de cada medição, o tamanho das filas (do painel do robô), as coleções (o tamanho e o quanto cresceram em 7
// dias), os documentos órfãos e os pedidos que deram erro. De onde vem: o robo/uso e a saúde do robô (a cada 30 s, só com a
// aba visível), o painel do robô (ao vivo) e o resumo diário robo/saudeBanco (o robô da nuvem, uma vez por dia).
import { entregas } from '@nads/core';
import { useEffect, useState } from 'react';
import { usePainelRobo, useSaudeDoRobo } from '../../../tarefas/dados/repo';
import { caminhoDoAdmin } from '../../casca/navegacao';
import { useResumoDoBanco } from '../../dados/repo';
import { sinaisDoBanco } from '../sinais';

const NOMES_DOS_PEDIDOS: Record<string, string> = {
  um: 'Cobrança', lote: 'Cobrança em lote', disparo: 'Disparo', responder: 'Resposta', salvar: 'Salvar no Drive', verificar: 'Leitura do Gmail',
};

export function useSaudeDoBanco() {
  const painel = usePainelRobo();
  const saude = useSaudeDoRobo();
  const banco = useResumoDoBanco();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const r = setInterval(() => setAgora(Date.now()), 15 * 1000); return () => clearInterval(r); }, []);
  const [todas, setTodas] = useState(false);

  const r = banco.resumo;
  const filas = entregas.filasDoPainel(painel.pc, painel.vm, agora);
  const sinais = sinaisDoBanco(painel, saude, r, agora);
  const itens = entregas.saudeDoBanco({ resumo: r, uso: entregas.lerUsoDeHoje(saude?.uso), sinais, filas, errosDaFila: saude?.erros || [] }, agora);
  const problemas = itens.filter(i => i.tom === 'erro' || i.tom === 'aviso');
  const colecoes = r ? entregas.colecoesQueCrescem(r.colecoes) : [];
  const erros = (saude?.erros || []).filter(x => Number.isFinite(Date.parse(x.em)) && agora - Date.parse(x.em) < 7 * 864e5).sort((a, b) => b.em.localeCompare(a.em));

  return {
    carregando: !saude || !banco.carregado || !painel.carregado,
    exemplos: banco.exemplos,
    semPermissao: banco.semPermissao,
    agora,
    itens,
    problemas: problemas.length,
    /** o resumo diário: quando foi feito, quanto gastou e o que não deu para medir */
    resumo: r ? {
      quando: entregas.quandoNoPainel(r.em, agora),
      leituras: r.leiturasGastas.toLocaleString('pt-BR'),
      segundos: Math.round(r.duracaoMs / 1000),
      erros: r.erros,
    } : null,
    sinais,
    filas: filas.filter(f => f.esperando + f.andamento > 0),
    filasVazias: filas.filter(f => f.esperando + f.andamento === 0).length,
    /** as coleções: as que mais cresceram primeiro; 10 de cada vez (Ver todas abre o resto) */
    colecoes: (todas ? colecoes : colecoes.slice(0, 10)).map(c => ({
      ...c, totalTexto: c.total.toLocaleString('pt-BR'),
      ha7diasTexto: c.ha7dias === null ? '—' : c.ha7dias.toLocaleString('pt-BR'),
      cresceuTexto: c.cresceu === null ? '—' : (c.cresceu > 0 ? '+' : '') + c.cresceu.toLocaleString('pt-BR') + (c.pct !== null && c.cresceu ? ' (' + (c.pct > 0 ? '+' : '') + c.pct + '%)' : ''),
    })),
    totalDeColecoes: colecoes.length,
    todas, alternarTodas: () => setTodas(t => !t),
    orfaos: r?.orfaos || [],
    /** os pedidos ao robô que deram erro (solicitacoesEmail, os últimos 7 dias) */
    pedidosComErro: erros.slice(0, 10).map(x => ({ ...x, nome: NOMES_DOS_PEDIDOS[x.tipo] || x.tipo || 'Pedido', quando: entregas.quandoNoPainel(x.em, agora) })),
    caminhoDoRobo: caminhoDoAdmin('robo'),
    caminhoDaCota: caminhoDoAdmin('cota'),
  };
}
