// A ferramenta nads → SCI (23/11/2026, docs/sci): junta as planilhas de importação do nads e baixa a planilha que o
// gerador do SCI importa. No SCI só entram importações; o que estiver errado se trata lá pelo balancete.
import { BotaoAcao, CampoArquivo, Icone, Segmentado, SoltarArquivos, Vazio } from '@nads/ui';
import { formatos, type sci } from '@nads/core';
import { useNadsParaSci } from './useNadsParaSci';

type Vm = ReturnType<typeof useNadsParaSci>;

const ACEITAR = '.xls,.xlsx,.ods,.csv';
/** As linhas mostradas na prévia (a planilha leva todas). */
const NA_PREVIA = 200;

const dataBr = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—');

export function NadsParaSci() {
  const vm = useNadsParaSci();
  return (
    <>
    <div className="ferramentas-corpo">
      <section className="card ferramentas-principal">
        <div className="card-head">
          <h3>{vm.planilhas.length ? vm.resumo.total + ' lançamentos de ' + vm.planilhas.length + (vm.planilhas.length === 1 ? ' planilha' : ' planilhas') : 'As planilhas do nads'}</h3>
          {vm.planilhas.length > 0 && (
            <span className="ferramentas-cabeca-botoes">
              <button type="button" className="btn btn-ghost" onClick={vm.limpar}>Limpar</button>
              <label className="btn btn-outline" htmlFor="sci-planilhas"><Icone nome="plus" />Adicionar</label>
              <CampoArquivo id="sci-planilhas" aceitar={ACEITAR} multiplo semCaixa onEscolherVarios={vm.adicionar} />
            </span>
          )}
        </div>
        {vm.planilhas.length === 0
          ? <SoltarArquivos aceitar={ACEITAR} multiplo icone="grade" titulo="Arraste as planilhas de importação do nads"
              dica="As que o Lançatudo, o Creditor, o Cartões e as outras telas baixam para importar. Tudo fica aqui no navegador: nada vai para o banco."
              desabilitada={vm.ocupado} onArquivos={vm.adicionar} />
          : <SoltarArquivos aceitar={ACEITAR} multiplo onArquivos={vm.adicionar}><Previa vm={vm} /></SoltarArquivos>}
      </section>
      <aside className="card ferramentas-lado"><Lado vm={vm} /></aside>
    </div>
    <Balancete vm={vm} />
    </>
  );
}

const SITUACAO: Record<string, string> = { bate: 'bate', faltou: 'faltou no SCI', 'a mais': 'a mais no SCI', 'fora do balancete': 'não está no balancete' };
const saldo = (c: number) => formatos.reais(Math.abs(c) / 100) + (c > 0 ? ' D' : c < 0 ? ' C' : '');

