// Importação › Balancete / Entradas / Saídas / Tomados / Prestados (conferencia.html ~L1036-1155).
import { conferencia as c } from '@nads/core';
import { Alerta, BotaoAcao, CampoArquivo, Icone, Interruptor, MensagemFlutuante, useCarregando } from '@nads/ui';
import { AcoesDoTopo } from '../../../../comum/topo';
import { BoasVindasBalancete } from './partes/BoasVindasBalancete';
import { NotasImportadas, ServicosImportados } from './partes/Importados';
import { PlanoDeContas } from './partes/PlanoDeContas';
import { useImportacao, type Mensagem } from './useImportacao';

/** naEtapa: dentro da primeira etapa da Tarefas, sem o "Apagar ao sair" do balancete (nem a pergunta sobre ele). */
export function Importacao({ tipo, naEtapa }: { tipo: c.PaginaImportacao; naEtapa?: boolean }) {
  const vm = useImportacao(tipo);
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
