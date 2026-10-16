// ViewModel da janela do cliente no Painel (16/10/2026, a entrega de documentos trazida do Entregas): as entregas do
// cliente — as do mês ao vivo e as dos outros meses (o histórico, numa leitura) —, a mais nova primeiro; a escolhida mostra
// os documentos, quem recebeu, quem entregou, quando, o motivo (não entregue) e o comprovante (a assinatura e a foto). As
// ações: Enviar comprovante pelo WhatsApp (o texto pronto, para o telefone do cadastro), Confirmar (a que ainda está na
// rota), Excluir (o admin; ou quem pôs, enquanto está na rota) e Nova entrega para o cliente.
import { entregas, extrator, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useCallback, useEffect, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useEntregasDeDocumentos } from '../../dados/repo';
import type { ComprovanteDaEntrega } from '../../dados/entregasDeDocumentos';

export function useJanelaDoCliente(linha: entregas.LinhaDoPainel, competencia: string, fechar: () => void) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const { operador } = useOperador();
  const cliente = linha.cliente;
  const avulsaId = cliente ? null : linha.entregas[0]?.id || null;
  const doMes = repo.doMes(competencia);
  const [historico, setHistorico] = useState<entregas.Entrega[] | null>(cliente ? null : []);
  const [escolhida, setEscolhida] = useState<string | null>(linha.entregas[0]?.id || null);
  const [comprovante, setComprovante] = useState<ComprovanteDaEntrega | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [nova, setNova] = useState(false);

  const lerHistorico = useCallback(() => {
    if (!cliente) return;
    repo.doCliente(cliente.id).then(setHistorico).catch(() => setHistorico([]));
  }, [cliente, repo]);
  useEffect(() => { lerHistorico(); }, [lerHistorico]);

  // as do mês (ao vivo) por cima das do histórico (a leitura pode estar velha para o mês aberto)
  const doMesDoCliente = doMes.lista.filter(e => (cliente ? e.clienteId === cliente.id : e.id === avulsaId));
  const ids = new Set(doMesDoCliente.map(e => e.id));
  const todas = entregas.maisNovaPrimeiro([...doMesDoCliente, ...(historico || []).filter(e => !ids.has(e.id) && e.competencia !== competencia)]);
  const atual = todas.find(e => e.id === escolhida) || todas[0] || null;
  const atualId = atual?.id || null;
  const temComprovante = !!atual && (atual.temAssinatura || atual.temFoto);

  useEffect(() => {
    setComprovante(null);
    if (!atualId || !temComprovante) return;
    let vivo = true;
    repo.comprovante(atualId).then(c => { if (vivo) setComprovante(c); }).catch(() => { if (vivo) setComprovante({ assinatura: '', foto: '' }); });
    return () => { vivo = false; };
  }, [atualId, temComprovante, repo]);

  const quem = repo.quem();
  const texto = atual ? entregas.textoDoComprovante(atual, t.rotuloCompetencia, formatos.reais, formatos.dataHora) : '';

  return {
    titulo: cliente ? entregas.rotuloDoCliente(cliente) : linha.nome,
    cliente,
    carregandoHistorico: historico === null,
    todas: todas.map(e => {
      const s = entregas.situacaoDaEntrega(e);
      return { e, competencia: t.rotuloCompetencia(e.competencia || '2026-01'), quando: formatos.dataHora(entregas.quandoFoi(e)), situacao: entregas.rotuloDaSituacao(s, e), documentos: entregas.textoDosItens(e.itens) };
    }),
    atual,
    escolher: setEscolhida,
    competenciaDaAtual: atual ? t.rotuloCompetencia(atual.competencia || '2026-01') : '',
    situacaoDaAtual: atual ? entregas.rotuloDaSituacao(entregas.situacaoDaEntrega(atual), atual) : null,
    total: atual ? entregas.totalDosItens(atual.itens) : 0,
    reais: formatos.reais,
    quando: atual ? formatos.dataHora(entregas.quandoFoi(atual)) : '',
    temComprovante,
    comprovante,
    /** o WhatsApp com o comprovante pronto (o telefone do cadastro; sem telefone, a pessoa escolhe o contato) */
    linkDoWhatsApp: atual && atual.status === 'confirmada' ? extrator.linkDoWhatsApp(cliente?.telefone || '', texto) : '',
    naRota: !!atual && (atual.status === 'pendente'),
    confirmando, abrirConfirmacao: () => setConfirmando(atualId), fecharConfirmacao: () => setConfirmando(null),
    nova, setNova,
    podeExcluir: !!atual && entregas.podeExcluir(atual, { admin: !!operador?.admin, email: quem?.email || '' }),
    excluindo,
    async excluir() {
      if (!atual) return;
      const naRota = atual.status === 'pendente' || atual.status === 'link';
      const sim = await retorno.modal({
        icone: 'alert', titulo: naRota ? 'Tirar da rota?' : 'Excluir esta entrega?',
        texto: naRota ? 'A parada é excluída (com a guia anexada).' : 'A entrega e o comprovante saem do histórico do cliente. Não dá para desfazer.',
        botoes: [{ rotulo: naRota ? 'Tirar da rota' : 'Excluir', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false }],
      });
      if (!sim) return;
      setExcluindo(true);
      try {
        await repo.excluir(atual);
        retorno.aviso({ tom: 'ok', titulo: naRota ? 'Saiu da rota' : 'Entrega excluída', texto: atual.clienteNome });
        setHistorico(h => (h ? h.filter(e => e.id !== atual.id) : h));
        setEscolhida(null);
        if (!cliente) fechar();
      } catch (e) {
        retorno.aviso({ tom: 'erro', titulo: 'Não consegui excluir', texto: (e as Error).message });
      } finally {
        setExcluindo(false);
      }
    },
  };
}
