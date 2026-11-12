// A tarefa em conjunto (Vitor, 12/11/2026: "tarefas em conjunto, isso vai acontecer mais pro contábil, então deixe o tarefas em
// conjunto, mais de uma pessoa delegada, aí você coloca todas as boxes, quando o usuário entrar na empresa, vai ter apenas os
// processos que ele vai fazer"). Quem delega marca as etapas da rotina e escolhe quem faz cada uma: cada etapa vira uma tarefa
// delegada ligada à empresa e ao período (etapaDelegada.conjunto). Quem recebe, ao entrar na empresa, vê só as dele e as conclui
// na rotina (useExecutor); as que ninguém recebeu ficam com quem delegou.
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useParams } from 'react-router';
import { useTarefasDelegadas } from '../../../../dados/repo';
import { useEquipeQueRecebe } from './useDelegacaoDaEtapa';

const d = t.delegadas;

interface EtapaDaRotina { id: string; nome: string; secao?: string; situacao: 'feita' | 'interrompida' | 'pendente'; oculta: boolean }

export function useDelegarEmConjunto(s: { codigo: number | null; nome: string; meses: readonly string[]; etapas: readonly EtapaDaRotina[]; emConjunto: readonly t.delegadas.TarefaDelegada[] }) {
  const { empresa: rota = '', competencia: periodo = '' } = useParams();
  const repo = useTarefasDelegadas();
  const { toast, modal } = useRetorno();
  const uid = repo.eu()?.uid || '';
  const equipe = useEquipeQueRecebe(uid);

  const [aberta, setAberta] = useState(false);
  // a etapa marcada e com quem (o uid; '' = marcada, falta a pessoa)
  const [escolhas, setEscolhas] = useState<Readonly<Record<string, string>>>({});
  // a última pessoa escolhida já vem na próxima etapa marcada
  const [ultima, setUltima] = useState('');
  const [observacao, setObservacao] = useState('');
  const [comObservacao, setComObservacao] = useState(false);
  const [gravando, setGravando] = useState(false);

  const comQuem = (id: string) => s.emConjunto.find(x => x.etapaDelegada?.etapa === id) || null;
  const pessoaDe = (uidDaPessoa: string) => equipe.find(p => p.uid === uidDaPessoa) || null;
  // as que dá para delegar: as que aparecem e não estão feitas no período
  const etapas = s.etapas.filter(e => !e.oculta && e.situacao !== 'feita').map(e => {
    const ja = comQuem(e.id);
    return { id: e.id, nome: e.nome, secao: e.secao || '', marcada: e.id in escolhas, pessoa: pessoaDe(escolhas[e.id] || ''),
      delegada: ja ? { id: ja.id, para: ja.responsavel.nome, feita: ja.status === 'concluida' } : null };
  });
  const marcadas = etapas.filter(e => e.marcada && !e.delegada);
  const pode = !gravando && marcadas.length > 0 && marcadas.every(e => !!e.pessoa);

  async function delegar() {
    if (!pode) return;
    setGravando(true);
    const periodoTexto = t.rotuloDoPeriodo([...s.meses]);
    const todas = marcadas.map(e => e.nome + ': ' + e.pessoa!.nome).join('\n');
    let feitas = 0;
    try {
      for (const e of marcadas) {
        await repo.criar({
          ...d.rascunhoVazio({ uid: e.pessoa!.uid, nome: e.pessoa!.nome }),
          titulo: (e.nome + ' · ' + (s.codigo != null ? s.codigo + ' · ' : '') + s.nome + ' · ' + periodoTexto).slice(0, d.MAIOR_TITULO),
          descricao: [observacao.trim(), 'Tarefa em conjunto:\n' + todas].filter(Boolean).join('\n\n').slice(0, d.MAIOR_DESCRICAO),
          clientes: [{ codigo: s.codigo, nome: s.nome }],
          etapaDelegada: { etapa: e.id, rota, periodo, todas: true, contas: [], feitas: [], conjunto: true },
        }, []);
        feitas++;
      }
      toast(feitas === 1 ? 'Etapa delegada.' : feitas + ' etapas delegadas.');
      setAberta(false);
    } catch (e) {
      toast((feitas ? 'Deleguei ' + feitas + ' de ' + marcadas.length + '; as outras não: ' : 'Não deleguei: ') + (e instanceof Error ? e.message : String(e)));
    } finally { setGravando(false); }
  }

  return {
    aberta,
    abrir: () => { setEscolhas({}); setUltima(''); setObservacao(''); setComObservacao(false); setAberta(true); },
    fechar: () => setAberta(false),
    equipe, etapas, qtd: marcadas.length, pode, gravando, delegar,
    marcar: (id: string) => setEscolhas(x => { const n = { ...x }; if (id in n) delete n[id]; else n[id] = ultima; return n; }),
    escolher: (id: string, uidDaPessoa: string) => { setUltima(uidDaPessoa); setEscolhas(x => ({ ...x, [id]: uidDaPessoa })); },
    observacao, setObservacao, comObservacao, alternarObservacao: () => setComObservacao(x => !x),
    /** cancela a tarefa da etapa: ela volta para quem delegou (o histórico da tarefa fica) */
    async remover(id: string, nome: string, etapa: string) {
      const ok = await modal<boolean>({
        icone: 'alert', titulo: 'Remover a delegação?', texto: nome + ' deixa de ter ' + etapa + '. A tarefa fica como cancelada.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Remover', valor: true, variante: 'btn-primary' }],
      });
      if (!ok) return;
      try { await repo.salvar(id, { status: 'cancelada' }); toast('Delegação removida.'); } catch (e) { toast('Não removi: ' + (e instanceof Error ? e.message : String(e))); }
    },
  };
}

export type VmEmConjunto = ReturnType<typeof useDelegarEmConjunto>;
