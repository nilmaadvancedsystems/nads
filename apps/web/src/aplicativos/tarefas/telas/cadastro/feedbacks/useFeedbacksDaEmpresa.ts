// ViewModel dos feedbacks de uma empresa (Vitor, 19/10/2026): a lista (abertos primeiro, da prioridade alta para a baixa),
// o formulário curto do feedback novo e as ações de quem pode (resolver, reabrir e apagar pedem o autor, o diretor ou o
// admin; escrever, o sênior, o diretor ou o admin). As mesmas travas estão nas regras do banco.
import { empresas, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../../casca/operador';
import { useFeedbacksDaEmpresa as useRepoDeFeedbacks } from '../../../dados/repo';
import type { LinhaDoFeedback } from './partes/BlocoDeFeedbacks';

const fb = empresas.feedbacks;
const dataBr = (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useFeedbacksDaEmpresa(empresa: { nome: string; codigo: number | null }) {
  const repo = useRepoDeFeedbacks();
  const op = useOperador().operador;
  const { toast, modal } = useRetorno();
  const id = formatos.slug(empresa.nome);
  const vivo = repo.daEmpresa(id);
  const eu = repo.eu();
  const quem: empresas.feedbacks.QuemMexe | null = op ? { uid: eu?.uid || '', nivel: op.nivel, admin: op.admin } : null;
  const [texto, setTexto] = useState('');
  const [prioridade, setPrioridade] = useState<empresas.feedbacks.Prioridade>('media');
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const ordenados = fb.ordenarFeedbacks(vivo.lista);
  const linhas: LinhaDoFeedback[] = ordenados.map(f => ({
    id: f.id, texto: f.texto, prioridade: f.prioridade, autor: f.autorNome, data: dataBr(f.criadoEm), resolvido: f.resolvido,
    resolucao: f.resolvido ? 'Resolvido' + (f.resolvidoPor ? ' por ' + f.resolvidoPor : '') + (f.resolvidoEm ? ' em ' + dataBr(f.resolvidoEm) : '') + '.' : '',
    podeMexer: fb.podeResolver(f, quem),
  }));

  async function trabalhar(idDoFeedback: string, f: () => Promise<void>, falhou: string) {
    if (ocupado) return;
    setOcupado(idDoFeedback);
    try { await f(); } catch (e) { toast(falhou + ' ' + motivo(e)); } finally { setOcupado(null); }
  }

  return {
    linhas,
    abertos: ordenados.filter(f => !f.resolvido).length,
    carregando: !vivo.carregada,
    erro: vivo.erro,
    podeEscrever: fb.podeEscrever(op),
    texto, setTexto,
    prioridade, setPrioridade,
    enviando,
    ocupado,
    async enviar() {
      if (enviando) return;
      const erro = fb.erroDoFeedback(texto, prioridade);
      if (erro) { toast(erro); return; }
      setEnviando(true);
      try {
        await repo.enviar({ empresa: id, codigo: empresa.codigo, texto: fb.textoDoFeedback(texto), prioridade });
        setTexto('');
        setPrioridade('media');
        toast('Feedback enviado para a equipe.');
      } catch (e) {
        toast('Não deu para enviar o feedback. ' + motivo(e));
      } finally {
        setEnviando(false);
      }
    },
    resolver: (idDoFeedback: string, resolvido: boolean) => trabalhar(idDoFeedback,
      async () => { await repo.resolver(idDoFeedback, resolvido); toast(resolvido ? 'Feedback resolvido.' : 'Feedback reaberto.'); },
      'Não deu para ' + (resolvido ? 'resolver' : 'reabrir') + ' o feedback.'),
    async apagar(idDoFeedback: string) {
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Apagar este feedback?', texto: 'Ele some para toda a equipe. Para guardar o registro, marque como resolvido.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-danger' }] });
      if (ok) await trabalhar(idDoFeedback, async () => { await repo.apagar(idDoFeedback); toast('Feedback apagado.'); }, 'Não deu para apagar o feedback.');
    },
  };
}
