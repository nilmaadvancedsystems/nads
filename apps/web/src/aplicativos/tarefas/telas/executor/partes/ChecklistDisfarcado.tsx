// A "checklist disfarçada" do Fiscal (Vitor, 06/10/2026: "quero fazer uma checklist disfarçada, com tabelinha, gráfico
// para evitar de ficar sem graça; o que pode ser importado coloque para importar"), montada com as peças prontas do
// catálogo (Vitor: "use os prontos"): o cartão com a faixa cinza (card-head) e a barra de progresso (tarefas-barra); cada
// tarefa é uma faixa que abre (imp-faixa), com a caixinha da etapa (subnav-caixa), o contador (imp-faixa-qtd), o
// Importar (a Importação da Conferência numa janela, a mesma do Contábil) e o Conferido (badge-conferido). Em ordem: o
// "Conferido" só na da vez; o "Desfazer" só no último conferido. A da vez fica aberta; as conferidas, fechadas (um clique
// abre). Com o animejs (Vitor: "quero mais animações"): as faixas entram em sequência, a caixinha pula ao conferir, a
// barra anda e a tela desce até a próxima.
import type { tarefas as t } from '@nads/core';
import { Icone } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { ImportacaoNaEtapa } from '../../../../concilia-ai/ImportacaoNaEtapa';
import { JanelaLateral, type TopicoDaJanela } from '../../janela/JanelaLateral';
import { ROTULO_DO_RELATORIO, usePainelDoFiscal, type VmPainelDoFiscal } from '../usePainelDoFiscal';
import type { TarefaDoChecklist } from '../useChecklistDaFolha';
import { andarProgresso, animarCartoes, menosMovimento, pularCheck } from './animarPainel';
import { PainelDaTarefa } from './PainelDaTarefa';

type ItemNaTela = TarefaDoChecklist & { marcado: boolean; liberado: boolean };

