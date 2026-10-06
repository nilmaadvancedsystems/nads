// A "checklist disfarçada" do Fiscal (Vitor, 06/10/2026: "quero fazer uma checklist disfarçada, com tabelinha, gráfico
// para evitar de ficar sem graça; o que pode ser importado coloque para importar"): cada tarefa da etapa vira um cartão
// com o número, o nome, o painel do que ela confere (números, tabelinha, gráfico) e, quando a tarefa usa um relatório do
// Alterdata, o Importar (a Importação da Conferência numa janela, a mesma do Contábil). Continua em ordem: o "Conferido"
// só no cartão da vez; o "Desfazer" só no último conferido.
import type { tarefas as t } from '@nads/core';
import { Icone } from '@nads/ui';
import { ImportacaoNaEtapa } from '../../../../concilia-ai/ImportacaoNaEtapa';
import { JanelaLateral, type TopicoDaJanela } from '../../janela/JanelaLateral';
import { ROTULO_DO_RELATORIO, usePainelDoFiscal, type VmPainelDoFiscal } from '../usePainelDoFiscal';
import type { TarefaDoChecklist } from '../useChecklistDaFolha';
import { PainelDaTarefa } from './PainelDaTarefa';

type ItemNaTela = TarefaDoChecklist & { marcado: boolean; liberado: boolean };

export function ChecklistDisfarcado({ titulo, itens, definicao, alternar, empresa, codigo, competencia, meses }: {
  titulo: string; itens: readonly ItemNaTela[]; definicao: readonly t.ItemDoChecklist[]; alternar: (id: string) => void;
  empresa: string; codigo: string; competencia: string; meses: readonly string[];
}) {
  const vm = usePainelDoFiscal(empresa, codigo, competencia, meses);
  const feitos = itens.filter(i => i.marcado).length;
  const daVez = itens.findIndex(i => !i.marcado);
  return (
    <div className="pt-lista">
      <header className="pt-cabeca">
        <h3>{titulo}</h3>
        <div className="pt-progresso" aria-label={feitos + ' de ' + itens.length + ' conferidas'}>
          <span className="pt-progresso-barra"><span style={{ width: (itens.length ? (feitos / itens.length) * 100 : 0) + '%' }} /></span>
          <b className="num">{feitos}/{itens.length}</b>
        </div>
      </header>
      <ol>
        {itens.map((i, k) => {
          const def = definicao.find(d => d.id === i.id);
          const importar = def?.importar || [];
          const vez = k === daVez;
          return (
            <li key={i.id} data-folha={i.nome} className={'card pt-cartao' + (i.marcado ? ' feito' : '') + (vez ? ' da-vez' : '') + (!i.liberado && !i.marcado ? ' travado' : '')}>
              <div className="pt-topo">
                <span className="pt-num" aria-hidden="true">{i.marcado ? <Icone nome="check" /> : k + 1}</span>
                <div className="pt-titulo">
                  <h4>{i.nome}</h4>
                  {i.contas.length > 0 && <span className="fraco">{i.contas.join(' · ')}</span>}
                </div>
                <div className="pt-acoes">
                  {importar.length > 0 && (
                    <button type="button" className="btn btn-outline" onClick={() => vm.importar(importar)}
                      title={'Importar ' + importar.map(r => ROTULO_DO_RELATORIO[r]).join(', ') + ' (vai para a Conferência, a mesma do Contábil)'}>
                      <Icone nome="upload" />Importar{importar.length === 1 ? ' ' + ROTULO_DO_RELATORIO[importar[0]] : ''}
                      {importar.every(r => vm.importado[r] > 0) && <Icone nome="checkCircle" className="pt-importado" />}
                    </button>
                  )}
                  {i.link && <a className="btn btn-outline" href={i.link.url} target="_blank" rel="noreferrer"><Icone nome="link" />{i.link.rotulo}</a>}
                  {i.marcado ? (
                    <>
                      <span className="badge badge-ok">Conferido</span>
                      {i.liberado && <button type="button" className="btn btn-ghost" onClick={() => alternar(i.id)}>Desfazer</button>}
                    </>
                  ) : i.liberado ? (
                    <button type="button" className="btn btn-primary" onClick={() => alternar(i.id)}><Icone nome="check" />Conferido</button>
                  ) : (
                    <span className="fraco pt-espera"><Icone nome="lock" />Depois da anterior</span>
                  )}
                </div>
              </div>
              {i.aviso && <p className="pt-aviso"><Icone nome="alert" />{i.aviso}</p>}
              {def?.painel && (vez || i.marcado) && (
                <div className="pt-corpo"><PainelDaTarefa painel={def.painel} vm={vm} codigo={codigo} competencia={competencia} /></div>
              )}
            </li>
          );
        })}
      </ol>
      {vm.importando && <JanelaDeImportacao vm={vm} empresa={empresa} />}
    </div>
  );
}

/** A Importação da Conferência numa janela, com um tópico por relatório da tarefa. */
function JanelaDeImportacao({ vm, empresa }: { vm: VmPainelDoFiscal; empresa: string }) {
  const imp = vm.importando!;
  const topicos: TopicoDaJanela<t.RelatorioImportavel>[] = imp.relatorios.map(r => ({ id: r, rotulo: ROTULO_DO_RELATORIO[r], icone: 'fileUp', contador: vm.importado[r] || undefined }));
  return (
    <JanelaLateral rotulo="Importar do Alterdata" topicos={topicos} topico={imp.atual} mudar={vm.trocarRelatorio} fechar={vm.fecharImportacao} classe="pt-janela"
      resumo={<div className="pt-janela-resumo"><b>Importar do Alterdata</b><span className="fraco">Vai para a Conferência da empresa: o Contábil já usa.</span></div>}>
      <ImportacaoNaEtapa key={imp.atual} nome={empresa} tipo={imp.atual} prestaServico={null} />
    </JanelaLateral>
  );
}
