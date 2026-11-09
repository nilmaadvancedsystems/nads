// Os razões das contas pelo robô do Alterdata, na Importação (Vitor, 06/11/2026: "quero atrelar essas razões ao robô do
// servidor, ao invés do usuário upar manualmente, puxar automaticamente"; "não vai ter mais a função de diário, apenas razões
// do lançamento"). Um pedido por mês do período na fila do robô (a mesma da página Alterdata da empresa); com todos os meses
// atendidos, os lançamentos lidos viram o razão de todas as contas (no lugar do Diário: as etapas e os botões usam dali).
//   - automático: a empresa na Importação da Tarefa pede sozinha o mês que ainda não tem pedido (uma vez por abertura);
//   - antes de criar, o pedido já andando (ou pronto há pouco) do mesmo mês é reaproveitado (várias abas não duplicam);
//   - o mês que deu erro só vai de novo pelo botão (o robô pode estar parado; não fica pedindo em laço);
//   - o mesmo conjunto de pedidos não é lido de novo (DiarioLido.pedidos).
import { clientes as cl, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { erroDeAmbiente, vagasDePedidoSozinho } from '../../../../dados/razaoDoRobo.regras';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';
import { lerBalanceteDoRobo, lerRazaoDoRobo, ouvirPedidosDoRazao, pedirRazaoDoMes, type PedidoDoRazao } from '../../../../dados/razaoDoRobo.firestore';

export type SituacaoDoMes = 'pronto' | 'fila' | 'robo' | 'erro' | 'falta';
export interface MesDoRobo { mes: string; situacao: SituacaoDoMes; pedido: PedidoDoRazao | null }

// os pedidos que este navegador fez sozinho (o teto por hora; o botão não conta nem é barrado)
const pedidosSozinho: number[] = [];

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
  const [avisoDoBalancete, setAvisoDoBalancete] = useState('');
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

  async function pedir(quais: readonly MesDoRobo[], novoDeProposito = false, sozinho = false) {
    if (!codigo) return;
    try {
      for (const m of quais) {
        if (sozinho && vagasDePedidoSozinho(pedidosSozinho, Date.now()) <= 0) break;
        const r = await pedirRazaoDoMes(codigo, nome, m.mes, novoDeProposito);
        if (sozinho && !r.reaproveitado) pedidosSozinho.push(Date.now());
      }
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não deu para pedir ao robô', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  // automático: o mês sem pedido nenhum vai para a fila sozinho (uma vez por empresa e período nesta abertura)
  const jaPediu = useRef('');
  const semPedido = porMes.filter(m => m.situacao === 'falta');
  // mês com erro (ex.: o Contábil do servidor fora): não pede sozinho; mostra a mensagem e espera o botão
  const comErro = porMes.some(m => m.situacao === 'erro');
  const chaveDoPedido = automatico && carregado && !falha && !comErro && semPedido.length ? codigo + '|' + semPedido.map(m => m.mes).join(',') : '';
  useEffect(() => {
    if (!chaveDoPedido || jaPediu.current === chaveDoPedido) return;
    jaPediu.current = chaveDoPedido;
    void pedir(semPedido, false, true);
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

  // o balancete dinâmico que o robô puxou (Vitor, 09/11/2026: "não importa no nads os dados extraidos"): com todos os meses
  // prontos, entra no balancete dinâmico da Tarefa. O que alguém importou à mão (ou no Clientes) continua valendo.
  const todosProntos = carregado && !!porMes.length && prontos.length === porMes.length;
  const semBalancete = todosProntos ? prontos.filter(m => !m.pedido!.balanceteLido) : [];
  const dinamicoAtual = contabil.dinamico;
  const podeUsar = !dinamicoAtual || !!dinamicoAtual.pedidos;
  const chaveDoDinamico = todosProntos && !semBalancete.length && podeUsar && (dinamicoAtual?.pedidos || []).join(',') !== idsProntos.join(',') ? idsProntos.join(',') : '';
  const jaLeuDinamico = useRef('');
  useEffect(() => {
    if (!chaveDoDinamico || jaLeuDinamico.current === chaveDoDinamico) return;
    jaLeuDinamico.current = chaveDoDinamico;
    setAvisoDoBalancete('');
    Promise.all(prontos.map(async m => ({ mes: m.mes, contas: await lerBalanceteDoRobo(m.pedido!) })))
      .then(lidos => {
        const antigos = lidos.filter(l => !l.contas.length).map(l => rotuloDoMes(l.mes));
        if (antigos.length) { setAvisoDoBalancete('O balancete de ' + antigos.join(', ') + ' veio no formato antigo: peça de novo ao robô.'); return; }
        const { d, incertos } = cl.dinamicoDoRobo(lidos);
        const ms = prontos.map(m => m.mes);
        contabil.usarDinamico('Robô · ' + (ms.length > 1 ? rotuloDoMes(ms[0]) + ' a ' + rotuloDoMes(ms[ms.length - 1]) : rotuloDoMes(ms[0])), d, idsProntos);
        if (incertos) setAvisoDoBalancete(incertos + (incertos === 1 ? ' conta sem movimento ficou' : ' contas sem movimento ficaram') + ' com o sinal do grupo: confira se o saldo parecer invertido.');
      })
      .catch(e => { jaLeuDinamico.current = ''; setAvisoDoBalancete('Não consegui ler o balancete do robô: ' + (e instanceof Error ? e.message : String(e))); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDoDinamico]);
  const faltaBalancete = semBalancete.length && podeUsar
    ? 'O balancete de ' + semBalancete.map(m => rotuloDoMes(m.mes)).join(', ') + ' não veio' + (semBalancete[0].pedido!.erroDoBalancete ? ': ' + semBalancete[0].pedido!.erroDoBalancete : '') + '.' : '';

  return {
    /** o que deu errado (ou pede atenção) no balancete dinâmico do robô */
    avisoDoBalancete: faltaBalancete || avisoDoBalancete,
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
    pedirDeNovo: () => pedir(porMes.filter(m => m.situacao !== 'fila' && m.situacao !== 'robo'), true),
    /** a fila segurou os pedidos porque o Contábil do servidor não responde (a mensagem dela) */
    espera: porMes.find(m => m.situacao === 'fila' && m.pedido?.esperandoContabil)?.pedido?.esperandoContabil || '',
    /** algum mês falhou por causa do ambiente do robô (não do pedido) */
    erroDeAmbiente: porMes.some(m => m.situacao === 'erro' && erroDeAmbiente(m.pedido?.erro || '')),
    rotuloDoMes,
  };
}

export type RazaoDoRobo = ReturnType<typeof useRazaoDoRobo>;
