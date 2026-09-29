// ViewModel do executor (a tela cheia das etapas): a etapa da vez, a ferramenta dela, as objeções,
// o "Próximo" (check automático → marca feita e passa para a próxima), o "Interromper" (com o motivo)
// e o "Não se aplica". Cada coisa vira evento com hora e pessoa.
import { empresas, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { arquivosDoExtrator } from '../../dados/fonte';
import { useExecucoes, useRepo } from '../../dados/repo';
import { caminhoDaPagina } from '../../casca/navegacao';
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

  const voltar = () => navegar(caminhoDaPagina('minhas-empresas', 'empresas') + '?competencia=' + competencia);

  async function proximo() {
    if (!ex || !etapa || conferindo) return;
    setConferindo(true);
    try {
      const arquivos = t.precisaDoExtrator(etapa) ? await arquivosDoExtrator(ex.empresa) : [];
      const r = t.verificar(etapa, competencia, arquivos);
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

  /** Solução de uma objeção: as que dependem de Drive/Contato ainda estão em desenvolvimento. */
  function resolver(o: t.Objecao) {
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
    ferramenta: f && empresa ? { nome: f.nome, embutir: f.embutir, url: BASES[f.app] + f.caminho(empresas.rotaDaEmpresa(empresa)) } : null,
    aviso, conferindo, proximo,
    resolver,
    interrompendo, abrirInterromper: () => setInterrompendo(true), fecharInterromper: () => setInterrompendo(false), interromper,
    sair: voltar,
  };
}
