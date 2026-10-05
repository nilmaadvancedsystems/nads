// Etapa 1 do Creditor, no visual da Importação (Vitor, 05/10/2026: "o mesmo visual de importação de Drive, de
// competências"): em cima, a competência (o seletor) e quantos relatórios; embaixo, a linha do relatório de liquidação,
// com a pasta onde ele é procurado e o ícone de importar (do computador ou do Drive). Lido, a linha fica Ok e segue.
import { classeDaJanela, Icone, LogoDrive, MenuSuspenso } from '@nads/ui';
import { useRef } from 'react';
import { BotaoGoogle } from '../../../../../../comum/BotaoGoogle';
import { useCompetencia } from './useCompetencia';

export function Competencia() {
  const vm = useCompetencia();
  const arquivo = useRef<HTMLInputElement>(null);
  const b = vm.busca;
  return (
    <section>
      <div className={'imp-topo' + (b.ocupado ? ' travado' : '')} aria-busy={b.ocupado}>
        {/* à esquerda, como na Importação: a competência e o número de relatórios */}
        <MenuSuspenso icone="calendar" rotulo={vm.rotulo} largura={300} dica="Trocar a competência" className="btn btn-outline"
          conteudo={fechar => (
            <div className="comp-pop">
              <div className="comp-lista">
                {vm.competencias.map(c => (
                  <button key={c.valor} type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); vm.setMes(c.valor); }}>
                    <span className="popover-marca">{c.valor === vm.mes && <Icone nome="check" />}</span>
                    <span className="popover-texto">{c.rotulo}</span>
                  </button>
                ))}
              </div>
            </div>
          )} />
        <span className="imp-topo-num"><Icone nome="fileText" /><b>1</b> relatório</span>
        <span className="imp-topo-meio" />
      </div>

      <div className="imp-lista">
        <div className={'imp-bloco' + (vm.jaCarregado ? ' imp-ok' : '')}>
          <div className="imp-linha">
            <span className="imp-seta" aria-hidden="true"><Icone nome="caretDown" /></span>
            <span className="imp-ico imp-logo"><Icone nome="fileText" /></span>
            <div className="imp-txt">
              <span><b>Relatório de liquidação</b><span className="imp-conta">{vm.pasta}</span></span>
            </div>
            <div className="imp-resumo">
              {b.ocupado && <div><span>{b.texto}</span></div>}
            </div>
            <div className="imp-grupos">
              {vm.jaCarregado ? (
                <>
                  {/* importado: o check (ou o logo do Drive) que, com o mouse em cima, vira o × e exclui — igual à Importação */}
                  <div className="imp-grupo" aria-label="Relatório de liquidação">
                    <span className="imp-rotulo">Relatório</span>
                    <button type="button" className={'icon-btn icon-btn-sm imp-btn imp-feito' + (vm.doDrive ? ' imp-feito-drive' : '')} onClick={vm.excluir}
                      title={'Importado: ' + vm.origemCarregada + '. Clique para excluir.'} aria-label="Excluir o relatório de liquidação">
                      {vm.doDrive ? <span className="imp-feito-ok"><LogoDrive cor /></span> : <Icone nome="check" className="imp-feito-ok" />}
                      <Icone nome="x" className="imp-feito-x" />
                    </button>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={vm.continuar}>Continuar</button>
                </>
              ) : b.ocupado ? (
                <span className="btn-spinner" aria-label={b.texto} />
              ) : (
                <div className="imp-grupo" aria-label="Relatório de liquidação">
                  <span className="imp-rotulo">Relatório</span>
                  {/* só o ícone de importar; clicou, as opções (como o extrato na Importação) */}
                  <MenuSuspenso rotulo="" icone="upload" className="gh-topo-btn gh-topo-menu imp-mes-menu" direita dica="Importar o relatório de liquidação"
                    conteudo={fechar => (
                      <>
                        <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); arquivo.current?.click(); }}>
                          <Icone nome="upload" /><span className="popover-texto">Importar do computador</span>
                        </button>
                        {!vm.exemplos && !vm.driveDeFora && (
                          <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); vm.buscarNoDrive(); }}>
                            <LogoDrive cor /><span className="popover-texto">Buscar no Drive</span>
                          </button>
                        )}
                      </>
                    )} />
                  <input ref={arquivo} type="file" accept=".pdf,.txt,.xls,.xlsx,.csv" className="sr-only" tabIndex={-1} aria-hidden="true"
                    onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; vm.importarDoComputador(f); }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* não veio do Drive: a mesma janela da Importação, com os arquivos da pasta para escolher */}
      {b.fase === 'problema' && (
        <div className="modal-overlay" role="presentation" onClick={vm.fecharProblema}>
          <div className={classeDaJanela({}) + ' drive-escolha'} role="dialog" aria-modal="true" aria-labelledby="tituloEscolhaCreditor" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" onClick={vm.fecharProblema}><Icone nome="x" /></button>
            <h3 id="tituloEscolhaCreditor">Relatório de liquidação no Drive</h3>
            <p>{b.texto}</p>
            {b.candidatos.length > 0 && (
              <div className="drive-candidatos">
                {b.candidatos.slice(0, 12).map(a => {
                  // o nome do arquivo em cima e a pasta embaixo
                  const partes = a.caminho.split(' › ');
                  return (
                    <button key={a.id} type="button" className="drive-candidato" onClick={() => vm.usar(a)}>
                      <span className="drive-candidato-logo"><LogoDrive cor /></span>
                      <span className="drive-candidato-txt"><b>{partes[partes.length - 1]}</b><span className="hint">{partes.slice(0, -1).join(' › ')}</span></span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* sem o login do Drive: a mesma janela de entrar da Importação */}
      {vm.login.aberto && (
        <div className="modal-overlay" role="presentation" onClick={vm.login.fechar}>
          <div className={classeDaJanela({}) + ' drive-login'} role="dialog" aria-modal="true" aria-labelledby="tituloDriveCreditor" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" onClick={vm.login.fechar}><Icone nome="x" /></button>
            <h3 id="tituloDriveCreditor">Entrar no Entregas</h3>
            <p className="drive-login-texto">Com a conta Google do escritório. Fica guardado neste computador: é só uma vez.</p>
            <div className="drive-login-google">
              <BotaoGoogle entrando={vm.login.entrando} onClick={vm.login.entrar} />
            </div>
            {vm.login.erro && <p className="hint drive-login-erro">{vm.login.erro}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
