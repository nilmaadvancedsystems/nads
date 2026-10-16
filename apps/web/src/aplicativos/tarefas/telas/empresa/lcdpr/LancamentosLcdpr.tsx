// LCDPR › Lançamentos (o "Importar e conferir" do lcdpr.html) no desenho do nads: sem lançamento, o vazio com o escolher
// os relatórios do SIEG; com eles, o resumo com a barra ("dá pra exportar?") e o Baixar planilha .xls, a barra (Todos /
// Só REVISAR, a seleção com o Classificar como, a busca e importar mais), os grupos do que falta revisar, a lista (a
// categoria muda na própria linha; clicar na linha abre o lançamento) e os arquivos lidos nesta sessão, com o Desfazer.
import { Alerta, CampoArquivos, Icone, MenuSuspenso, Segmentado } from '@nads/ui';
import { JanelaDoLancamento } from './JanelaDoLancamento';
import { useLancamentosLcdpr } from './useLancamentosLcdpr';

const ACEITA = '.xlsx,.xls';

export function LancamentosLcdpr() {
  const vm = useLancamentosLcdpr();
  const opcoes = (vazio: string) => [<option key="" value="">{vazio}</option>, ...vm.categorias.map(c => <option key={c} value={c}>{c}</option>)];
  return (
    <>
      {vm.aberto !== null && <JanelaDoLancamento id={vm.aberto} fechar={vm.fechar} />}
      {vm.desfazer && (
        <Alerta tom="ok" titulo={vm.desfazer.titulo} onFechar={vm.esquecerDesfazer}>
          <div className="btn-row"><button type="button" className="btn" onClick={vm.voltarDesfeito}><Icone nome="girar" />Desfazer</button></div>
        </Alerta>
      )}
      {vm.erro && <p className="registro-dica registro-dica-erro nf-exemplos"><Icone nome="alert" />{vm.erro}</p>}

      {vm.total === 0 ? (
        <div className="gh-blank">
          <Icone nome="fileUp" />
          <h4>Nenhum lançamento ainda</h4>
          <p>Importe o Relatório de Detalhamento de Produtos e/ou o Relatório de CT-e do SIEG (.xlsx). Os lançamentos não ficam guardados: valem enquanto o nads estiver aberto.</p>
          <p className="cad-botoes">
            <CampoArquivos id="lcdpr-relatorios" aceitar={ACEITA} desabilitado={!vm.carregada || !!vm.lendo || !!vm.erro} onEscolher={fs => void vm.importar(fs)}
              rotulo={vm.lendo || (vm.carregada ? 'Escolher os relatórios do SIEG' : 'Carregando as regras…')} />
          </p>
        </div>
      ) : (
        <>
          <section className="card fgts-resumo">
            <div className="fgts-resumo-topo">
              <div className="fgts-resumo-titulo">
                <h3>Lançamentos do LCDPR</h3>
                <span className="hint"><b className="num">{vm.classificados}</b> de <b className="num">{vm.total}</b> classificados · {vm.valor}</span>
              </div>
              <span className="fgts-robo-linha">
                <span className={'bolinha-sit ' + (vm.revisar ? 'parada' : 'concluida')} aria-hidden="true" />
                {vm.revisar ? <>Faltam <b>{vm.revisar}</b> para revisar antes de exportar</> : 'Tudo classificado: pode baixar a planilha'}
              </span>
              <button type="button" className={'btn ' + (vm.pronto ? 'btn-primary' : 'btn-outline')} onClick={() => void vm.baixar()}>
                <Icone nome="download" />Baixar planilha .xls
              </button>
            </div>
            <span className="tarefas-barra fgts-barra" role="img" aria-label={vm.classificados + ' de ' + vm.total + ' lançamentos classificados'}>
              <span style={{ width: vm.pct + '%' }} />
            </span>
          </section>

          <div className="tarefas-barra-topo">
            <Segmentado valor={vm.soRevisar ? 'revisar' : 'todos'} onMudar={v => { if ((v === 'revisar') !== vm.soRevisar) vm.alternarRevisar(); }}
              opcoes={[{ valor: 'todos', rotulo: 'Todos' }, { valor: 'revisar', rotulo: 'Só REVISAR · ' + vm.revisar }]} />
            {vm.selecionados > 0 ? (
              <>
                <span className="tarefas-contador"><Icone nome="check" /><b>{vm.selecionados}</b> selecionada(s)</span>
                <MenuSuspenso rotulo="Classificar como" titulo="A categoria para os selecionados" className="btn btn-primary" largura={320}
                  itens={vm.categorias.map(c => ({ rotulo: c, onClick: () => vm.classificarSelecao(c) }))} />
                <button type="button" className="btn btn-ghost" onClick={vm.limparSelecao}>Limpar seleção</button>
              </>
            ) : (
              <MenuSuspenso rotulo="Selecionar" titulo="Selecionar" itens={[
                { rotulo: 'Todas as REVISAR', icone: 'alert', onClick: vm.marcarRevisar },
                { rotulo: 'Todas as visíveis', icone: 'checklist', onClick: () => vm.marcarVisiveis(true) },
              ]} />
            )}
            <span className="tarefas-barra-espaco" />
            <label className="busca-curta">
              <Icone nome="search" />
              <input type="text" placeholder="Fornecedor, documento, histórico" aria-label="Buscar por fornecedor, documento, histórico ou produto" value={vm.busca}
                onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
            </label>
            <CampoArquivos id="lcdpr-mais" compacto aceitar={ACEITA} desabilitado={!vm.carregada || !!vm.lendo} onEscolher={fs => void vm.importar(fs)}
              rotulo="Importar mais relatórios do SIEG" />
          </div>
          {vm.lendo && <p className="registro-dica nf-exemplos"><Icone nome="clock" />{vm.lendo}</p>}

          {vm.grupos.length > 0 && (
            <div className="nf-exemplos">
              <Alerta naLinha titulo={vm.grupos.length + ' grupo(s) para classificar'} texto="Mesmo NCM e mesmo fornecedor quase sempre é a mesma conta: escolha a categoria uma vez para o grupo.">
                <ul className="imp-recebidos">
                  {vm.grupos.map(g => (
                    <li key={g.chave}>
                      <span className="imp-recebidos-nome"><b>{g.fornecedor}</b><span className="hint">{g.detalhe}</span></span>
                      <select className="select-compact lanc-sel" value="" aria-label={'Categoria para ' + g.fornecedor} onChange={e => vm.classificarGrupo(g.chave, e.target.value)}>
                        {opcoes('Escolher a categoria…')}
                      </select>
                    </li>
                  ))}
                </ul>
              </Alerta>
            </div>
          )}

          <div className="table-wrap lcdpr-tabela">
            <table className="cad-lista lcdpr-lancamentos">
              <thead>
                <tr>
                  <th className="lcdpr-marca"><input type="checkbox" checked={vm.todosVisiveisMarcados} onChange={e => vm.marcarVisiveis(e.target.checked)} aria-label="Selecionar os visíveis" /></th>
                  <th>Situação</th><th>Categoria</th><th>Data</th><th>Fornecedor</th><th>Documento</th><th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.id} className="linha-abre" tabIndex={0} title="Ver e corrigir o lançamento"
                    onClick={() => vm.abrir(l.id)} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) vm.abrir(l.id); }}>
                    <td className="lcdpr-marca" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={l.selecionado} onChange={() => vm.alternar(l.id)} aria-label={'Selecionar ' + l.fornecedor + ' ' + l.documento} />
                    </td>
                    <td>
                      <span className="lcdpr-selos">
                        <span className="badge badge-neutral">{l.origem}</span>
                        {l.revisar ? <span className="badge badge-warn">REVISAR</span> : l.regra && <span className={l.regra.classe} title={'Classificado por: ' + l.regra.rotulo}>{l.regra.rotulo}</span>}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <select className={'select-compact lanc-sel' + (l.categoria ? ' preenchido' : '')} value={l.categoria} aria-label={'Categoria de ' + l.fornecedor}
                        onChange={e => vm.escolherCategoria(l.id, e.target.value)}>
                        {opcoes(l.categoria ? '— sem categoria —' : '— nenhuma —')}
                      </select>
                    </td>
                    <td className="num fraco">{l.data}</td>
                    <td><span className="lcdpr-corta" title={l.fornecedor}>{l.fornecedor}</span></td>
                    <td className="num">{l.documento}</td>
                    <td className="num">{l.valor}</td>
                  </tr>
                ))}
                {!vm.linhas.length && <tr><td colSpan={7} className="empty">Nenhum lançamento com isso.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {vm.importacoes.length > 0 && (
        <div className="card lcdpr-arquivos">
          <div className="card-head"><h3>Arquivos lidos nesta sessão</h3><span className="badge badge-neutral">{vm.importacoes.length}</span></div>
          <div className="table-wrap">
            <table className="cad-lista">
              <thead><tr><th>Arquivo</th><th>Lido em</th><th>Resultado</th><th /></tr></thead>
              <tbody>
                {vm.importacoes.map(i => (
                  <tr key={i.id}>
                    <td>{i.arquivo}</td>
                    <td className="num fraco">{i.em}</td>
                    <td>{i.erro ? <span className="badge badge-bad">{i.erro}</span> : <span className="fraco">{i.resultado}</span>}</td>
                    <td className="num">
                      {i.podeDesfazer ? <button type="button" className="btn btn-danger" onClick={() => void vm.desfazerImportacao(i.id)}>Desfazer</button>
                        : i.desfeita ? <span className="fraco">desfeita</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
