// O Caixa na etapa, no desenho da Importação do banco (Vitor, 05/10/2026): a linha da conta com o Razão à direita (o
// ícone importa; importado, o ✓ que exclui), a grade dos meses (clicar abre o mês; de novo, volta para o período todo) e
// a faixa Pontos de atenção (a Lançamentos saiu em 14/10/2026). Em cima, o aviso do Creditor quando o caixa tem liquidação de cobrança.
import { Alerta, CampoArquivo, Icone } from '@nads/ui';
import { useId, useState } from 'react';
import { FaixaQueAbre } from '../../../../../comum/FaixaQueAbre';
import type { RazaoDaEtapa as Razao } from '../useRazaoDaEtapa';
import { BotaoDeTeste, type ItemDeTeste } from '../../../../../comum/BotaoDeTeste';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../comum/GradeDosMeses';
import { TabelaCaixaNoBanco, TabelaNotasNoCaixa } from '../etapas/caixabancos/CaixaNoBanco';

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

export function RazaoDaEtapa({ conta, razao, conferir, teste = [] }: { conta: string; razao: Razao; conferir?: string[]; teste?: ItemDeTeste[] }) {
  const id = useId();
  const [aberta, setAberta] = useState(true);
  const nome = conta.charAt(0).toUpperCase() + conta.slice(1);
  const grade = useColunaAjustavel('caixa', '96px', razao.meses.length);
  return (
    <div className="executor-razao">
      {razao.creditor.length > 0 && (
        <Alerta naLinha titulo="Liquidação de cobrança no caixa: faça o Creditor"
          texto={<>O caixa tem CRÉD.LIQ.COBRANÇA em {razao.creditor.join(', ')}. A etapa Creditor entrou na rotina {razao.creditor.length === 1 ? 'desse mês' : 'desses meses'}, logo depois do Caixa, e é obrigatória.</>} />
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
            <span className="imp-ico"><Icone nome="dinheiro" /></span>
            <div className="imp-txt">
              <span><b>{nome}</b>{razao.arquivo && <span className="imp-conta">{razao.arquivo}</span>}</span>
            </div>
            <div className="imp-resumo">{razao.resumo && <div><span>{razao.resumo}</span></div>}</div>
            <div className="imp-grupos">
              <div className="imp-grupo" aria-label={'Razão do ' + conta}>
                <span className="imp-rotulo">Razão</span>
                {razao.carregado ? (
                  <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={razao.remover}
                    title={'Razão do ' + conta + ': importado. Clique para tirar.'} aria-label={'Tirar o razão do ' + conta}>
                    <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                  </button>
                ) : (
                  <>
                    <BotaoDeTeste itens={teste} />
                    <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title={'Importar o razão do ' + conta + ' (XLS da conciliação do Alterdata)'} aria-label={'Importar o razão do ' + conta}>
                      <Icone nome="upload" />
                    </label>
                    <CampoArquivo semCaixa id={id} aceitar=".xls,.xlsx,.ods" onEscolher={f => { void razao.importar(f); }} />
                  </>
                )}
              </div>
            </div>
          </div>
          {razao.carregado && aberta && (
            <>
              <div className="imp-periodo-linha">
                <table className="imp-meses" style={grade.tabela}>
                  <colgroup><col style={{ width: grade.largura }} /></colgroup>
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Mês</span>{grade.alca}</th>
                      {razao.meses.map(m => (
                        <th key={m.mes} scope="col" className={m.mes === razao.mesAberto ? 'atual' : undefined}>
                          <button type="button" className="imp-meses-mes" aria-current={m.mes === razao.mesAberto ? 'true' : undefined} onClick={() => razao.abrirMes(m.mes)}
                            title={m.mes === razao.mesAberto ? 'Voltar para o período todo' : 'Ver só ' + m.rotulo}>{m.rotulo}</button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row">Saldo final</th>{razao.meses.map(m => <td key={m.mes} className={(m.mes === razao.mesAberto ? 'atual ' : '') + 'num' + (m.credor ? ' ext-neg' : '')} title={m.credor ? 'Ficou credor em algum dia do mês' : undefined}><ValorNaGrade texto={m.saldoFinal} /></td>)}</tr>
                    <tr><th scope="row">Pendências</th>{razao.meses.map(m => (
                      <td key={m.mes} className={m.mes === razao.mesAberto ? 'atual' : undefined}>
                        {m.creditor ? <span className="badge badge-neutral" title="CRÉD.LIQ.COBRANÇA: o Creditor entrou neste mês">Creditor</span> : m.atencoes || '—'}
                      </td>
                    ))}</tr>
                  </tbody>
                </table>
              </div>
              {/* sem a faixa Lançamentos (Vitor, 14/10/2026: "remove lançamentos"): só os pontos de atenção */}
              <FaixaQueAbre titulo="Pontos de atenção" qtd={razao.qtdAtencoes} aviso={razao.qtdAtencoes > 0}>
                <div className="imp-mov-caixa">
                  <span className="imp-mov-periodo">Mostrando {razao.mostrando}</span>
                  {!razao.atencoes.length && <p className="hint">Nenhum ponto de atenção.</p>}
                  {razao.atencoes.map(p => (
                    <div key={p.tipo}>
                      {/* só o título (Vitor, 14/10/2026: sem o "Atenção", a contagem e a explicação); o "Obrigatório" fica */}
                      <p><b>{p.titulo}</b>{p.obrigatorio && <> <span className="badge badge-neutral">Obrigatório</span></>}</p>
                      <TabelaDeLancamentos linhas={p.linhas} />
                    </div>
                  ))}
                </div>
              </FaixaQueAbre>
              {/* o Caixa × bancos, agora aqui (Vitor, 16/10/2026: a mesma pergunta e o mesmo razão do Caixa): o que saiu do
                  caixa e também saiu do banco, com o mesmo valor, até 5 dias; só sugere */}
              {/* o conciliador (Vitor, 16/10/2026: "era essa função que eu queria"): as notas em aberto pagas ou recebidas pelo caixa */}
              {conta === 'caixa' && (
                <FaixaQueAbre titulo="Notas e pagamentos do banco no caixa" qtd={razao.noBanco.notas.length} aviso={razao.noBanco.notas.length > 0}>
                  <div className="imp-mov-caixa"><TabelaNotasNoCaixa vm={razao.noBanco} /></div>
                </FaixaQueAbre>
              )}
              {conta === 'caixa' && (
                <FaixaQueAbre titulo="Pago pelo banco e lançado no caixa" qtd={razao.noBanco.itens.length} aviso={razao.noBanco.itens.length > 0}>
                  <div className="imp-mov-caixa"><TabelaCaixaNoBanco vm={razao.noBanco} /></div>
                </FaixaQueAbre>
              )}
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
