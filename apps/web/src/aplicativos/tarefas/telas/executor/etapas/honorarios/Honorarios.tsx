// A etapa Honorários (Vitor, 07/10/2026): a linha do razão do Honorários a pagar (como a do Pró-labore: obrigatório e tem
// que zerar) e a pergunta do Cadastro, "o escritório emite nota de honorário?". Sem nota, a linha do Extrato por cobrança
// (o PDF do Alterdata): as cobranças do período e o .xls de importação com a provisão de cada uma na data de emissão.
// Só peças que já existem: a linha da Importação (imp-bloco), a regra do Cadastro (cad-regra), a tabela e a barra.
import { Alerta, CampoArquivo, Icone } from '@nads/ui';
import { useId, useState } from 'react';
import { BotaoDeTeste } from '../../../../../../comum/BotaoDeTeste';
import { RazaoDaFolha } from '../../partes/RazaoDaFolha';
import { MenuDeConta } from '../../../../../extratudo/ferramentas/creditor/partes/MenuDeConta';
import { AvisoAcimaDoCabecalho } from '../contexto';
import { useHonorarios } from './useHonorarios';

type Vm = ReturnType<typeof useHonorarios>;

export function Honorarios() {
  const vm = useHonorarios();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Honorários</h2></div></header>
      {/* a regra do Cadastro: sem resposta, a pergunta vai para o aviso acima do cabeçalho (Vitor, 07/10/2026); respondida, some
          da etapa (Vitor, 16/10/2026: "mesmo eu respondendo, essa box fica permanente") — troca no Cadastro › Parâmetros contábeis */}
      {vm.emiteNota === null && (
        <AvisoAcimaDoCabecalho>
          <div className="alerta-linha">
            <Alerta titulo="Emite nota de honorário?" texto="O escritório emite nota de honorário para esta empresa? Fica guardado no Cadastro.">
              <div className="btn-row">
                <button type="button" className="btn" onClick={() => vm.definirEmiteNota(true)}>Sim</button>
                <button type="button" className="btn" onClick={() => vm.definirEmiteNota(false)}>Não</button>
              </div>
            </Alerta>
          </div>
        </AvisoAcimaDoCabecalho>
      )}
      <div className="imp-lista">
        <RazaoDaFolha vm={vm.razao} dev={vm.dev} />
        {vm.emiteNota === false && <ExtratoPorCobranca vm={vm} />}
      </div>
    </section>
  );
}

function ExtratoPorCobranca({ vm }: { vm: Vm }) {
  const id = useId();
  const [aberta, setAberta] = useState(true);
  const e = vm.extrato;
  return (
    <div className={'imp-bloco' + (e && (!e.pagamentos.length || vm.podeBaixar) ? ' imp-ok' : '')}>
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
              <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.removerExtrato} title={'O Extrato por cobrança: importado. Clique para tirar.'} aria-label="Tirar o Extrato por cobrança">
                <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
              </button>
            ) : vm.lendo ? (
              <span className="icon-btn icon-btn-sm imp-btn" aria-label="Lendo o PDF"><span className="btn-spinner" /></span>
            ) : (
              <>
                <BotaoDeTeste itens={vm.testeExtrato} />
                <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title="Importar o Extrato por cobrança (PDF do Alterdata: as cobranças de honorário do escritório para a empresa)" aria-label="Importar o Extrato por cobrança"><Icone nome="upload" /></label>
                <CampoArquivo semCaixa id={id} aceitar=".pdf,application/pdf" onEscolher={f => { void vm.importarExtrato(f); }} />
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
                <thead><tr><th>Emissão</th><th>Cobrança</th><th>Vencimento</th><th>Pagamento</th><th>Histórico</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {e.cobrancas.map(c => (
                    <tr key={c.numero}>
                      <td>{c.emissao}</td><td>{c.numero}</td><td>{c.vencimento}</td>
                      <td>{c.paga ? c.pagamento : <span className="badge badge-neutral">{c.pagamento}</span>}</td>
                      {/* o histórico da provisão, já pronto (Vitor, 16/10/2026: "já faz o histórico também") */}
                      <td className="wrap hint">{c.historico}</td>
                      <td className="num">{c.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="hint">Nenhuma cobrança emitida nos meses do período.</p>}
          {/* as pagas no período (Vitor, 16/10/2026: "se tiver pago, faça o pagamento e peça o usuário para escolher a conta"):
              D honorários a pagar / C a conta do banco de cada uma, sugerida pelo débito achado no extrato */}
          {e.pagamentos.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table-compact">
                <thead><tr><th>Pagamento</th><th>Cobrança</th><th>Conta do banco (crédito)</th><th>Histórico</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {e.pagamentos.map(p => (
                    <tr key={p.numero}>
                      <td>{p.data}</td><td>{p.numero}</td>
                      <td>
                        <MenuDeConta valor={p.conta} contas={vm.opcoes} onEscolher={c => vm.escolherBanco(p.numero, c)} />
                        <span className="hint" style={{ display: 'block', marginTop: 2 }}>{p.nomeDaConta || 'Escolha a conta do banco'}{p.noExtrato ? ' · no extrato do ' + p.noExtrato : ''}</span>
                      </td>
                      <td className="wrap hint">{p.historico}</td>
                      <td className="num">{p.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* o arquivo do Alterdata: D despesa de honorários / C honorários a pagar, na data de emissão de cada cobrança; só com
              pagamento no PDF (Vitor, 26/10/2026: "se não tem pagamento no PDF, não dê nem a opção de baixar") */}
          {e.pagamentos.length > 0 && <div className="tarefas-barra-topo">
            {/* as contas já vêm escolhidas (Vitor, 16/10/2026: "coloque as contas automaticamente"); dá para trocar */}
            <span className="hint">Despesa</span>
            <MenuDeConta valor={vm.contaDespesa} contas={vm.opcoes} onEscolher={c => vm.mudarConta('despesa', c)} />
            {vm.nomeDespesa && <span className="hint">{vm.nomeDespesa}</span>}
            <span className="hint">Honorários a pagar</span>
            <MenuDeConta valor={vm.contaAPagar} contas={vm.opcoes} onEscolher={c => vm.mudarConta('aPagar', c)} />
            {vm.nomeAPagar && <span className="hint">{vm.nomeAPagar}</span>}
            <span className="tarefas-barra-espaco" />
            {vm.faltaBanco > 0 && <span className="hint">Falta a conta do banco de {vm.faltaBanco} {vm.faltaBanco === 1 ? 'pagamento' : 'pagamentos'}</span>}
            {vm.baixado && <span className="badge badge-ok" title="A planilha foi baixada: o Próximo libera">Baixado</span>}
            <button type="button" className="btn btn-primary" disabled={!vm.podeBaixar} onClick={vm.baixar}
              title={vm.podeBaixar ? 'Baixar o .xls de importação do Alterdata: a provisão de cada cobrança na emissão e o pagamento das pagas' : 'Escolha a conta de despesa, a de honorários a pagar e a do banco de cada pagamento'}>
              <Icone nome="download" />Baixar .xls
            </button>
          </div>}
        </div>
      )}
    </div>
  );
}
