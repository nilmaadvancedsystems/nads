// A etapa Adiantamento a fornecedores da Tarefa (Vitor, 07/10/2026), no esquema de Clientes: a linha do arquivo (o ícone de
// importar o razão; importado, o check que vira × e tira), a grade dos meses com o saldo do fim de cada mês (o credor em
// vermelho) e a faixa com os lançamentos. Mês credor: no cabeçalho, só "<adiantamento> está credor" e o "Corrigi, irei
// reimportar" (tira o razão para importar o corrigido; Vitor, 07/10/2026), e o Próximo da Tarefa fica travado.
import { Icone } from '@nads/ui';
import { useRef } from 'react';
import { BotaoDeTeste } from '../../../../../../comum/BotaoDeTeste';
import { FaixaQueAbre } from '../../../../../../comum/FaixaQueAbre';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../../comum/GradeDosMeses';
import { useAdiantamento } from './useAdiantamento';

export function Adiantamento({ lado = 'fornecedores' }: { lado?: 'fornecedores' | 'clientes' }) {
  const vm = useAdiantamento(lado);
  const Nome = vm.nome.charAt(0).toUpperCase() + vm.nome.slice(1);
  const arquivo = useRef<HTMLInputElement>(null);
  const grade = useColunaAjustavel('adiantamento-' + lado, Math.max(14, 22 - vm.meses.length) + '%', vm.meses.length);
  const escolher = (ev: React.ChangeEvent<HTMLInputElement>) => { const f = ev.target.files?.[0]; ev.target.value = ''; vm.importar(f); };
  return (
    <section>
      <header className="topbar">
        <div><h2 className="page-title">{Nome}</h2></div>
        {/* o mês do lado errado, no cabeçalho (Vitor, 07/10/2026: "escreva só '… está credor' e o botão"): o Corrigi tira o
            razão, para importar o corrigido */}
        {vm.credores.length > 0 && (
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <span className="badge badge-warn" title={'Saldo ' + vm.errado + ' em ' + vm.credores.join(', ')}>{Nome} está {vm.errado}</span>
            <button type="button" className="btn btn-primary" onClick={vm.tirar}>Corrigi, irei reimportar</button>
          </div>
        )}
      </header>
      {vm.aMais.length > 0 && (
        <p className="hint">O razão traz meses fora do período da tarefa ({vm.aMais.join(', ')}): eles ficam de fora.</p>
      )}

      <div className="imp-lista">
        <div className={'imp-bloco' + (vm.razao && !vm.credores.length ? ' imp-ok' : '')}>
          <div className="imp-linha">
            <span className="imp-ico imp-logo"><Icone nome="fileText" /></span>
            <div className="imp-txt"><span><b>Razão do {vm.nome}</b>{/* sem o texto de ajuda (Vitor, 08/10/2026): só o nome do arquivo, quando importado */}{vm.razao && <span className="imp-conta">{vm.razao.nome}</span>}</span></div>
            <div className="imp-resumo">{vm.razao && <div><span>{vm.razao.resumo}</span></div>}</div>
            <div className="imp-grupos">
              <div className="imp-grupo">
                {vm.razao ? (
                  <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.tirar} title={'Importado: ' + vm.razao.nome + '. Clique para tirar.'} aria-label="Tirar o razão">
                    <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                  </button>
                ) : (
                  <>
                    <BotaoDeTeste itens={vm.teste} />
                    <button type="button" className="icon-btn icon-btn-sm imp-btn" title={'Importar o razão do ' + vm.nome} aria-label="Importar o razão" onClick={() => arquivo.current?.click()}>
                      <Icone nome="upload" />
                    </button>
                    <input ref={arquivo} type="file" accept=".xls,.xlsx,.ods" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={escolher} />
                  </>
                )}
              </div>
            </div>
          </div>
          {vm.razao && (
            <>
              {/* o saldo do fim de cada mês, na grade dos meses (como em Clientes); o mês credor em vermelho */}
              <div className="imp-periodo-linha">
                <table className="imp-meses" style={grade.tabela}>
                  <colgroup><col style={{ width: grade.largura }} /></colgroup>
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Mês</span>{grade.alca}</th>
                      {vm.meses.map(m => <th key={m.mes} scope="col">{m.rotulo}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row" style={{ textAlign: 'left' }} title="O saldo no fim do mês">Saldo final</th>
                      {vm.meses.map(m => <td key={m.mes} className={'num ' + m.cor} title={m.credor ? (lado === 'fornecedores' ? 'Credor' : 'Devedor') + ': corrija no Alterdata' : m.zerado ? 'Zerado' : (lado === 'fornecedores' ? 'Devedor' : 'Credor')}><ValorNaGrade texto={m.saldo} /></td>)}
                    </tr>
                    <tr><th scope="row" style={{ textAlign: 'left' }}>Lançamentos</th>
                      {vm.meses.map(m => <td key={m.mes} className="num">{m.qtd || '—'}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              <FaixaQueAbre titulo="Lançamentos" qtd={vm.lancamentos.length}>
                <div className="imp-mov">
                  <table className="table-compact">
                    <thead><tr><th>Data</th><th>Contrapartida</th><th>Histórico</th><th className="num">Valor</th><th className="num">Saldo</th></tr></thead>
                    <tbody>
                      <tr className="imp-mov-anterior"><td colSpan={4}>Saldo anterior</td><td className="num">{vm.saldoAnterior}</td></tr>
                      {vm.lancamentos.map(l => (
                        <tr key={l.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{l.data}</td>
                          <td>{l.contrapartida}</td>
                          <td className="wrap">{l.historico}</td>
                          {/* débito e crédito numa coluna só (Vitor, 07/10/2026): o devedor em azul e o credor em vermelho */}
                          <td className={'num ' + l.corDoValor}>{l.valor}</td>
                          <td className={'num ' + l.cor}>{l.saldo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FaixaQueAbre>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
