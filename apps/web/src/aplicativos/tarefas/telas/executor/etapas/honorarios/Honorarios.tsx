// A etapa Honorários (Vitor, 07/10/2026): a linha do razão do Honorários a pagar (como a do Pró-labore: obrigatório e tem
// que zerar) e a pergunta do Cadastro, "o escritório emite nota de honorário?". Sem nota, a linha do Extrato por cobrança
// (o PDF do Alterdata): as cobranças do período e o .xls de importação com a provisão de cada uma na data de emissão.
// Só peças que já existem: a linha da Importação (imp-bloco), a regra do Cadastro (cad-regra), a tabela e a barra.
import { Icone } from '@nads/ui';
import { useId, useState } from 'react';
import { BotaoDeTeste } from '../../../../../../comum/BotaoDeTeste';
import { RazaoDaFolha } from '../../partes/RazaoDaFolha';
import { useHonorarios } from './useHonorarios';

type Vm = ReturnType<typeof useHonorarios>;

export function Honorarios() {
  const vm = useHonorarios();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Honorários</h2></div></header>
      {/* a regra do Cadastro, perguntada aqui na primeira vez (e trocada aqui ou no Cadastro › Empresa) */}
      {vm.emiteNota !== undefined && <NotaDeHonorario vm={vm} />}
      <div className="imp-lista">
        <RazaoDaFolha vm={vm.razao} dev={vm.dev} />
        {vm.emiteNota === false && <ExtratoPorCobranca vm={vm} />}
      </div>
    </section>
  );
}

function NotaDeHonorario({ vm }: { vm: Vm }) {
  const opcao = (sim: boolean, rotulo: string) => (
    <button type="button" className={'btn ' + (vm.emiteNota === sim ? 'btn-primary' : 'btn-outline')} aria-pressed={vm.emiteNota === sim}
      onClick={() => vm.definirEmiteNota(sim)}>{rotulo}</button>
  );
  return (
    <div className="cad-regra">
      <div className="cad-regra-txt">
        <span className="cad-campo-rotulo">Emite nota de honorário</span>
        <span className="hint">
          {vm.emiteNota === true ? 'A provisão chega pela nota: aqui só o razão.'
            : vm.emiteNota === false ? 'Sem nota: importe o Extrato por cobrança e lance as provisões no Alterdata.'
              : 'O escritório emite nota de honorário para esta empresa? Fica guardado no Cadastro.'}
        </span>
      </div>
      <div className="cad-regra-opcoes" role="group" aria-label="Emite nota de honorário">
        {opcao(true, 'Sim')}
        {opcao(false, 'Não')}
      </div>
    </div>
  );
}

function ExtratoPorCobranca({ vm }: { vm: Vm }) {
  const id = useId();
  const [aberta, setAberta] = useState(true);
  const e = vm.extrato;
  return (
    <div className={'imp-bloco' + (e && vm.podeBaixar ? ' imp-ok' : '')}>
      <div className="imp-linha">
        <button type="button" className={'imp-seta' + (aberta ? ' aberta' : '')} aria-expanded={aberta} disabled={!e}
          title={aberta ? 'Recolher' : 'Abrir'} aria-label="As cobranças do período" onClick={() => setAberta(a => !a)}>
          <Icone nome="caretDown" />
        </button>
        <span className="imp-ico"><Icone nome="fileText" /></span>
        <div className="imp-txt">
          <span><b>Extrato por cobrança</b>{e && <span className="imp-conta">{e.arquivo}</span>}</span>
        </div>
        <div className="imp-resumo">{e && <div>{e.resumo.map(x => <span key={x}>{x}</span>)}</div>}</div>
        <div className="imp-grupos">
          <div className="imp-grupo" aria-label="Extrato por cobrança">
            <span className="imp-rotulo">PDF</span>
            {e ? (
              <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.removerExtrato} title={'O Extrato por cobrança: importado. Clique para excluir.'} aria-label="Excluir o Extrato por cobrança">
                <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
              </button>
            ) : vm.lendo ? (
              <span className="icon-btn icon-btn-sm imp-btn" aria-label="Lendo o PDF"><span className="btn-spinner" /></span>
            ) : (
              <>
                <BotaoDeTeste itens={vm.testeExtrato} />
                <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title="Importar o Extrato por cobrança (PDF do Alterdata: as cobranças de honorário do escritório para a empresa)" aria-label="Importar o Extrato por cobrança"><Icone nome="upload" /></label>
                <input id={id} type="file" accept=".pdf,application/pdf" className="sr-only"
                  onChange={ev => { const f = ev.target.files?.[0] || null; ev.target.value = ''; void vm.importarExtrato(f); }} />
              </>
            )}
          </div>
        </div>
      </div>
      {e && aberta && (
        <div className="imp-periodo-linha">
          {e.cobrancas.length > 0 ? (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th>Emissão</th><th>Cobrança</th><th>Vencimento</th><th>Pagamento</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {e.cobrancas.map(c => (
                    <tr key={c.numero}>
                      <td>{c.emissao}</td><td>{c.numero}</td><td>{c.vencimento}</td>
                      <td>{c.paga ? c.pagamento : <span className="badge badge-neutral">{c.pagamento}</span>}</td>
                      <td className="num">{c.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="hint">Nenhuma cobrança emitida nos meses do período.</p>}
          {/* o arquivo do Alterdata: D despesa de honorários / C honorários a pagar, na data de emissão de cada cobrança */}
          <div className="tarefas-barra-topo">
            <label className="busca-curta" title={'Débito: a despesa de honorários contábeis' + (vm.nomeDespesa ? ' (' + vm.nomeDespesa + ')' : '')}>
              <Icone nome="hash" />
              <input type="text" inputMode="numeric" placeholder="Despesa (débito)" aria-label="Código da conta de despesa de honorários (débito)"
                value={vm.contaDespesa} onChange={ev => vm.mudarConta('despesa', ev.target.value)} />
            </label>
            <label className="busca-curta" title={'Crédito: honorários a pagar' + (vm.nomeAPagar ? ' (' + vm.nomeAPagar + ')' : '')}>
              <Icone nome="hash" />
              <input type="text" inputMode="numeric" placeholder="Honorários a pagar (crédito)" aria-label="Código da conta de honorários a pagar (crédito)"
                value={vm.contaAPagar} onChange={ev => vm.mudarConta('aPagar', ev.target.value)} />
            </label>
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-primary" disabled={!vm.podeBaixar} onClick={vm.baixar}
              title={vm.podeBaixar ? 'Baixar o .xls de importação do Alterdata: a provisão de cada cobrança na data de emissão' : 'Informe a conta de despesa e a de honorários a pagar'}>
              <Icone nome="download" />Baixar .xls
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
