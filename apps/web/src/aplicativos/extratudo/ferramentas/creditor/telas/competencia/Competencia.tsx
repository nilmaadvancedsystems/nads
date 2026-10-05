// Etapa 1 do Creditor, no visual da Importação (Vitor, 05/10/2026: "o mesmo visual de importação de Drive, de
// competências"): em cima, a competência (um mês, ou vários pelo Em lote) e quantos relatórios; embaixo, uma linha de
// relatório de liquidação por mês, com o ícone de importar (do computador ou do Drive). Importado, o check (ou o logo
// do Drive) que exclui. Com todos os meses, segue.
import { classeDaJanela, Icone, LogoDrive, MenuSuspenso } from '@nads/ui';
import { useRef, useState } from 'react';
import { BotaoGoogle } from '../../../../../../comum/BotaoGoogle';
import { useCompetencia } from './useCompetencia';

type VM = ReturnType<typeof useCompetencia>;

export function Competencia() {
  const vm = useCompetencia();
  const b = vm.busca;
  const comDrive = !vm.exemplos && !vm.driveDeFora;
  return (
    <section>
      <div className={'imp-topo' + (vm.ocupado ? ' travado' : '')} aria-busy={vm.ocupado}>
        {/* à esquerda, como na Importação: a competência (ou o período) e quantos relatórios */}
        <SeletorDaCompetencia vm={vm} />
        <span className="imp-topo-num"><Icone nome="recibo" /><b>{vm.meses.length}</b> {vm.meses.length === 1 ? 'relatório' : 'relatórios'}</span>
        <span className="imp-topo-meio" />
        {/* Em lote: os que faltam, todos de uma vez pelo Drive */}
        {vm.lote && vm.faltam > 1 && comDrive && !vm.ocupado && (
          <MenuSuspenso rotulo="" icone="upload" className="gh-topo-btn gh-topo-menu" direita dica="Importar os relatórios que faltam"
            itens={[{ rotulo: 'Buscar os ' + vm.faltam + ' que faltam no Drive', icone: 'pasta', onClick: () => vm.buscarNoDrive('*') }]} />
        )}
        {vm.lote && vm.todos && <button type="button" className="btn btn-primary" onClick={vm.continuar}>Continuar</button>}
      </div>

      <div className="imp-lista">
        {vm.linhas.map(l => <LinhaDoRelatorio key={l.mes} vm={vm} l={l} comDrive={comDrive} />)}
      </div>

      {/* não veio do Drive: a mesma janela da Importação, com os arquivos da pasta para escolher */}
      {b.fase === 'problema' && (
        <div className="modal-overlay" role="presentation" onClick={vm.fecharProblema}>
          <div className={classeDaJanela({}) + ' drive-escolha'} role="dialog" aria-modal="true" aria-labelledby="tituloEscolhaCreditor" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" onClick={vm.fecharProblema}><Icone nome="x" /></button>
            <h3 id="tituloEscolhaCreditor">Relatório de liquidação{vm.lote && b.mes ? ' de ' + vm.linhas.find(l => l.mes === b.mes)?.rotulo : ''} no Drive</h3>
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

/** O seletor da competência, como o da Importação: Competência (um mês) e Em lote (de um mês até outro). */
function SeletorDaCompetencia({ vm }: { vm: VM }) {
  const [aba, setAba] = useState<'mes' | 'lote'>(vm.lote ? 'lote' : 'mes');
  const [de, setDe] = useState(vm.meses[0]);
  const [ate, setAte] = useState(vm.meses[vm.meses.length - 1]);
  const qtd = vm.competencias.filter(c => c.valor >= (de < ate ? de : ate) && c.valor <= (de < ate ? ate : de)).length;
  const menu = (
    <MenuSuspenso icone="calendar" rotulo={vm.rotulo} largura={300} dica={vm.lote ? 'Em lote: ' + vm.linhas.map(l => l.rotulo).join(', ') : 'Trocar a competência'}
      className={'btn btn-outline' + (vm.lote ? ' imp-periodo-ativo' : '')}
      conteudo={fechar => (
        <div className="comp-pop">
          <div className="iniciar-abas comp-abas" role="tablist">
            <button type="button" role="tab" className="iniciar-aba" aria-selected={aba === 'mes'} onClick={() => setAba('mes')}>Competência</button>
            <button type="button" role="tab" className="iniciar-aba" aria-selected={aba === 'lote'} onClick={() => setAba('lote')}>
              Em Lote{vm.lote && <span className="imp-periodo-qtd">{vm.meses.length}</span>}
            </button>
          </div>
          {aba === 'mes' ? (
            <div className="comp-lista">
              {vm.competencias.map(c => (
                <button key={c.valor} type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); vm.escolherMes(c.valor); }}>
                  <span className="popover-marca">{!vm.lote && c.valor === vm.meses[0] && <Icone nome="check" />}</span>
                  <span className="popover-texto">{c.rotulo}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="comp-varios">
              {/* os meses de agora (os do caixa com CRÉD.LIQ.COBRANÇA, quando veio da Tarefa) */}
              {vm.lote && <div className="imp-mes-chips">{vm.linhas.map(l => <span key={l.mes} className="imp-mes-chip">{l.rotulo}</span>)}</div>}
              <div className="varios-de-ate">
                <label>De
                  <select value={de} onChange={e => setDe(e.target.value)}>
                    {vm.competencias.map(c => <option key={c.valor} value={c.valor}>{c.curto}</option>)}
                  </select>
                </label>
                <label>Até
                  <select value={ate} onChange={e => setAte(e.target.value)}>
                    {vm.competencias.map(c => <option key={c.valor} value={c.valor}>{c.curto}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className="btn btn-primary comp-varios-botao" disabled={qtd < 2} onClick={() => { fechar(); vm.escolherPeriodo(de, ate); }}>
                {qtd > 1 ? 'Selecionar' : 'Escolha dois meses ou mais'}
              </button>
            </div>
          )}
        </div>
      )} />
  );
  // aberto pela Tarefa: o mesmo seletor, apagado e sem clique (Vitor, 05/10/2026: "da mesma maneira que antes, mas
  // ofuscado") — os meses vêm do caixa e o período só se escolhe na Importação
  return vm.travada ? <span className="seletor-travado" inert aria-disabled="true">{menu}</span> : menu;
}

/** Uma linha: o relatório de liquidação de um mês (sem o mês quando é um só). */
function LinhaDoRelatorio({ vm, l, comDrive }: { vm: VM; l: VM['linhas'][number]; comDrive: boolean }) {
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <div className={'imp-bloco' + (l.carregado ? ' imp-ok' : '')}>
      <div className="imp-linha">
        <span className="imp-ico imp-logo"><Icone nome="recibo" /></span>
        <div className="imp-txt">
          <span><b>Relatório de liquidação</b>{vm.lote && <span className="imp-conta">{l.rotulo}</span>}</span>
        </div>
        <div className="imp-resumo">{l.ocupado && <div><span>{l.texto}</span></div>}</div>
        <div className="imp-grupos">
          {l.carregado ? (
            <>
              {/* importado: o check (ou o logo do Drive) que, com o mouse em cima, vira o × e exclui — igual à Importação */}
              <div className="imp-grupo" aria-label="Relatório de liquidação">
                <span className="imp-rotulo">Relatório</span>
                <button type="button" className={'icon-btn icon-btn-sm imp-btn imp-feito' + (l.doDrive ? ' imp-feito-drive' : '')} onClick={() => vm.excluir(l.mes)}
                  disabled={vm.ocupado} title={'Importado: ' + l.origem + '. Clique para excluir.'} aria-label={'Excluir o relatório de liquidação ' + l.rotulo}>
                  {l.doDrive ? <span className="imp-feito-ok"><LogoDrive cor /></span> : <Icone nome="check" className="imp-feito-ok" />}
                  <Icone nome="x" className="imp-feito-x" />
                </button>
              </div>
              {!vm.lote && <button type="button" className="btn btn-primary" onClick={vm.continuar}>Continuar</button>}
            </>
          ) : l.ocupado ? (
            <span className="btn-spinner" aria-label={l.texto} />
          ) : (
            <div className="imp-grupo" aria-label="Relatório de liquidação">
              <span className="imp-rotulo">Relatório</span>
              {/* só o ícone de importar; clicou, as opções (como o extrato na Importação) */}
              <MenuSuspenso rotulo="" icone="upload" className="gh-topo-btn gh-topo-menu imp-mes-menu" direita dica={'Importar o relatório de liquidação' + (vm.lote ? ' de ' + l.rotulo : '')}
                conteudo={fechar => (
                  <>
                    <button type="button" className="popover-item" role="menuitem" disabled={vm.ocupado} onClick={() => { fechar(); arquivo.current?.click(); }}>
                      <Icone nome="upload" /><span className="popover-texto">Importar do computador</span>
                    </button>
                    {comDrive && (
                      <button type="button" className="popover-item" role="menuitem" disabled={vm.ocupado} onClick={() => { fechar(); vm.buscarNoDrive(l.mes); }}>
                        <LogoDrive cor /><span className="popover-texto">Buscar no Drive</span>
                      </button>
                    )}
                  </>
                )} />
              <input ref={arquivo} type="file" accept=".pdf,.txt,.xls,.xlsx,.csv" className="sr-only" tabIndex={-1} aria-hidden="true"
                onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; vm.importarDoComputador(l.mes, f); }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
