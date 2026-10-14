// Importação › Balancete / Entradas / Saídas / Tomados / Prestados (conferencia.html ~L1036-1155).
import { conferencia as c } from '@nads/core';
import { Alerta, BotaoAcao, CampoArquivo, Icone, Interruptor, MensagemFlutuante, SeletorMes, useCarregando } from '@nads/ui';
import { AcoesDoTopo } from '../../../../comum/topo';
import { AndamentoDoAlterdata } from './partes/AndamentoDoAlterdata';
import { BoasVindasBalancete } from './partes/BoasVindasBalancete';
import { NotasImportadas, ServicosImportados } from './partes/Importados';
import { PlanoDeContas } from './partes/PlanoDeContas';
import { useImportacao, type Mensagem } from './useImportacao';

/**
 * naEtapa: dentro da primeira etapa da Tarefas, sem o "Apagar ao sair" do balancete (nem a pergunta sobre ele).
 * competencia: a da etapa (aaaa-mm), para o "Gerar no Alterdata" do balancete.
 */
export function Importacao({ tipo, naEtapa, competencia }: { tipo: c.PaginaImportacao; naEtapa?: boolean; competencia?: string }) {
  const vm = useImportacao(tipo, competencia);
  const alt = vm.alterdata;
  useCarregando(vm.carregando);
  return (
    <section>
      <AcoesDoTopo>
        {tipo === 'balancete' && !naEtapa && (
          <span className="toggle-row" title="Ligado: o balancete desta empresa é apagado sempre que alguém sai dela, pra próxima conferência começar com um balancete atualizado.">
            Apagar ao sair<Interruptor ligado={vm.autoLimpar} onMudar={vm.alternarAutoLimpar} rotulo="Apagar o balancete ao sair" />
          </span>
        )}
        {vm.ja && <button className="btn btn-primary" type="button" onClick={vm.alternarReimportar}>{vm.reimportando ? 'Cancelar reimportação' : 'Reimportar'}</button>}
      </AcoesDoTopo>

      {vm.boasVindas && !naEtapa && <BoasVindasBalancete autoLimpar={vm.autoLimpar} onResponder={vm.definirAutoLimpar} />}

      {vm.mostrarCaixa && (
        <div className="card">
          <h3><span className="import-card-ico"><Icone nome={vm.cfg.icone} /></span>{vm.cfg.titulo}</h3>
          <div className="import-box-row">
            <CampoArquivo id={vm.cfg.idArquivo} arquivo={vm.arquivo} onEscolher={vm.setArquivo} aceitar={vm.cfg.aceitar} abrirAgora={vm.abrirArquivo} />
            <BotaoAcao carregando={vm.carregando} textoCarregando="Importando…" disabled={!vm.arquivo} onClick={vm.importar}>Importar</BotaoAcao>
          </div>
          <p className="hint">{vm.cfg.dica}</p>
          {alt.visivel && (
            <>
              <div className="alt-gerar">
                <span className="alt-gerar-rotulo">ou gerar direto no Alterdata:</span>
                <SeletorMes valor={alt.competencia} onMudar={alt.trocarCompetencia} rotulo="Competência do balancete" max={mesDeHoje()} />
                <BotaoAcao className="btn btn-outline" carregando={alt.ocupado} textoCarregando="Gerando…" disabled={vm.carregando || !!alt.motivo} title={alt.motivo || 'Pede ao robô do escritório que gere o balancete no Alterdata e importa o resultado aqui.'} onClick={() => void alt.gerar()}>
                  <Icone nome="robo" width={16} height={16} />Gerar no Alterdata
                </BotaoAcao>
              </div>
              {alt.pedido && <AndamentoDoAlterdata pedido={alt.pedido} onCancelar={() => void alt.cancelar()} onFechar={alt.fecharPedido} />}
            </>
          )}
        </div>
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
 * A mensagem da importação (Vitor, 08/10/2026: "feio demais, esse aviso e amarelo"): uma cor só e uma linha só. Com
 * algum aviso (nota fora do padrão do CFOP, CFOP do outro tipo), a faixa toda fica amarela; sem aviso, verde.
 */
function MensagemImportacao({ m, onFechar }: { m: Mensagem; onFechar: () => void }) {
  const comAviso = m.textos.some(t => t.tom === 'aviso');
  return (
    <Alerta titulo={m.titulo} tom={m.tom === 'ok' && !comAviso ? 'ok' : undefined} onFechar={onFechar}>
      {m.textos.length > 0 && <p className="alert-text">{m.textos.map(t => t.texto).join(' · ')}</p>}
    </Alerta>
  );
}

/** O mês de hoje ('aaaa-mm'): o balancete não é de mês futuro. */
function mesDeHoje(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