/** O balancete exportado do SCI: onde olhar no SCI (o tratamento lá é só pelo balancete). */
function Balancete({ vm }: { vm: Vm }) {
  const b = vm.balancete;
  return (
    <section className="card sci-balancete">
      <div className="card-head">
        <h3>Balancete do SCI{b ? ' · ' + (b.b.empresa || b.nome) : ''}</h3>
        <span className="ferramentas-cabeca-botoes">
          {b && <button type="button" className="btn btn-ghost" onClick={vm.tirarBalancete}>Tirar</button>}
          <label className="btn btn-outline" htmlFor="sci-balancete"><Icone nome="upload" />{b ? 'Trocar' : 'Escolher o balancete'}</label>
          <CampoArquivo id="sci-balancete" aceitar={ACEITAR} semCaixa onEscolher={f => f && vm.escolherBalancete([f])} />
        </span>
      </div>
      {!b && <p className="hint">No SCI: Relatórios › Balancete, com "Imprimir conta: Curta" e "Longa" marcados e "Exportar CSV com cabeçalho"; depois Exportar para… › CSV. Aqui aparecem as contas com o saldo contrário à natureza (fornecedor devedor, caixa credor) e, com as planilhas do nads acima, o que faltou ou sobrou no SCI.</p>}
      {b && (
        <>
          <h4>Saldo contrário à natureza ({vm.invertidos.length})</h4>
          {vm.invertidos.length === 0 ? <p className="hint">Nenhuma conta analítica com o saldo invertido.</p> : (
            <div className="table-wrap table-compact">
              <table>
                <thead><tr><th>Classificação</th><th>Código</th><th>Conta</th><th className="num">Saldo atual</th></tr></thead>
                <tbody>{vm.invertidos.map(c => <tr key={c.classificacao}><td>{c.classificacao}</td><td>{c.codigo}</td><td>{c.nome}</td><td className="num">{saldo(c.atual)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {vm.conferencia.length > 0 && (
            <>
              <h4>O que o nads mandou × o movimento no SCI</h4>
              <div className="table-wrap table-compact">
                <table>
                  <thead><tr><th>Conta</th><th>Nome</th><th className="num">nads D</th><th className="num">nads C</th><th className="num">SCI D</th><th className="num">SCI C</th><th>Situação</th></tr></thead>
                  <tbody>{vm.conferencia.map(c => (
                    <tr key={c.codigo} className={c.situacao === 'bate' ? undefined : 'sci-com-problema'}>
                      <td>{c.codigo}</td><td>{c.nome}</td>
                      <td className="num">{formatos.reais(c.nadsDebito / 100)}</td><td className="num">{formatos.reais(c.nadsCredito / 100)}</td>
                      <td className="num">{formatos.reais(c.sciDebito / 100)}</td><td className="num">{formatos.reais(c.sciCredito / 100)}</td>
                      <td>{SITUACAO[c.situacao]}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="hint">"A mais no SCI" pode ser de outra origem (Fiscal, Folha) ou importação em dobro; "faltou" quer dizer que a planilha não entrou inteira.</p>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Previa({ vm }: { vm: Vm }) {
  if (!vm.lancamentos.length) return <Vazio icone="grade" titulo="Nenhum lançamento" texto="Solte outra planilha aqui." />;
  return (
    <>
      <ul className="ferramentas-resumo sci-origens">
        {vm.planilhas.map(p => {
          const o = vm.resumo.porOrigem.find(x => x.origem === p.nome);
          return (
            <li key={p.id}>
              <span title={p.nome}>{p.nome}</span>
              <span>{p.linhas.length}{o?.comProblema ? ' · ' + o.comProblema + ' com problema' : ''}
                <button type="button" className="btn btn-ghost btn-sm" aria-label={'Tirar ' + p.nome} onClick={() => vm.tirar(p.id)}><Icone nome="x" /></button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="table-wrap table-compact sci-previa">
        <table>
          <thead>
            <tr><th>Data</th><th>Débito</th><th>Crédito</th><th className="num">Valor</th><th>Hist.</th><th>Complemento</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {vm.lancamentos.slice(0, NA_PREVIA).map((l, i) => (
              <tr key={i} className={l.problemas.length ? 'sci-com-problema' : undefined}>
                <td>{dataBr(l.data)}</td>
                <td title={l.nomeD}>{l.debito}</td>
                <td title={l.nomeC}>{l.credito}</td>
                <td className="num">{formatos.reais(l.valor / 100)}</td>
                <td>{l.historico || '—'}</td>
                <td>{l.complemento}</td>
                <td>{l.problemas.length ? l.problemas.join('; ') : 'pronto'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vm.lancamentos.length > NA_PREVIA && <p className="hint">Mostrando {NA_PREVIA} de {vm.lancamentos.length}. A planilha leva todos.</p>}
    </>
  );
}

function Lado({ vm }: { vm: Vm }) {
  const r = vm.resumo;
  return (
    <>
      <h3>Para o SCI</h3>
      <label className="hint" htmlFor="sci-cnpj">CNPJ da empresa no SCI (matriz ou filial)</label>
      <input id="sci-cnpj" type="text" inputMode="numeric" value={vm.cnpj} placeholder="00.000.000/0000-00" onChange={e => vm.setCnpj(formatos.mascaraDocumento(e.target.value))} />
      <label className="hint" htmlFor="sci-lote">Lote (para excluir e refazer pelo filtro no SCI)</label>
      <input id="sci-lote" type="text" maxLength={10} value={vm.lote} placeholder={vm.lotePadrao} onChange={e => vm.setLote(e.target.value.toUpperCase())} />
      <label className="hint" htmlFor="sci-historico">Histórico para as linhas sem código</label>
      <input id="sci-historico" type="text" inputMode="numeric" value={vm.historicoPadrao} placeholder="ex.: 116" onChange={e => vm.setHistoricoPadrao(e.target.value.replace(/\D/g, ''))} />

      <span className="hint">Plano do SCI da empresa</span>
      <Segmentado<sci.IdDoPlanoSci | ''> valor={vm.idDoPlano} onMudar={vm.setIdDoPlano} opcoes={[
        { valor: '', rotulo: 'Nenhum' }, { valor: '90113', rotulo: '90113' }, { valor: '90011', rotulo: '90011' },
      ]} />
      {vm.idDoPlano && (
        vm.planoDaEmpresa
          ? <p className="ferramentas-alerta sci-de-para"><Icone nome="check" /><span>{vm.planoDaEmpresa.nome}: {vm.planoDaEmpresa.contas.length} contas
              <button type="button" className="btn btn-ghost btn-sm" onClick={vm.tirarPlanoDaEmpresa}>Tirar</button></span></p>
          : <>
              <label className="btn btn-outline" htmlFor="sci-plano-empresa"><Icone nome="upload" />Plano da empresa (Alterdata)</label>
              <CampoArquivo id="sci-plano-empresa" aceitar={ACEITAR} semCaixa onEscolher={f => f && vm.escolherPlanoDaEmpresa([f])} />
              <p className="hint">Com ele, o de/para sai sozinho: pela classificação e, se não der, pelo nome. Sem ele, o plano só confere as contas.</p>
            </>
      )}
      {vm.pares.length > 0 && (
        <>
          <ul className="ferramentas-resumo">
            <li><span>Pela classificação</span><span>{vm.resumoDoDePara.classificacao}</span></li>
            <li><span>Pelo nome</span><span>{vm.resumoDoDePara.nome}</span></li>
            <li><span>A conferir</span><span>{vm.resumoDoDePara.conferir}</span></li>
            <li><span>Sem par</span><span>{vm.resumoDoDePara.semPar}</span></li>
          </ul>
          <button type="button" className="btn btn-outline" onClick={vm.baixarDePara}><Icone nome="download" />Baixar o de/para para conferir</button>
          <p className="hint">Confira os "a conferir" e "sem par", ponha o código do SCI na 2ª coluna, guarde no Drive e solte abaixo: o que estiver nela vale mais que o automático.</p>
        </>
      )}

      <span className="hint">De/para das contas (nads → SCI)</span>
      {vm.dePara
        ? <p className="ferramentas-alerta sci-de-para"><Icone nome="check" /><span>{vm.dePara.nome}: {vm.dePara.mapa.size} contas
            <button type="button" className="btn btn-ghost btn-sm" onClick={vm.tirarDePara}>Tirar</button></span></p>
        : <>
            <label className="btn btn-outline" htmlFor="sci-de-para"><Icone nome="upload" />Escolher a planilha de de/para</label>
            <CampoArquivo id="sci-de-para" aceitar={ACEITAR} semCaixa onEscolher={f => f && vm.escolherDePara([f])} />
            <p className="hint">Sem ela, as contas vão com os códigos do nads. Colunas: conta no nads, conta no SCI e o nome (opcional).</p>
          </>}

      {r.total > 0 && (
        <ol className="ferramentas-resumo">
          <li><span>Prontos</span><span>{r.prontos}</span></li>
          <li><span>Com problema</span><span>{r.comProblema}</span></li>
          <li><span>Total dos prontos</span><span>{formatos.brl(r.valorPronto / 100)}</span></li>
          {r.meses.length > 1 && <li><span>Meses</span><span>{r.meses.map(formatos.rot).join(', ')}</span></li>}
        </ol>
      )}
      {vm.problemas.length > 0 && (
        <>
          <span className="hint">O que falta</span>
          <ul className="ferramentas-resumo">
            {vm.problemas.slice(0, 6).map(([p, n]) => <li key={p}><span>{p}</span><span>{n}</span></li>)}
          </ul>
        </>
      )}
      <div className="ferramentas-acoes">
        <BotaoAcao className="btn btn-primary" carregando={vm.ocupado} disabled={!r.prontos} onClick={vm.baixar}><Icone nome="download" />Baixar planilha do SCI</BotaoAcao>
        <p className="hint">Aba Importar: só os prontos, com títulos na linha 1 e o total no fim (no gerador do SCI: linha inicial 2, descartar 1). Aba Conferir: os que têm problema.</p>
      </div>
    </>
  );
}
