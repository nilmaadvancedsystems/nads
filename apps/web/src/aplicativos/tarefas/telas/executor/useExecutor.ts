// ViewModel do executor (a tela cheia das etapas): a etapa da vez, a ferramenta dela, as objeções,
// o "Próximo" (check automático → marca feita e passa para a próxima), o "Interromper" (com o motivo)
// e o "Não se aplica". Cada coisa vira evento com hora e pessoa.
import { empresas, extrator, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { extratorDaEmpresa } from '../../dados/fonte';
import { useExecucoes, useRepo } from '../../dados/repo';
import { caminhoDaEmpresa, caminhoDaPagina, caminhoDoExecutor } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';

/**
 * Onde cada aplicativo mora. No site da Tarefas (só ela), as ferramentas são os sites delas; rodando
 * o nads inteiro (desenvolvimento), estão no mesmo endereço. A Conferência é sempre a de verdade.
 */
const soTarefas = import.meta.env.VITE_APLICATIVO === 'tarefas';
const BASES: Record<t.FerramentaDaEtapa['app'], string> = {
  extratudo: soTarefas ? 'https://extratudo-nilma.web.app' : '',
  conciliadorzinho: soTarefas ? 'https://conciliadorzinho-nilma.web.app' : '',
  'concilia-ai': 'https://nads-nilma.web.app',
};

export function useExecutor(rotaEmpresa: string, competencia: string) {
  const repo = useRepo();
  const navegar = useNavigate();
  const { toast, modal } = useRetorno();
  const op = useOperador().operador as Operador;
  const rotina = t.ROTINA_CONTABIL;
  const empresa = empresas.empresaPelaRota(repo.listarEmpresas(), rotaEmpresa);
  const { execucoes, carregada } = useExecucoes(competencia, rotina.departamento);
  const ex = (empresa && execucoes.find(e => e.empresa === empresa.nome)) || (empresa ? t.execucaoNova(empresa.nome, empresa.codigo, competencia, rotina.departamento) : null);
  const etapa = ex ? t.proximaEtapa(ex, rotina) : null;
  const carregando = !carregada;
  const [aviso, setAviso] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [interrompendo, setInterrompendo] = useState(false);

  // começou (ou voltou a) uma etapa: um evento por etapa aberta (conta o tempo de cada uma)
  const iniciadas = useRef(new Set<string>());
  useEffect(() => {
    if (!carregada || !ex || !etapa || iniciadas.current.has(etapa.id)) return;
    iniciadas.current.add(etapa.id);
    repo.registrar(ex, t.eventoDeInicio(etapa.id, op.nome, new Date()));
  }, [carregada, ex, etapa, repo, op.nome]);

  /**
   * Clique numa etapa do checklist: dá para voltar a uma etapa anterior já concluída — o check dela sai
   * e ela vira a da vez (as outras ficam como estão). Etapa da vez ou mais à frente: não faz nada.
   */
  function voltarPara(id: string) {
    if (!ex || !etapa || carregando || conferindo) return;
    const alvo = rotina.etapas.findIndex(e => e.id === id);
    if (alvo < 0 || alvo >= rotina.etapas.findIndex(e => e.id === etapa.id) || !t.concluida(t.situacaoDa(ex, id))) return;
    const v = t.voltarPara(ex, id, op.nome, new Date());
    iniciadas.current.delete(id);
    repo.gravar(v.execucao, v.evento);
    setAviso(null);
  }

  const voltar = () => navegar(caminhoDaPagina('minhas-empresas', 'empresas') + '?competencia=' + competencia);

  async function proximo() {
    if (!ex || !etapa || conferindo) return;
    setConferindo(true);
    try {
      const ext = t.precisaDoExtrator(etapa) ? await extratorDaEmpresa(ex.empresa) : null;
      // os bancos da empresa na competência (cadastrados + adicionados no Extrator)
      const bancos = ext ? extrator.bancosNaCompetencia(ext, empresas.bancosDaEmpresa(ex.codigo), competencia) : [];
      if (ext && t.todosSemMovimento(ex, bancos)) {
        // nenhum banco teve movimento: a etapa não se aplica nesta competência
        const d = t.dispensar(ex, etapa.id, 'sem-movimento', '', op.nome, new Date());
        repo.gravar(d.execucao, d.evento);
        setAviso(null);
        toast(etapa.nome + ': sem movimento.');
        return;
      }
      const r = t.verificar(etapa, competencia, ext?.arquivos || [], ext ? { bancos, semMovimento: ex.semMovimento || [] } : undefined);
      if (!r.ok) {
        setAviso(r.motivo);
        repo.registrar(ex, t.eventoDeVerificacaoFalhou(etapa.id, op.nome, new Date(), r.motivo));
        return;
      }
      const f = t.fazer(ex, etapa.id, op.nome, new Date());
      repo.gravar(f.execucao, f.evento);
      setAviso(null);
      toast(etapa.nome + ': feita.');
    } catch (e) {
      setAviso('Não consegui conferir agora: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setConferindo(false);
    }
  }

  async function naoSeAplica(objecao: t.Objecao) {
    if (!ex || !etapa) return;
    const ok = await modal<boolean>({
      icone: 'checkCircle', titulo: 'Não se aplica?', texto: etapa.nome + ': "' + objecao.texto + '". A etapa conta como concluída nesta competência.',
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Não se aplica', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    const d = t.dispensar(ex, etapa.id, objecao.id, '', op.nome, new Date());
    repo.gravar(d.execucao, d.evento);
    setAviso(null);
  }

  function interromper(objecao: string, observacao: string) {
    if (!ex || !etapa) return;
    const i = t.interromper(ex, etapa.id, objecao, observacao, op.nome, new Date());
    repo.gravar(i.execucao, i.evento);
    setInterrompendo(false);
    toast('Etapa interrompida: ' + etapa.nome + '.');
    voltar();
  }

  /** Solução de uma objeção (os botões embaixo): as que dependem de Drive/Contato ainda estão em desenvolvimento. */
  function resolver(o: t.Objecao) {
    if (o.solucao.tipo === 'orientacao') { void modal({ icone: 'alert', titulo: o.texto, texto: o.solucao.texto, botoes: [{ rotulo: 'Entendi', valor: true, variante: 'btn-primary' }] }); return; }
    if (o.solucao.tipo === 'nao-se-aplica') { void naoSeAplica(o); return; }
    if (o.solucao.tipo === 'contato') { toast('Contato (e-mail ao cliente): em desenvolvimento.'); return; }
    if (o.solucao.tipo === 'drive') { toast('Drive: em desenvolvimento.'); return; }
  }

  const f = etapa?.ferramenta || null;
  return {
    empresa, competencia, rotuloCompetencia: t.rotuloCompetencia(competencia),
    carregando: !carregada,
    etapas: rotina.etapas.map((e, i) => ({ id: e.id, n: i + 1, nome: e.nome, situacao: t.situacaoDa(ex, e.id), atual: e.id === etapa?.id })),
    etapa, n: etapa ? rotina.etapas.findIndex(e => e.id === etapa.id) + 1 : 0, total: rotina.etapas.length,
    interrompidaAntes: etapa && ex ? t.estadoDa(ex, etapa.id)?.situacao === 'interrompida' ? t.estadoDa(ex, etapa.id) : null : null,
    ferramenta: f && empresa ? { nome: f.nome, embutir: f.embutir, url: BASES[f.app] + f.caminho(empresas.rotaDaEmpresa(empresa)) + (f.app === 'extratudo' ? '?competencia=' + competencia : '') } : null,
    aviso, conferindo, proximo, voltarPara,
    resolver,
    interrompendo, abrirInterromper: () => setInterrompendo(true), fecharInterromper: () => setInterrompendo(false), interromper,
    sair: voltar,
    /** Os bancos sem movimento desta competência (a ferramenta da etapa mostra a linha marcada). */
    semMovimento: ex?.semMovimento || [],
    marcarSemMovimento: (banco: string, marcado: boolean) => {
      if (!ex || !etapa || carregando) return;
      const m = t.marcarSemMovimento(ex, etapa.id, banco, marcado, op.nome, new Date());
      repo.gravar(m.execucao, m.evento);
    },
    /** A ferramenta trocou a competência (o seletor dela): a mesma empresa, na outra competência. */
    trocarCompetencia: (c: string) => { if (empresa && c !== competencia) navegar(caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), c)); },
    abrirEmpresa: () => { if (empresa) navegar(caminhoDaEmpresa(empresas.rotaDaEmpresa(empresa), competencia)); },
  };
}
