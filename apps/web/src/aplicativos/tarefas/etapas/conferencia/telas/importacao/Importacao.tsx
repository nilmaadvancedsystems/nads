// Importação › Balancete / Entradas / Saídas / Tomados / Prestados (conferencia.html ~L1036-1155).
import { conferencia as c } from '@nads/core';
import { Alerta, BotaoAcao, CampoArquivo, Icone, Interruptor, MensagemFlutuante, origemDoPai, useCarregando } from '@nads/ui';
import { useState } from 'react';
import { AcoesDoTopo } from '../../../../../../comum/topo';
import { BoasVindasBalancete } from './partes/BoasVindasBalancete';
import { NotasImportadas, ServicosImportados } from './partes/Importados';
import { PlanoDeContas } from './partes/PlanoDeContas';
import { useImportacao, type Mensagem } from './useImportacao';
import type { NotasDoRobo } from './useNotasDoRobo';
import { MarcaAlterdata } from './partes/MarcaAlterdata';

/**
 * naEtapa: dentro da primeira etapa da Tarefas. Dentro da Tarefa (a Importação ou a Conferência fiscal), sem o "Apagar ao sair"
 * do balancete nem a pergunta sobre ele (Vitor, 05/11/2026: "remove esse apagar ao sair"); só na Conferência aberta sozinha.
 */
export function Importacao({ tipo, naEtapa, meses, codigo }: { tipo: c.PaginaImportacao; naEtapa?: boolean; meses?: readonly string[]; codigo?: number | null }) {
  const vm = useImportacao(tipo, meses, codigo);
  useCarregando(vm.carregando);
  const [naTarefa] = useState(() => !!naEtapa || !!origemDoPai());
  return (
    <section>
      <AcoesDoTopo>
        {tipo === 'balancete' && !naTarefa && (
          <span className="toggle-row" title="Ligado: o balancete desta empresa é apagado sempre que alguém sai dela, pra próxima conferência começar com um balancete atualizado.">
            Apagar ao sair<Interruptor ligado={vm.autoLimpar} onMudar={vm.alternarAutoLimpar} rotulo="Apagar o balancete ao sair" />
          </span>
        )}
        {vm.ja && <button className="btn btn-primary" type="button" onClick={vm.alternarReimportar}>{vm.reimportando ? 'Cancelar reimportação' : 'Reimportar'}</button>}
      </AcoesDoTopo>

      {vm.boasVindas && !naTarefa && <BoasVindasBalancete autoLimpar={vm.autoLimpar} onResponder={vm.definirAutoLimpar} />}

      {vm.mostrarCaixa && (
        <div className="card">
          <h3><span className="import-card-ico"><Icone nome={vm.cfg.icone} /></span>{vm.cfg.titulo}</h3>
          <div className="import-box-row">
            <CampoArquivo id={vm.cfg.idArquivo} arquivo={vm.arquivo} onEscolher={vm.setArquivo} aceitar={vm.cfg.aceitar} abrirAgora={vm.abrirArquivo} />
            {vm.robo.disponivel && (
              // só a marca do Alterdata (Vitor, 17/11/2026: "um icone do alterdata que enviei, apenas, sem nada escrito")
              <BotaoAcao className="btn btn-outline btn-icone-alterdata" carregando={vm.robo.pedindo || vm.robo.andando} textoCarregando="" disabled={vm.carregando}
                onClick={vm.robo.pedir} title={'Puxar ' + vm.nomeDoTipo + ' de ' + vm.periodo + ' do Alterdata'} aria-label={'Puxar ' + vm.nomeDoTipo + ' do Alterdata'}>
                <MarcaAlterdata />
              </BotaoAcao>
            )}
            <BotaoAcao carregando={vm.carregando} textoCarregando="Importando…" disabled={!vm.arquivo} onClick={vm.importar}>Importar</BotaoAcao>
          </div>
          <p className="hint">{vm.cfg.dica}</p>
          {vm.robo.disponivel && <RoboDoFiscal r={vm.robo} />}
          {/* a empresa que não teve essas notas no período (Clara, 29/10/2026): a etapa segue sem o arquivo */}
          {vm.podeMarcarSemMovimento && (
            <div className="btn-row" style={{ justifyContent: 'flex-end', marginTop: 0 }}>
              <button className="btn btn-outline" type="button" title={'A empresa não teve ' + vm.nomeDoTipo + ' em ' + vm.periodo + ': a etapa segue sem o arquivo'}
                onClick={vm.marcarSemMovimento}>Sem movimento no período</button>
            </div>
          )}
        </div>
      )}

      {vm.semMovimento && (
        <Alerta naLinha tom="ok" titulo={'Sem ' + vm.nomeDoTipo + ' em ' + vm.periodo} texto="Marcado como sem movimento no período: a etapa segue sem o arquivo.">
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn btn-outline" type="button" onClick={vm.desfazerSemMovimento}>Desfazer e importar</button>
          </div>
        </Alerta>
      )}

      {/* o mês do período que o arquivo não trouxe (Vitor, 04/11/2026: "tá importado só até o 08"): avisa até reimportar ou
          até marcar o mês sem movimento (Vitor, 05/11/2026: "deixe a opção de marcar os meses que estão sem movimento") */}
      {vm.mesesSemNota.length > 0 && !vm.reimportando && (
        <Alerta naLinha titulo={'Nenhuma nota em ' + vm.mesesSemNota.map(m => m.rotulo).join(', ')}
          texto={'O período da Tarefa é ' + vm.periodo + '. Se a empresa não teve ' + vm.nomeDoTipo + ' no mês, marque sem movimento; senão, confira no Alterdata se o arquivo saiu com o período todo e reimporte.'}>
          <div className="btn-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {vm.mesesSemNota.map(m => (
              <button key={m.valor} className="btn btn-outline" type="button" title={'A empresa não teve ' + vm.nomeDoTipo + ' em ' + m.rotulo}
                onClick={() => vm.marcarMesSemMovimento(m.valor)}>{m.rotulo} sem movimento</button>
            ))}
            <button className="btn btn-outline" type="button" onClick={vm.alternarReimportar}>Reimportar</button>
          </div>
        </Alerta>
      )}
      {vm.mesesMarcadosSemNota.length > 0 && !vm.reimportando && (
        <Alerta naLinha tom="ok" titulo={'Sem ' + vm.nomeDoTipo + ' em ' + vm.mesesMarcadosSemNota.map(m => m.rotulo).join(', ')}
          texto="Marcado como sem movimento no mês.">
          <div className="btn-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {vm.mesesMarcadosSemNota.map(m => (
              <button key={m.valor} className="btn btn-outline" type="button" onClick={() => vm.desfazerMesSemMovimento(m.valor)}>Desfazer {m.rotulo}</button>
            ))}
          </div>
        </Alerta>
      )}

      <MensagemFlutuante id={vm.cfg.idMensagem} chave={vm.seqMensagem} onFechar={vm.fecharMensagem}>
        {vm.mensagem && <MensagemImportacao m={vm.mensagem} onFechar={vm.fecharMensagem} />}
      </MensagemFlutuante>

      {vm.plano && <div className="imp-dados"><PlanoDeContas plano={vm.plano} onGrupo={vm.alternarGrupo} /></div>}
      {vm.notas && <div className="imp-dados"><NotasImportadas r={vm.notas} /></div>}
      {vm.servicos && <div className="imp-dados"><ServicosImportados r={vm.servicos} /></div>}

      {vm.ja && (
        <div className="btn-row" style={{ justifyContent: 'flex-end', marginTop: 0 }}>
          <button className="btn btn-danger" type="button" onClick={vm.excluir}>Excluir</button>
        </div>
      )}
    </section>
  );
}

