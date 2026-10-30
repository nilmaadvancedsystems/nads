// Fiscal › Antecipação ICMS-ES (Heverton, 22/10/2026: a planilha "Antecipação ICMS-ES"): a empresa e o período em cima;
// a linha da empresa (razão social, CNPJ, IE, regime e a alíquota interna, editável); três números (as NF-e, a antecipação
// e o a recolher); a contagem por situação, que filtra; a tabela da aba CÁLCULO com a situação de cada linha (as colunas
// do passo a passo do cálculo só com "Ver o cálculo"); os totais por mês, quando há mais de um; Imprimir (o relatório da
// aba RELATÓRIO, A4 deitado). Enxuta em 30/10/2026 ("tem muita informação e os layouts estão feios"): o endereço e o
// responsável ficam no relatório impresso, e os números saíram do arco-íris. Refeita no mesmo dia no jeito do site (o
// Fiscal inteiro, como o Gmail): a empresa num cartão, os números nos cartões da REINF, e a tabela num .card com os
// filtros no topo dele.
import { Alerta, BotaoIcone, Esqueleto, Icone, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { ValorEditavel } from '../../financeiro/partes/ValorEditavel';
import { useAntecipacaoIcms } from './useAntecipacaoIcms';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => String(n).replace('.', ',') + '%';

type Vm = ReturnType<typeof useAntecipacaoIcms>;

function BuscaDaEmpresa({ vm }: { vm: Vm }) {
  if (vm.empresa) {
    return (
      <div className="registro-busca fxr-empresa-busca">
        <Icone nome="briefcase" width={18} height={18} />
        <span className="nf-escolhido"><b>{vm.empresa.codigo ?? '—'}</b> · {vm.empresa.nome}</span>
        <BotaoIcone icone="x" pequeno titulo="Trocar a empresa" onClick={vm.trocar} />
      </div>
    );
  }
  const aberta = vm.achados.length > 0;
  return (
    <div className="fxr-empresa-busca">
      <div className="registro-busca">
        <Icone nome="search" width={18} height={18} />
        <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Empresa: código do ERP ou nome" autoFocus
          aria-label="Buscar a empresa por código ou nome" autoComplete="off" role="combobox" aria-expanded={aberta} aria-controls="antecipacao-achados"
          onKeyDown={e => {
            if (!aberta) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); vm.mover(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); vm.mover(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); vm.escolherDestacado(); }
            else if (e.key === 'Escape') { e.preventDefault(); vm.fecharLista(); }
          }} />
      </div>
      {aberta && (
        <ul className="nf-achados fxr-achados" id="antecipacao-achados" role="listbox" aria-label="Empresas encontradas">
          {vm.achados.map((e, i) => (
            <li key={e.nome + '|' + e.codigo}>
              <button type="button" className={'popover-item' + (i === vm.ativo ? ' nf-ativo' : '')} role="option" aria-selected={i === vm.ativo} tabIndex={-1}
                onMouseEnter={() => vm.setAtivo(i)} onClick={() => vm.escolher(e)}>
                <span className="nf-achado-codigo">{e.codigo ?? '—'}</span>
                <span className="popover-texto">{e.nome}</span>
                {e.regime && <span className="popover-dica">{e.regime}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** O cartão da empresa: o que identifica (para conferir que é a certa) e a alíquota interna, editável, no canto. */
function CartaoDaEmpresa({ vm }: { vm: Vm }) {
  const d = vm.dadosDaEmpresa;
  const partes = [
    d.cnpj && { rotulo: 'CNPJ', valor: d.cnpj },
    d.inscricaoEstadual && { rotulo: 'IE', valor: d.inscricaoEstadual },
    d.regime && { rotulo: 'Regime', valor: d.regime },
    d.municipio && { rotulo: 'Município', valor: d.municipio },
  ].filter(Boolean) as { rotulo: string; valor: string }[];
  return (
    <div className="fxr-empresa">
      <span className="fxr-empresa-icone"><Icone nome="predio" /></span>
      <div className="fxr-empresa-txt">
        <b className="fxr-empresa-nome" title={d.endereco || undefined}>{d.razaoSocial}</b>
        <span className="fxr-empresa-dados">
          {partes.map(p => <span key={p.rotulo}><span className="fraco">{p.rotulo} </span><span className="num">{p.valor}</span></span>)}
        </span>
      </div>
      <span className="fxr-aliquota" title={vm.aliquotaPadrao ? 'A alíquota padrão do ES' : 'A alíquota desta empresa'}>
        <span className="fraco">Alíquota interna</span>
        <span className="fxr-aliquota-valor"><ValorEditavel valor={vm.aliquota} rotulo="Alíquota interna do ES (%)" aoSalvar={vm.mudarAliquota} />%</span>
      </span>
    </div>
  );
}

export function AntecipacaoIcms() {
  const vm = useAntecipacaoIcms();
  useCarregando(vm.carregando);
  const r = vm.resumo;
  const calc = vm.verCalculo;
  return (
    <section className="fxr">
      <div className="tarefas-barra-topo fxr-topo">
        <BuscaDaEmpresa vm={vm} />
        <Segmentado valor={vm.periodo} opcoes={[...vm.periodos]} onMudar={vm.setPeriodo} />
        {/* no Ano, só o ano; no Mês e nos 12 meses, o mês (nunca um que ainda não começou) */}
        {vm.periodo === 'ano'
          ? <Segmentado valor={vm.ano} opcoes={vm.anos} onMudar={vm.setAno} />
          : <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo={vm.periodo === 'mes' ? 'Mês' : 'Até o mês'} max={vm.ultimoMes} />}
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" disabled={!vm.linhas.length} onClick={vm.imprimir}><Icone nome="printer" width={16} height={16} />Imprimir</button>
      </div>
      {vm.exemplos && <p className="hint fxr-exemplos"><Icone nome="ajuda" width={14} height={14} />Dados de exemplo: as notas de entrada do SIEG são inventadas (TESTE) e o que se marca fica só neste navegador.</p>}
      {!vm.empresa ? (
        <section className="card fxr-cartao"><Vazio icone="briefcase" titulo="Escolha a empresa" texto="Digite o código do ERP ou parte do nome, na busca de cima." /></section>
      ) : vm.carregando ? <Esqueleto linhas={8} numeros={3} /> : (
        <>
          {vm.semXml.length > 0 && (
            <Alerta naLinha titulo={'Sem os XMLs do SIEG em ' + vm.semXml.map(m => m.rotulo).join(', ')}
              texto={vm.pedindo || vm.comErro ? vm.situacaoDoRobo : undefined}>
              {vm.progresso && (
                <span className="progresso-linha">
                  <span className="tarefas-barra larga" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={vm.progresso.pct} aria-label={vm.progresso.texto}><span style={{ width: vm.progresso.pct + '%' }} /></span>
                  <span className="num">{vm.progresso.pct}%</span>
                </span>
              )}
              {vm.progresso && <p className="hint">{vm.progresso.texto}</p>}
              {!vm.pedindo && <button type="button" className="btn btn-outline" disabled={!vm.roboLigado} title={vm.roboLigado ? undefined : 'O robô do SIEG está desligado'} onClick={() => void vm.pedirXmls()}><Icone nome="download" width={16} height={16} />{vm.comErro ? 'Pedir de novo' : 'Pedir ao robô'}</button>}
            </Alerta>
          )}
          <CartaoDaEmpresa vm={vm} />
          <div className="fxr-numeros fxr-numeros-3">
            <div className="fxr-numero" title={r.linhas + (r.linhas === 1 ? ' linha' : ' linhas') + ' (uma por CFOP, CST e alíquota da nota)'}>
              <span className="fxr-numero-icone"><Icone nome="fileText" /></span>
              <span className="fxr-numero-txt">
                <span className="fxr-numero-rotulo">NF-e de fora do estado</span>
                <span className="fxr-numero-valor num">{r.notas}</span>
                <span className="fxr-numero-sub num">{brl(r.valorOperacao)} em operações · ICMS {brl(r.icmsDestacado)}</span>
              </span>
            </div>
            <div className="fxr-numero" title="A soma da coluna Antecipação (todas as linhas)">
              <span className="fxr-numero-icone"><Icone nome="recibo" /></span>
              <span className="fxr-numero-txt">
                <span className="fxr-numero-rotulo">Antecipação calculada</span>
                <span className="fxr-numero-valor num">{brl(r.antecipacao)}</span>
              </span>
            </div>
            <div className="fxr-numero fxr-numero-destaque" title="Sem as linhas Dispensado e Não se aplica">
              <span className="fxr-numero-icone"><Icone nome="dinheiro" /></span>
              <span className="fxr-numero-txt">
                <span className="fxr-numero-rotulo">A recolher</span>
                <span className="fxr-numero-valor num">{brl(r.aRecolher)}</span>
              </span>
            </div>
          </div>
          {!vm.total ? (
            <section className="card fxr-cartao">
              <Vazio icone="fileText" titulo="Nenhuma nota de entrada de fora do estado" texto="Nos XMLs do SIEG deste período não há NF-e recebida com CFOP 6xxx." />
            </section>
          ) : (
            <>
              <section className="card fxr-cartao">
                <div className="fxr-cartao-topo">
                  <h3 className="fxr-cartao-titulo">Cálculo</h3>
                  <span className="fxr-total num">{vm.linhas.length} de {vm.total}</span>
                  <span className="tarefas-barra-espaco" />
                  {vm.mesesDasLinhas.length > 1 && (
                    <select className="select-compact select-mini" value={vm.mes} onChange={e => vm.setMes(e.target.value)} aria-label="Mês da nota">
                      <option value="">Todos os meses</option>
                      {vm.mesesDasLinhas.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
                    </select>
                  )}
                  <button type="button" className={'chip-f' + (calc ? ' on' : '')} aria-pressed={calc} onClick={vm.alternarCalculo}
                    title="Mostrar a base do ICMS da NF, a base da antecipação e o ICMS interno">
                    <Icone nome="olho" width={14} height={14} />{calc ? 'Esconder o cálculo' : 'Ver o cálculo'}
                  </button>
                </div>
                <div className="fxr-chips">
                  <button type="button" className={'chip-f' + (!vm.situacao ? ' on' : '')} aria-pressed={!vm.situacao} onClick={() => vm.setSituacao('')}>Todas <span className="gh-counter">{vm.total}</span></button>
                  {vm.situacoes.filter(x => r.porSituacao[x.id] || vm.situacao === x.id).map(x => (
                    <button key={x.id} type="button" className={'chip-f fxr-chip-' + x.id + (vm.situacao === x.id ? ' on' : '')} aria-pressed={vm.situacao === x.id} onClick={() => vm.setSituacao(vm.situacao === x.id ? '' : x.id)}>
                      <i className="fxr-ponto" />{x.rotulo} <span className="gh-counter">{r.porSituacao[x.id]}</span>
                    </button>
                  ))}
                </div>
                {!vm.linhas.length ? <Vazio compacto titulo="Nenhuma nota com esse filtro" /> : (
                  <div className="fxr-rola fxr-rola-antecipacao">
                    <table className="table-compact fxr-tabela">
                      <thead>
                        <tr>
                          <th>NF-e</th><th>Data</th><th>Fornecedor</th><th>CFOP</th><th>CST</th>
                          <th className="num">Valor da operação</th>
                          {calc && <th className="num">Base ICMS NF</th>}
                          <th className="num">Alíq.</th><th className="num">ICMS destacado</th>
                          {calc && <><th className="num">Base antecipação</th><th className="num">ICMS interno</th></>}
                          <th className="num">Antecipação</th><th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vm.linhas.map(l => (
                          <tr key={l.id}>
                            <td className="num fxr-nf">{l.numero}</td>
                            <td className="num">{l.data}</td>
                            <td className="fxr-fornecedor" title={l.fornecedor.nome + (l.ncms.length ? ' · NCM ' + l.ncms.join(', ') : '')}>{l.fornecedor.nome}</td>
                            <td className="num" title={'CFOP do fornecedor: ' + l.cfopDoFornecedor}>{l.cfop}</td>
                            <td className="num">{l.cst}</td>
                            <td className="num">{brl(l.valorOperacao)}</td>
                            {calc && <td className="num fxr-calc">{brl(l.baseNf)}</td>}
                            <td className="num" title={l.aliquotaEstimada ? 'Estimada pelo ICMS e pela base (XML baixado antes da versão 4 do resumo do robô)' : undefined}>{pct(l.aliquotaInterestadual)}{l.aliquotaEstimada ? '*' : ''}</td>
                            <td className="num">{brl(l.icmsDestacado)}</td>
                            {calc && <><td className="num fxr-calc">{brl(l.baseAntecipacao)}</td><td className="num fxr-calc">{brl(l.icmsInterno)}</td></>}
                            <td className="num fxr-antecipacao">{brl(l.antecipacao)}</td>
                            <td>
                              <select className={'select-compact select-mini fxr-situacao situacao-' + l.situacao} value={l.situacao}
                                onChange={e => vm.marcar(l.id, e.target.value as typeof l.situacao)} aria-label={'Situação da NF-e ' + l.numero}
                                title={l.marca ? 'Marcado por ' + l.marca.por + ' em ' + new Date(l.marca.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : l.motivo ? 'Sugerido: ' + l.motivo : 'Ainda não marcado'}>
                                {vm.situacoes.map(x => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5}>Total · {vm.totais.notas} NF-e, {vm.totais.linhas} {vm.totais.linhas === 1 ? 'linha' : 'linhas'}</td>
                          <td className="num">{brl(vm.totais.valorOperacao)}</td>
                          {calc && <td className="num">{brl(vm.totais.baseNf)}</td>}
                          <td />
                          <td className="num">{brl(vm.totais.icmsDestacado)}</td>
                          {calc && <><td className="num">{brl(vm.totais.baseAntecipacao)}</td><td className="num">{brl(vm.totais.icmsInterno)}</td></>}
                          <td className="num">{brl(vm.totais.antecipacao)}</td>
                          {/* o a recolher está no número de cima */}
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
              {vm.porMes.length > 1 && (
                <section className="card fxr-cartao">
                  <div className="fxr-cartao-topo"><h3 className="fxr-cartao-titulo">Por mês</h3><span className="fxr-total">pela data da nota</span></div>
                  <div className="fxr-rola">
                    <table className="table-compact fxr-tabela">
                      <thead><tr><th>Mês</th><th className="num">NF-e</th><th className="num">Valor das operações</th><th className="num">ICMS destacado</th><th className="num">Antecipação</th><th className="num">A recolher</th></tr></thead>
                      <tbody>
                        {vm.porMes.map(m => (
                          <tr key={m.mes}>
                            <td>{m.rotulo}</td><td className="num">{m.notas}</td><td className="num">{brl(m.valorOperacao)}</td><td className="num">{brl(m.icmsDestacado)}</td>
                            <td className="num">{brl(m.antecipacao)}</td><td className="num fxr-antecipacao">{brl(m.aRecolher)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
