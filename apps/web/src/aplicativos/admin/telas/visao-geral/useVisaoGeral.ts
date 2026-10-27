// ViewModel da Visão geral do site do admin: o resumo do que precisa de atenção, cada bloco com o caminho para a página
// dele. Os robôs ligados ou parados, os erros das últimas 24 h e as filas atrasadas vêm do painel do robô (robo/painelPC,
// robo/painelVM e roboAtividade, ao vivo); os feedbacks novos de prioridade alta, dos feedbacks; a saúde do banco, do
// robo/uso (o consumo de hoje), da saúde do robô (os pedidos com erro, os sinais) e do resumo diário (robo/saudeBanco).
// O relógio anda a cada 15 s para o "há X min" não parar.
import { entregas } from '@nads/core';
import { useEffect, useState } from 'react';
import { useFeedback, usePainelRobo, useSaudeDoRobo } from '../../../tarefas/dados/repo';
import { caminhoDoAdmin } from '../../casca/navegacao';
import { useResumoDoBanco } from '../../dados/repo';
import { sinaisDoBanco } from '../sinais';

export function useVisaoGeral() {
  const painel = usePainelRobo();
  const saude = useSaudeDoRobo();
  const banco = useResumoDoBanco();
  const feedbacks = useFeedback().todos();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const r = setInterval(() => setAgora(Date.now()), 15 * 1000); return () => clearInterval(r); }, []);

  const robos = [entregas.situacaoDoRobo('pc', painel.pc, painel.sinais.pc, agora), entregas.situacaoDoRobo('vm', painel.vm, painel.sinais.vm, agora)];
  const erros = entregas.errosRecentes(painel.atividades, agora);
  const filas = entregas.filasDoPainel(painel.pc, painel.vm, agora);
  const atrasadas = filas.filter(f => f.tom === 'aviso' || f.tom === 'erro');
  const novos = feedbacks.lista.filter(f => f.status === 'novo');
  const altos = novos.filter(f => f.prioridade === 'alta').sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const sinais = sinaisDoBanco(painel, saude, banco.resumo, agora);
  const itens = entregas.saudeDoBanco({ resumo: banco.resumo, uso: entregas.lerUsoDeHoje(saude?.uso), sinais, filas, errosDaFila: saude?.erros || [] }, agora);
  const problemas = itens.filter(i => i.tom === 'erro' || i.tom === 'aviso');
  const ligados = robos.filter(r => r.tom === 'ok').length;
  // o que está HOJE em NÃO IDENTIFICADOS (a mesma conta da aba Para resolver; sem o robô atualizado, "—")
  const paraResolver = painel.pc?.paraResolver ?? null;

  return {
    carregando: !painel.carregado,
    carregandoFeedbacks: !feedbacks.carregados,
    carregandoBanco: !saude || !banco.carregado,
    exemplos: painel.exemplos,
    agora,
    robos,
    /** os números do topo: cada um com o tom e a página que abre */
    numeros: [
      { id: 'robos', rotulo: 'Robôs ligados', valor: ligados + ' de ' + robos.length, tom: ligados === robos.length ? 'ok' : robos.some(r => r.tom === 'erro') ? 'erro' : 'aviso', icone: 'robo', pagina: 'robo' },
      { id: 'erros', rotulo: 'Erros em 24 h', valor: String(erros.length), tom: erros.length ? 'erro' : 'ok', icone: 'alert', pagina: 'robo' },
      { id: 'filas', rotulo: 'Filas atrasadas', valor: String(atrasadas.length), tom: atrasadas.some(f => f.tom === 'erro') ? 'erro' : atrasadas.length ? 'aviso' : 'ok', icone: 'clock', pagina: 'robo' },
      { id: 'resolver', rotulo: 'Para resolver agora', valor: paraResolver ? (paraResolver.agora ? paraResolver.agora.toLocaleString('pt-BR') : 'Nada') : '—', tom: paraResolver && paraResolver.agora ? 'aviso' : 'ok', icone: paraResolver && paraResolver.agora ? 'alert' : 'checkCircle', pagina: 'arquivador' },
      { id: 'feedbacks', rotulo: 'Feedbacks altos novos', valor: String(altos.length), tom: altos.length ? 'aviso' : 'ok', icone: 'mensagem', pagina: 'feedbacks' },
      { id: 'banco', rotulo: 'Banco: itens de atenção', valor: String(problemas.length), tom: problemas.some(i => i.tom === 'erro') ? 'erro' : problemas.length ? 'aviso' : 'ok', icone: 'escudo', pagina: 'banco' },
    ] as const,
    erros: erros.slice(0, 3),
    errosNas24h: erros.length,
    atrasadas,
    feedbacksAltos: altos.slice(0, 4).map(f => ({
      id: f.id, nome: f.nome || f.email || '—', texto: f.texto, tela: f.tela,
      quando: f.criadoEm ? new Date(f.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
    })),
    feedbacksAltosTotal: altos.length,
    feedbacksNovos: novos.length,
    /** a saúde do banco: só o que precisa de atenção (tudo certo: o placar verde) */
    saudeDoBanco: problemas,
    saudeDoBancoTotal: itens.length,
    caminho: caminhoDoAdmin,
  };
}