/**
 * O andamento do robô do Fiscal embaixo da caixa (Vitor, 17/11/2026: "um feedback visual apenas de barra de progresso enquanto o
 * robo puxa, nao precisa escrever nada, so bloqueia toda a acao da tela e deixe o botao carregando"): só a barra; com o robô no
 * Alterdata, uma camada por cima da tela inteira não deixa clicar em nada. O erro, em vermelho, numa linha. O modo
 * desenvolvedor vê também o que o robô está fazendo e o Cancelar.
 */
function RoboDoFiscal({ r }: { r: NotasDoRobo }) {
  if (!r.situacao && !r.falha && !r.lendo) return null;
  const barra = r.andando || r.lendo;
  const texto = r.falha || (r.erro ? r.situacao : r.dev ? (r.lendo ? 'A planilha chegou: importando…' : r.situacao) + (r.clique ? ' · ' + r.clique : '') : '');
  return (
    <div className={'imp-robo-fiscal' + (r.erro || r.falha ? ' ext-neg' : '')} role="status" aria-label={barra ? 'Puxando do Alterdata' : undefined}>
      {barra && <div className="imp-robo-barra"><span style={{ width: (r.lendo ? 100 : Math.max(4, r.pct)) + '%' }} /></div>}
      {texto && <span>{texto}</span>}
      {r.andando && r.dev && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void r.cancelar(); }}>Cancelar</button>}
      {r.bloqueia && <div className="imp-robo-bloqueio" aria-hidden="true" />}
      {r.diag.length > 0 && (
        <details className="imp-robo-diag">
          <summary>O que o robô viu na tela</summary>
          <pre>{r.diag.join('\n')}</pre>
        </details>
      )}
    </div>
  );
}

/**
 * A mensagem da importação (Vitor, 08/10/2026: "feio demais, esse aviso e amarelo"): uma cor só e uma linha só. Com
 * algum aviso (CFOP do outro tipo, nota fora do período), a faixa toda fica amarela; sem aviso, verde.
 */
function MensagemImportacao({ m, onFechar }: { m: Mensagem; onFechar: () => void }) {
  const comAviso = m.textos.some(t => t.tom === 'aviso');
  return (
    <Alerta titulo={m.titulo} tom={m.tom === 'ok' && !comAviso ? 'ok' : undefined} onFechar={onFechar}>
      {m.textos.length > 0 && <p className="alert-text">{m.textos.map(t => t.texto).join(' · ')}</p>}
    </Alerta>
  );
}
