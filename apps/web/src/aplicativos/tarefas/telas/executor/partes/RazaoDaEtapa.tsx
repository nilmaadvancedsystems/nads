// O Caixa na etapa, no desenho da Importação do banco (Vitor, 05/10/2026): a linha da conta com o Razão à direita (o
// ícone importa; importado, o ✓ que exclui), a grade dos meses (clicar abre o mês; de novo, volta para o período todo) e
// as faixas Lançamentos e Pontos de atenção. Em cima, o aviso do Creditor quando o caixa tem liquidação de cobrança.
import { Icone } from '@nads/ui';
import { useId, useState } from 'react';
import { FaixaQueAbre } from '../../../../../comum/FaixaQueAbre';
import type { RazaoDaEtapa as Razao } from '../useRazaoDaEtapa';

type Linha = Razao['lancamentos'][number];

function TabelaDeLancamentos({ linhas, saldoAnterior }: { linhas: Linha[]; saldoAnterior?: string }) {
  return (
    <div className="imp-mov">
      <table className="table-compact">
        <thead><tr><th>Data</th><th>Contrapartida</th><th>Histórico</th><th className="num">Débito</th><th className="num">Crédito</th><th className="num">Saldo</th></tr></thead>
        <tbody>
          {saldoAnterior != null && <tr className="imp-mov-anterior"><td colSpan={5}>Saldo anterior</td><td className="num">{saldoAnterior}</td></tr>}
          {linhas.map(l => (
            <tr key={l.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{l.data}</td>
              <td title={l.nomeContrapartida}>{l.contrapartida}{l.nomeContrapartida ? ' — ' + l.nomeContrapartida : ''}</td>
              <td className="wrap">{l.historico}</td>
              <td className="num">{l.debito}</td>
              <td className="num">{l.credito}</td>
              <td className={'num' + (l.credor ? ' ext-neg' : '')}>{l.saldo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RazaoDaEtapa({ conta, razao, conferir }: { conta: string; razao: Razao; conferir?: string[] }) {
  const id = useId();
  const [aberta, setAberta] = useState(true);
  const nome = conta.charAt(0).toUpperCase() + conta.slice(1);
  return (
    <div className="executor-razao">
      {razao.creditor.length > 0 && (
        <div className="alert">
          <Icone nome="alert" />
          <div>
            <p className="alert-title">Liquidação de cobrança no caixa: faça o Creditor</p>
            <p className="alert-text">
              O caixa tem CRÉD.LIQ.COBRANÇA em {razao.creditor.join(', ')}. A etapa Creditor entrou na rotina {razao.creditor.length === 1 ? 'desse mês' : 'desses meses'}, logo depois do Caixa, e é obrigatória.
            </p>
          </div>
        </div>
      )}
      {razao.cobertura && (razao.cobertura.faltam.length > 0 || razao.cobertura.aMais.length > 0) && (
        <div className="alert">
          <Icone nome="alert" />
          <div>
            <p className="alert-title">O razão não bate com o período da tarefa ({razao.periodo})</p>
            {razao.cobertura.faltam.length > 0 && (
              <p className="alert-text">Sem nenhum lançamento em {razao.cobertura.faltam.join(', ')}: confira se o razão foi exportado com o período todo.</p>
            )}
            {razao.cobertura.aMais.length > 0 && (
              <p className="alert-text">
                O razão traz meses fora do período ({razao.cobertura.aMais.join(', ')}): eles ficam de fora desta etapa.
                {razao.cobertura.liquidacaoFora.length > 0 && <> Tem CRÉD.LIQ.COBRANÇA em <b>{razao.cobertura.liquidacaoFora.join(', ')}</b>: o Creditor {razao.cobertura.liquidacaoFora.length === 1 ? 'desse mês' : 'desses meses'} não entra agora; ele entra quando a tarefa for desse período.</>}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="imp-lista">
        <div className="imp-bloco">
          <div className="imp-linha">
            <button type="button" className={'imp-seta' + (aberta ? ' aberta' : '')} aria-expanded={aberta} disabled={!razao.carregado}
              title={aberta ? 'Recolher os meses e os lançamentos' : 'Abrir os meses e os lançamentos'} aria-label="Os meses e os lançamentos do caixa" onClick={() => setAberta(a => !a)}>
              <Icone nome="caretDown" />
            </button>
            <span className="imp-ico"><Icone nome="briefcase" /></span>
            <div className="imp-txt">
              <span><b>{nome}</b>{razao.arquivo && <span className="imp-conta">{razao.arquivo}</span>}</span>
            </div>
            <div className="imp-resumo">{razao.resumo && <div><span>{razao.resumo}</span></div>}</div>
            <div className="imp-grupos">
              <div className="imp-grupo" aria-label={'Razão do ' + conta}>
                <span className="imp-rotulo">Razão</span>
                {razao.carregado ? (
                  <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={razao.remover}
                    title={'Razão do ' + conta + ': importado. Clique para excluir.'} aria-label={'Excluir o razão do ' + conta}>
                    <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                  </button>
                ) : (
                  <>
                    <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title={'Importar o razão do ' + conta + ' (XLS da conciliação do Alterdata)'} aria-label={'Importar o razão do ' + conta}>
                      <Icone nome="upload" />
                    </label>
                    <input id={id} type="file" accept=".xls,.xlsx,.ods" className="sr-only"
                      onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void razao.importar(f); }} />
                  </>
                )}
              </div>
            </div>
          </div>
          {razao.carregado && aberta && (
            <>
              <div className="imp-periodo-linha">
                <table className="imp-meses">
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Mês</span></th>
                      {razao.meses.map(m => (
                        <th key={m.mes} scope="col" className={m.mes === razao.mesAberto ? 'atual' : undefined}>
                          <button type="button" className="imp-meses-mes" aria-current={m.mes === razao.mesAberto ? 'true' : undefined} onClick={() => razao.abrirMes(m.mes)}
                            title={m.mes === razao.mesAberto ? 'Voltar para o período todo' : 'Ver só ' + m.rotulo}>{m.rotulo}</button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row">Lançamentos</th>{razao.meses.map(m => <td key={m.mes} className={m.mes === razao.mesAberto ? 'atual' : undefined}>{m.qtd || '—'}</td>)}</tr>
                    <tr><th scope="row">Saldo final</th>{razao.meses.map(m => <td key={m.mes} className={(m.mes === razao.mesAberto ? 'atual ' : '') + 'num' + (m.credor ? ' ext-neg' : '')} title={m.credor ? 'Ficou credor em algum dia do mês' : undefined}>{m.saldoFinal}</td>)}</tr>
                    <tr><th scope="row">Atenção</th>{razao.meses.map(m => (
                      <td key={m.mes} className={m.mes === razao.mesAberto ? 'atual' : undefined}>
                        {m.creditor ? <span className="badge badge-neutral" title="CRÉD.LIQ.COBRANÇA: o Creditor entrou neste mês">Creditor</span> : m.atencoes || '—'}
                      </td>
                    ))}</tr>
                  </tbody>
                </table>
              </div>
              <FaixaQueAbre titulo="Lançamentos" qtd={razao.lancamentos.length}>
                <div className="imp-mov-caixa">
                  <span className="imp-mov-periodo">Mostrando {razao.mostrando}</span>
                  <TabelaDeLancamentos linhas={razao.lancamentos} saldoAnterior={razao.saldoAnterior} />
                </div>
              </FaixaQueAbre>
              <FaixaQueAbre titulo="Pontos de atenção" qtd={razao.qtdAtencoes} aviso={razao.qtdAtencoes > 0}>
                <div className="imp-mov-caixa">
                  <span className="imp-mov-periodo">Mostrando {razao.mostrando}</span>
                  {!razao.atencoes.length && <p className="hint">Nenhum ponto de atenção.</p>}
                  {razao.atencoes.map(p => (
                    <div key={p.tipo}>
                      <p><b>{p.titulo}</b> <span className="badge badge-neutral">{p.obrigatorio ? 'Obrigatório' : 'Atenção'}</span> <span className="hint">{p.resumo}</span></p>
                      <p className="hint">{p.dica}</p>
                      <TabelaDeLancamentos linhas={p.linhas} />
                    </div>
                  ))}
                </div>
              </FaixaQueAbre>
            </>
          )}
        </div>
      </div>
      {!razao.carregado && conferir && (
        <div className="gh-blank">
          <Icone nome="checklist" />
          <h4>O que conferir</h4>
          <ul className="executor-conferir">{conferir.map(c => <li key={c}>{c}</li>)}</ul>
          <p>Importe o razão do {conta} no ícone de Razão, acima.</p>
        </div>
      )}
    </div>
  );
}
