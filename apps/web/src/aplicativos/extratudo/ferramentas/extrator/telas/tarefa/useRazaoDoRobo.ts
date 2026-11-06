// Os razões das contas pelo robô do Alterdata, na Importação (Vitor, 06/11/2026: "quero atrelar essas razões ao robô do
// servidor, ao invés do usuário upar manualmente, puxar automaticamente"; "não vai ter mais a função de diário, apenas razões
// do lançamento"). Um pedido por mês do período na fila do robô (a mesma da página Alterdata da empresa); com todos os meses
// atendidos, os lançamentos lidos viram o razão de todas as contas (no lugar do Diário: as etapas e os botões usam dali).
//   - automático: a empresa na Importação da Tarefa pede sozinha o mês que ainda não tem pedido (uma vez por abertura);
//   - o mês que deu erro só vai de novo pelo botão (o robô pode estar parado; não fica pedindo em laço);
//   - o mesmo conjunto de pedidos não é lido de novo (DiarioLido.pedidos).
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';
import { lerRazaoDoRobo, ouvirPedidosDoRazao, pedirRazaoDoMes, type PedidoDoRazao } from '../../../../dados/razaoDoRobo.firestore';

export type SituacaoDoMes = 'pronto' | 'fila' | 'robo' | 'erro' | 'falta';
export interface MesDoRobo { mes: string; situacao: SituacaoDoMes; pedido: PedidoDoRazao | null }

const rotuloDoMes = (m: string) => m.slice(5, 7) + '/' + m.slice(0, 4);

function situacao(p: PedidoDoRazao | null): SituacaoDoMes {
  if (!p) return 'falta';
  if (p.status === 'pendente') return 'fila';
  if (p.status === 'trabalhando') return 'robo';
  if (p.status === 'pronto' && p.razaoLido) return 'pronto';
  return 'erro';
}

/** ativo: está na Tarefa (pede sozinho); fora dela só mostra e pede pelo botão. */
export function useRazaoDoRobo({ nome, codigo, meses, automatico }: { nome: string; codigo: number | null; meses: readonly string[]; automatico: boolean }) {
  const contabil = useContabilDaEmpresa(nome, codigo);
  const { aviso } = useRetorno();
  const [pedidos, setPedidos] = useState<PedidoDoRazao[] | null>(null);
  const [falha, setFalha] = useState('');
  const [lendo, setLendo] = useState(false);
  const temCodigo = codigo != null && codigo > 0 && meses.length > 0;

  useEffect(() => {
    if (!temCodigo) return;
    setPedidos(null);
    setFalha('');
    return ouvirPedidosDoRazao(codigo, l => { setPedidos(l); setFalha(''); }, e => setFalha(/permission|insufficient/i.test(e.message)
      ? 'sem acesso aos pedidos do robô (só o Contábil e o admin)' : e.message));
  }, [temCodigo, codigo]);

  // o pedido de cada mês: o mais novo que não foi cancelado
  const porMes: MesDoRobo[] = meses.map(mes => {
    const p = pedidos?.find(x => x.competencia === mes && x.status !== 'cancelado') || null;
    return { mes, situacao: situacao(p), pedido: p };
  });
  const carregado = pedidos !== null;
  const andando = porMes.filter(m => m.situacao === 'fila' || m.situacao === 'robo');
  const prontos = porMes.filter(m => m.situacao === 'pronto');

  async function pedir(quais: readonly MesDoRobo[]) {
    if (!codigo) return;
    try {
      for (const m of quais) await pedirRazaoDoMes(codigo, nome, m.mes);
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não deu para pedir ao robô', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  // automático: o mês sem pedido nenhum vai para a fila sozinho (uma vez por empresa e período nesta abertura)
  const jaPediu = useRef('');
  const semPedido = porMes.filter(m => m.situacao === 'falta');
  const chaveDoPedido = automatico && carregado && !falha && semPedido.length ? codigo + '|' + semPedido.map(m => m.mes).join(',') : '';
  useEffect(() => {
    if (!chaveDoPedido || jaPediu.current === chaveDoPedido) return;
    jaPediu.current = chaveDoPedido;
    void pedir(semPedido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDoPedido]);

  // com nada andando e algum mês pronto: lê os lançamentos e guarda como o razão de todas as contas (uma vez por conjunto)
  const idsProntos = prontos.map(m => m.pedido!.id);
  const jaLidos = contabil.diario?.lido.origem === 'robo' ? (contabil.diario.lido.pedidos || []) : null;
  const precisaLer = carregado && !andando.length && prontos.length > 0 && (!jaLidos || jaLidos.join(',') !== idsProntos.join(','));
  const chaveDaLeitura = precisaLer ? idsProntos.join(',') : '';
  const jaLeu = useRef('');
  useEffect(() => {
    if (!chaveDaLeitura || jaLeu.current === chaveDaLeitura) return;
    jaLeu.current = chaveDaLeitura;
    setLendo(true);
    Promise.all(prontos.map(async m => ({ pedido: m.pedido!.id, ...(await lerRazaoDoRobo(m.pedido!)) })))
      .then(lidos => {
        const lido = t.diarioDoRazaoDoRobo(lidos);
        const ms = prontos.map(m => m.mes);
        const arquivo = 'Robô · ' + (ms.length > 1 ? rotuloDoMes(ms[0]) + ' a ' + rotuloDoMes(ms[ms.length - 1]) : rotuloDoMes(ms[0]));
        contabil.usarDiarioLido(arquivo, lido);
      })
      .catch(e => {
        jaLeu.current = '';
        aviso({ tom: 'erro', titulo: 'Não deu para ler o razão do robô', texto: e instanceof Error ? e.message : String(e) });
      })
      .finally(() => setLendo(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaLeitura]);

  return {
    /** sem o código da empresa ou sem o período: o robô não tem o que pedir */
    disponivel: temCodigo,
    carregado, falha, lendo, porMes, andando, prontos,
    /** a barra: a média dos meses (o pronto conta 100) */
    pct: porMes.length ? Math.round(porMes.reduce((s, m) => s + (m.situacao === 'pronto' ? 100 : m.situacao === 'robo' ? m.pedido!.pct : 0), 0) / porMes.length) : 0,
    /** o que o robô está fazendo agora, num mês desta empresa */
    agora: porMes.find(m => m.situacao === 'robo')?.pedido?.etapa || '',
    /** pede de novo os meses que deram erro ou faltam */
    pedirOsQueFaltam: () => pedir(porMes.filter(m => m.situacao === 'erro' || m.situacao === 'falta')),
    /** pede tudo de novo (o razão mudou no Alterdata depois do último pedido) */
    pedirDeNovo: () => pedir(porMes.filter(m => m.situacao !== 'fila' && m.situacao !== 'robo')),
    rotuloDoMes,
  };
}

export type RazaoDoRobo = ReturnType<typeof useRazaoDoRobo>;
