// A conferência do FGTS na aba FGTS da etapa da folha (Vitor, 16/10/2026), no desenho da do INSS: a linha "Guias do FGTS"
// com as Guias (PDF do FGTS Digital) à direita, a grade dos meses (provisão, guia, diferença, pagamento; clicar abre o mês
// com cada trabalhador), a faixa Lançamentos sugeridos e, embaixo, o fechamento do saldo. O razão é o da linha de cima.
import { Icone, LogoFgts } from '@nads/ui';
import { useId, useState } from 'react';
import { FaixaQueAbre } from '../../../../../comum/FaixaQueAbre';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../comum/GradeDosMeses';
import { MenuDeConta } from '../../../../extratudo/ferramentas/creditor/partes/MenuDeConta';
import type { FgtsDaEtapa as Fgts } from '../useFgtsDaEtapa';

const PAGAMENTO: Record<Fgts['meses'][number]['situacao'], string> = { ok: '✓', falta: 'Falta', depois: 'Depois', 'sem-guia': '—' };

export function FgtsDaEtapa({ vm }: { vm: Fgts }) {
  const idGuias = useId();
  const [aberta, setAberta] = useState(true);
  const grade = useColunaAjustavel('fgts', '96px', vm.meses.length);
  return (
    <div className="imp-bloco">
      <div className="imp-linha">
        <button type="button" className={'imp-seta' + (aberta ? ' aberta' : '')} aria-expanded={aberta} disabled={!vm.pronto}
          title={aberta ? 'Recolher a conferência' : 'Abrir a conferência'} aria-label="A conferência do FGTS" onClick={() => setAberta(a => !a)}>
          <Icone nome="caretDown" />
        </button>
        <span className="imp-ico imp-logo"><LogoFgts cor={vm.temGuias} /></span>
        <div className="imp-txt">
          <span><b>Guias do FGTS</b>{vm.arquivosGuias.length > 0 && <span className="imp-conta">{vm.arquivosGuias.length} {vm.arquivosGuias.length === 1 ? 'arquivo' : 'arquivos'}</span>}</span>
        </div>
        <div className="imp-resumo">{vm.resumo.length > 0 && <div>{vm.resumo.map(x => <span key={x}>{x}</span>)}</div>}</div>
        <div className="imp-grupos">
          <div className="imp-grupo" aria-label="Guias do FGTS">
            <span className="imp-rotulo">Guias</span>
            {vm.lendo ? <span className="icon-btn icon-btn-sm imp-btn" title="Lendo…"><span className="btn-spinner" /></span>
              : vm.temGuias ? (
                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.removerGuias} title="As guias do FGTS: importadas. Clique para tirar." aria-label="Tirar as guias do FGTS">
                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                </button>
              ) : (
                <>
                  <label htmlFor={idGuias} className="icon-btn icon-btn-sm imp-btn" title="Importar as guias do FGTS (PDF &quot;Detalhe da Guia Emitida&quot; do FGTS Digital)" aria-label="Importar as guias do FGTS"><Icone nome="upload" /></label>
                  <input id={idGuias} type="file" multiple accept=".pdf" className="sr-only" onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; void vm.importarGuias(fs); }} />
                </>
              )}
          </div>
        </div>
      </div>
      {vm.temGuias && !vm.temRazao && <p className="hint" style={{ margin: '8px 16px' }}>Importe o razão do FGTS a recolher na linha de cima para conferir.</p>}
      {vm.pronto && aberta && (
        <>
          <div className="imp-periodo-linha">
            <table className="imp-meses" style={grade.tabela}>
              <colgroup><col style={{ width: grade.largura }} /></colgroup>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Mês</span>{grade.alca}</th>
                  {vm.meses.map(m => (
                    <th key={m.mes} scope="col" className={m.mes === vm.mesAberto ? 'atual' : undefined}>
                      <button type="button" className="imp-meses-mes" aria-current={m.mes === vm.mesAberto ? 'true' : undefined} onClick={() => vm.abrirMes(m.mes)}
                        title={m.mes === vm.mesAberto ? 'Voltar para o período todo' : 'Ver só ' + m.rotulo + ' (cada trabalhador)'}>{m.rotulo}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">Provisão</th>{vm.meses.map(m => <td key={m.mes} className={'num' + (m.mes === vm.mesAberto ? ' atual' : '')}>{m.foraDoRazao ? 'fora do razão' : <ValorNaGrade texto={m.provisao} />}</td>)}</tr>
                <tr><th scope="row">Guia</th>{vm.meses.map(m => <td key={m.mes} className={'num' + (m.mes === vm.mesAberto ? ' atual' : '')}>{m.guia ? <ValorNaGrade texto={m.guia} /> : '—'}</td>)}</tr>
                <tr><th scope="row">Diferença</th>{vm.meses.map(m => <td key={m.mes} className={'num' + (m.mes === vm.mesAberto ? ' atual' : '') + (m.diferenca && !m.bate ? ' ext-neg' : '')}>{m.diferenca ? <ValorNaGrade texto={m.diferenca} /> : '—'}</td>)}</tr>
                <tr><th scope="row">Pagamento</th>{vm.meses.map(m => (
                  <td key={m.mes} className={(m.mes === vm.mesAberto ? 'atual' : '') + (m.situacao === 'falta' ? ' ext-neg' : '')}
                    title={m.situacao === 'falta' ? (m.pagamento ? 'Pago em ' + m.pagamento + ' (extrato) sem a baixa no razão' : 'Vencida em ' + m.vencimento + ' sem a baixa no razão') : m.situacao === 'depois' ? 'Vence em ' + m.vencimento + ', depois do período' : m.pagamento ? 'Pago em ' + m.pagamento : undefined}>
                    {PAGAMENTO[m.situacao]}
                  </td>
                ))}</tr>
              </tbody>
            </table>
          </div>
          {/* o mês aberto: cada trabalhador, o razão × a guia */}
          {vm.mesAberto && vm.trabalhadores.length > 0 && (
            <div className="imp-mov-caixa">
              <div className="imp-mov">
                <table className="table-compact">
                  <thead><tr><th>Trabalhador</th><th className="num">Razão</th><th className="num">Guia</th><th className="num">Diferença</th></tr></thead>
                  <tbody>
                    {vm.trabalhadores.map(x => (
                      <tr key={x.nome}><td className="wrap">{x.nome}</td><td className="num">{x.razao}</td><td className="num">{x.guia}</td><td className={'num' + (x.bate ? '' : ' ext-neg')}>{x.bate ? '—' : x.diferenca}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {vm.competenciaTrocada.length > 0 && (
            <p className="hint" style={{ margin: '8px 16px' }}>Histórico com a competência trocada (corrija no Alterdata): {vm.competenciaTrocada.join(' · ')}</p>
          )}
          <FaixaQueAbre titulo="Lançamentos sugeridos" qtd={vm.sugestoes.length} aviso={vm.sugestoes.length > 0}>
            <div className="imp-mov-caixa">
              <div className="tarefas-barra-topo">
                <span className="seletor-travado" aria-disabled="true" title="O período da tarefa (escolhido na Importação)"><span className="imp-mov-periodo">{vm.mostrando}</span></span>
                {vm.sugestoes.length > 0 && (
                  <>
                    <span className="hint">FGTS a recolher</span>
                    <MenuDeConta valor={vm.contaFgts} contas={vm.contas} onEscolher={vm.setContaFgts} travado={vm.contaTravada} />
                    {vm.nomeDaContaFgts && <span className="hint" title={vm.contaTravada ? 'Do balancete da empresa' : undefined}>{vm.nomeDaContaFgts}</span>}
                    <span className="tarefas-barra-espaco" />
                    {vm.faltaContrapartida > 0 && <span className="hint">Falta a contrapartida de {vm.faltaContrapartida} {vm.faltaContrapartida === 1 ? 'lançamento' : 'lançamentos'}</span>}
                    <button type="button" className="btn btn-primary" disabled={!vm.podeExportar} onClick={vm.baixarXls}
                      title={vm.podeExportar ? 'Baixar o .xls de importação do Alterdata com todos os lançamentos do período' : 'Informe a conta do FGTS a recolher e a contrapartida de cada lançamento'}>
                      <Icone nome="download" />Importar no meu Sistema
                    </button>
                  </>
                )}
              </div>
              {!vm.sugestoes.length ? <p className="hint">Nada a lançar: o razão bate com as guias.</p> : (
                <div className="imp-mov">
                  <table className="table-compact">
                    <thead><tr><th>Data</th><th>Contrapartida</th><th className="num">Valor</th><th>Histórico</th></tr></thead>
                    <tbody>
                      {vm.sugestoes.map(s => (
                        <tr key={s.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{s.data}</td>
                          <td>
                            <MenuDeConta valor={s.contrapartida} contas={vm.contas} onEscolher={k => vm.escolherContrapartida(s.chave, k)} />
                            <span className="hint" style={{ display: 'block', marginTop: 2 }}>{s.nomeDaContrapartida}{s.lado === 'credito' ? ' · a crédito (o FGTS a recolher a débito)' : ' · a débito (o FGTS a recolher a crédito)'}</span>
                          </td>
                          <td className="num">{s.valor}</td>
                          <td className="wrap">{s.historico}<span className="hint" style={{ display: 'block', marginTop: 2 }}>{s.motivo}</span></td>
                        </tr>
                      ))}
                      <tr className="imp-mov-anterior"><td colSpan={2}>Total</td><td className="num">{vm.totalSugerido}</td><td /></tr>
                    </tbody>
                  </table>
                </div>
              )}
              {vm.pagamentosSemGuia.length > 0 && <p className="hint">Pagamentos no razão sem guia com o mesmo valor: {vm.pagamentosSemGuia.join(' · ')}</p>}
            </div>
          </FaixaQueAbre>
          {vm.fechamento && (
            <div className="imp-faixa">
              <div className="imp-faixa-corpo imp-mov-caixa">
                <p>
                  <b>Fechamento em {vm.fechamento.fim}:</b> o razão está em {vm.fechamento.razao}; com os lançamentos sugeridos, fica em {vm.fechamento.ajustado}.
                  O certo é {vm.fechamento.esperado} (as guias que vencem depois do período).
                </p>
                {vm.fechamento.antes
                  ? <p className="hint">Sobram {vm.fechamento.antes}{vm.fechamento.semGuia ? ': importe as guias de ' + vm.fechamento.semGuia + ' para conferir esses meses' : ' que vêm de antes do período'}.</p>
                  : <p className="hint">Com os lançamentos sugeridos, o saldo fecha.</p>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