export function ChecklistDisfarcado({ titulo, itens, definicao, alternar, empresa, codigo, competencia, meses, valores, informar }: {
  titulo: string; itens: readonly ItemNaTela[]; definicao: readonly t.ItemDoChecklist[]; alternar: (id: string) => void;
  empresa: string; codigo: string; competencia: string; meses: readonly string[];
  /** os valores da execução (o total da folha do DP) e como informar um */
  valores?: Record<string, number>; informar?: (chave: string, valor: number) => void;
}) {
  const vm = usePainelDoFiscal(empresa, codigo, competencia, meses);
  const feitos = itens.filter(i => i.marcado).length;
  const daVez = itens.findIndex(i => !i.marcado);
  const raiz = useRef<HTMLDivElement>(null);
  const progresso = useRef<HTMLSpanElement>(null);
  // as conferidas ficam fechadas; estas foram abertas de novo (e a da vez pode ser fechada)
  const [trocadas, setTrocadas] = useState<string[]>([]);
  const trocar = (id: string) => setTrocadas(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]));
  // a etapa abriu: as faixas entram em sequência
  useEffect(() => { animarCartoes(raiz.current); }, [titulo]);
  // a barra de progresso anda (pelo animejs: o CSS do app não anima)
  useEffect(() => { andarProgresso(progresso.current, itens.length ? feitos / itens.length : 0); }, [feitos, itens.length]);
  // conferiu: a caixinha pula e a tela desce até a da vez
  const antes = useRef(feitos);
  useEffect(() => {
    if (feitos > antes.current && raiz.current) {
      const faixas = raiz.current.querySelectorAll('.pt-tarefa');
      pularCheck(faixas[feitos - 1]?.querySelector('.subnav-caixa') || null);
      faixas[feitos]?.scrollIntoView({ behavior: menosMovimento() ? 'auto' : 'smooth', block: 'nearest' });
    }
    antes.current = feitos;
  }, [feitos]);
  return (
    <div className="card folha-check pt-check" ref={raiz}>
      <div className="card-head">
        <h3>{titulo}</h3>
        <span className="card-head-ctl"><span className="tarefas-barra"><span ref={progresso} /></span>{feitos}/{itens.length}</span>
      </div>
      {itens.map((i, k) => {
        const def = definicao.find(d => d.id === i.id);
        const importar = def?.importar || [];
        const vez = k === daVez;
        const temPainel = !!def?.painel;
        const aberta = temPainel && (vez || i.marcado) && (vez ? !trocadas.includes(i.id) : trocadas.includes(i.id));
        const importadas = importar.reduce((s, r) => s + vm.importado[r], 0);
        return (
          <div key={i.id} data-folha={i.nome} className={'imp-faixa pt-tarefa' + (aberta ? ' aberta' : '') + (vez ? ' da-vez' : '') + (!i.liberado && !i.marcado ? ' travada' : '')}>
            <div className="imp-faixa-barra pt-tarefa-barra">
              {/* o check marca e desmarca (Vitor, 07/10/2026); em ordem: só o da vez marca e só o último marcado desmarca */}
              <button type="button" className="pt-caixa" onClick={() => alternar(i.id)} disabled={!i.liberado} aria-pressed={i.marcado}
                title={i.liberado ? (i.marcado ? 'Desmarcar' : 'Marcar como conferido') : i.marcado ? 'Desmarque antes os de baixo' : 'Conclua a anterior primeiro'}>
                <span className={'subnav-caixa ' + (i.marcado ? 'marcada' : 'vazia')}>{i.marcado && <Icone nome="check" />}</span>
              </button>
              <button type="button" className="pt-tarefa-abrir" disabled={!temPainel || (!vez && !i.marcado)} onClick={() => trocar(i.id)} aria-expanded={temPainel ? aberta : undefined}>
                {temPainel && <Icone nome="caretDown" className="imp-faixa-seta" />}
                <b>{i.nome}</b>
                {importar.length > 0 && importadas > 0 && <span className="imp-faixa-qtd" title={importadas + ' notas importadas'}>{importadas}</span>}
                {i.contas.length > 0 && <span className="hint">{i.contas.join(' · ')}</span>}
              </button>
              <span className="pt-tarefa-acoes">
                {importar.length > 0 && (vez || i.marcado) && (
                  <button type="button" className="btn btn-outline" onClick={() => vm.importar(importar)}
                    title={'Importar ' + importar.map(r => ROTULO_DO_RELATORIO[r]).join(', ') + ' (vai para a Conferência, a mesma do Contábil)'}>
                    <Icone nome="upload" />Importar{importar.length === 1 ? ' ' + ROTULO_DO_RELATORIO[importar[0]] : ''}
                  </button>
                )}
                {i.link && (vez || i.marcado) && <a className="btn btn-outline" href={i.link.url} target="_blank" rel="noreferrer"><Icone nome="link" />{i.link.rotulo}</a>}
                {i.marcado ? (
                  <>
                    <span className="badge badge-conferido">Conferido</span>
                    {i.liberado && <button type="button" className="btn btn-ghost" onClick={() => alternar(i.id)}>Desfazer</button>}
                  </>
                ) : i.liberado ? (
                  <button type="button" className="btn btn-primary" onClick={() => alternar(i.id)}><Icone nome="check" />Conferido</button>
                ) : (
                  <span className="hint"><Icone nome="lock" /> Depois da anterior</span>
                )}
              </span>
            </div>
            {(aberta || (vez && i.aviso)) && (
              <div className="imp-faixa-corpo">
                {i.aviso && vez && <p className="hint"><Icone nome="alert" /> {i.aviso}</p>}
                {aberta && def?.painel && <PainelDaTarefa painel={def.painel} vm={vm} codigo={codigo} competencia={competencia} importar={vm.importar} valores={valores} informar={informar} />}
              </div>
            )}
          </div>
        );
      })}
      {vm.importando && <JanelaDeImportacao vm={vm} empresa={empresa} />}
    </div>
  );
}

/** A Importação da Conferência numa janela (a janela com painéis laterais), um tópico por relatório da tarefa. */
function JanelaDeImportacao({ vm, empresa }: { vm: VmPainelDoFiscal; empresa: string }) {
  const imp = vm.importando!;
  const topicos: TopicoDaJanela<t.RelatorioImportavel>[] = imp.relatorios.map(r => ({ id: r, rotulo: ROTULO_DO_RELATORIO[r], icone: 'fileUp', contador: vm.importado[r] || undefined }));
  return (
    <JanelaLateral rotulo="Importar do Alterdata" topicos={topicos} topico={imp.atual} mudar={vm.trocarRelatorio} fechar={vm.fecharImportacao} classe="pt-janela"
      resumo={<div className="usuario-quem"><b>Importar do Alterdata</b><span className="fraco">Vai para a Conferência da empresa: o Contábil já usa.</span></div>}>
      <ImportacaoNaEtapa key={imp.atual} nome={empresa} tipo={imp.atual} prestaServico={null} />
    </JanelaLateral>
  );
}
