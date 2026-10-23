// Fiscal › Antecipação ICMS-ES (Heverton, 22/10/2026: a planilha "Antecipação ICMS-ES"): a empresa e o período em cima;
// os dados da empresa; o resumo (as NF-e, o valor, o ICMS destacado, a antecipação, o a recolher e a alíquota interna,
// editável); a contagem por situação, que filtra; a tabela da aba CÁLCULO com a situação de cada linha; os totais por mês;
// Imprimir (o relatório da aba RELATÓRIO, A4 deitado). Só as peças do catálogo (busca de cliente com lista, Segmentado,
// SeletorMes, números em painéis, valor editável, chips, seleção compacta, Tabela padrão, dados em linhas, Alerta, Vazio).
import { Alerta, BotaoIcone, Esqueleto, Icone, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { ValorEditavel } from '../../financeiro/partes/ValorEditavel';
import { useAntecipacaoIcms } from './useAntecipacaoIcms';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => String(n).replace('.', ',') + '%';

type Vm = ReturnType<typeof useAntecipacaoIcms>;

function BuscaDaEmpresa({ vm }: { vm: Vm }) {
  if (vm.empresa) {
    return (
      <div className="registro-busca antecipacao-empresa">
        <Icone nome="briefcase" width={18} height={18} />
        <span className="nf-escolhido"><b>{vm.empresa.codigo ?? '—'}</b> · {vm.empresa.nome}</span>
        <BotaoIcone icone="x" pequeno titulo="Trocar a empresa" onClick={vm.trocar} />
      </div>
    );
  }
  const aberta = vm.achados.length > 0;
  return (
    <div className="antecipacao-empresa">
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
        <ul className="nf-achados antecipacao-achados" id="antecipacao-achados" role="listbox" aria-label="Empresas encontradas">
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

export function AntecipacaoIcms() {
  const vm = useAntecipacaoIcms();
  useCarregando(vm.carregando);
  const r = vm.resumo;
  const numeros: { rotulo: string; valor: string; tom: string; icone: Parameters<typeof Icone>[0]['nome']; dica?: string }[] = [
    { rotulo: 'Total de NF-e', valor: String(r.notas), tom: 'info', icone: 'fileText', dica: r.linhas + (r.linhas === 1 ? ' linha' : ' linhas') + ' (uma por CFOP, CST e alíquota da nota)' },
    { rotulo: 'Valor das operações', valor: brl(r.valorOperacao), tom: 'neutro', icone: 'dinheiro' },
    { rotulo: 'ICMS destacado', valor: brl(r.icmsDestacado), tom: 'roxo', icone: 'recibo' },
    { rotulo: 'Antecipação calculada', valor: brl(r.antecipacao), tom: 'laranja', icone: 'barChart', dica: 'A soma da coluna Antecipação (todas as linhas)' },
    { rotulo: 'A recolher', valor: brl(r.aRecolher), tom: 'marca', icone: 'alvo', dica: 'Sem as linhas Dispensado e Não se aplica' },
  ];
  return (
    <section className="antecipacao">
      <div className="tarefas-barra-topo">
        <BuscaDaEmpresa vm={vm} />
        <Segmentado valor={vm.periodo} opcoes={[...vm.periodos]} onMudar={vm.setPeriodo} />
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" disabled={!vm.linhas.length} onClick={vm.imprimir}><Icone nome="printer" width={16} height={16} />Imprimir</button>
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: as notas de entrada do SIEG são inventadas (TESTE) e o que se marca fica só neste navegador.</p>}
      {!vm.empresa ? (
        <Vazio icone="briefcase" titulo="Escolha a empresa" texto="Digite o código do ERP ou parte do nome. As notas de entrada de fora do estado vêm dos XMLs do SIEG de cada mês do período." />
      ) : vm.carregando ? <Esqueleto linhas={8} numeros={5} /> : (
        <>
          <p className="hint">
            {vm.rotuloDoPeriodo}. Fonte: os XMLs do SIEG (as NF-e recebidas com CFOP 6xxx, sem as canceladas). Base da antecipação = valor da operação
            (produto, despesas e IPI); ICMS interno = base × alíquota interna; antecipação = ICMS interno − ICMS destacado.
          </p>
          {vm.semXml.length > 0 && (
            <Alerta naLinha titulo={'Sem os XMLs do SIEG em ' + vm.semXml.map(m => m.rotulo).join(', ')}
              texto={vm.pedindo ? 'O robô está baixando; as notas entram sozinhas quando ele terminar.' : 'As notas desses meses não entram até o robô baixar os XMLs (o mesmo "Baixar XMLs do SIEG" da rotina).'}>
              {!vm.pedindo && <button type="button" className="btn btn-outline" disabled={!vm.roboLigado} title={vm.roboLigado ? undefined : 'O robô do SIEG está desligado'} onClick={() => void vm.pedirXmls()}><Icone nome="download" width={16} height={16} />Pedir ao robô</button>}
            </Alerta>
          )}
          {vm.antigos.length > 0 && (
            <p className="hint">Em {vm.antigos.join(', ')} os XMLs foram baixados antes de o robô guardar a base e a alíquota de cada item: a alíquota interestadual é estimada pelo ICMS (marcada com *). Baixe os XMLs de novo para os números exatos.</p>
          )}
          <section className="card antecipacao-dados">
            <dl className="ent-dados">
              <div><dt>Razão social</dt><dd>{vm.dadosDaEmpresa.razaoSocial}</dd></div>
              {vm.dadosDaEmpresa.cnpj && <div><dt>CNPJ</dt><dd className="num">{vm.dadosDaEmpresa.cnpj}</dd></div>}
              {vm.dadosDaEmpresa.inscricaoEstadual && <div><dt>Inscrição estadual</dt><dd className="num">{vm.dadosDaEmpresa.inscricaoEstadual}</dd></div>}
              {vm.dadosDaEmpresa.regime && <div><dt>Regime</dt><dd>{vm.dadosDaEmpresa.regime}</dd></div>}
            </dl>
            <dl className="ent-dados">
              {vm.dadosDaEmpresa.endereco && <div><dt>Endereço</dt><dd>{vm.dadosDaEmpresa.endereco}</dd></div>}
              {vm.dadosDaEmpresa.municipio && <div><dt>Município/UF</dt><dd>{vm.dadosDaEmpresa.municipio}</dd></div>}
              {vm.dadosDaEmpresa.responsavel && <div><dt>Responsável</dt><dd>{vm.dadosDaEmpresa.responsavel}</dd></div>}
              <div>
                <dt>Alíquota interna ES</dt>
                <dd className="antecipacao-aliquota">
                  <ValorEditavel valor={vm.aliquota} rotulo="Alíquota interna do ES (%)" aoSalvar={vm.mudarAliquota} />%
                  <span className="fraco">{vm.aliquotaPadrao ? 'a padrão' : 'desta empresa'}</span>
                </dd>
              </div>
            </dl>
          </section>
          <div className="stat-grid dp-numeros">
            {numeros.map(n => (
              <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom} title={n.dica}>
                <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} width={18} height={18} /></span>
                <p className="stat-label">{n.rotulo}</p>
                <p className="stat-value num">{n.valor}</p>
              </div>
            ))}
          </div>
          {!vm.total ? (
            <Vazio icone="fileText" titulo="Nenhuma nota de entrada de fora do estado" texto="Nos XMLs do SIEG deste período não há NF-e recebida com CFOP 6xxx." />
          ) : (
            <>
              <div className="chip-row">
                <span className="chip-lbl">Situação</span>
                <button type="button" className={'chip-f' + (!vm.situacao ? ' on' : '')} onClick={() => vm.setSituacao('')}>Todas ({vm.total})</button>
                {vm.situacoes.map(x => (
                  <button key={x.id} type="button" className={'chip-f' + (vm.situacao === x.id ? ' on' : '')} onClick={() => vm.setSituacao(vm.situacao === x.id ? '' : x.id)}>
                    {x.rotulo} ({r.porSituacao[x.id]})
                  </button>
                ))}
                <span className="tarefas-barra-espaco" />
                <span className="chip-lbl">Mês</span>
                <select className="select-compact" value={vm.mes} onChange={e => vm.setMes(e.target.value)} aria-label="Mês da nota">
                  <option value="">Todos</option>
                  {vm.mesesDasLinhas.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
                </select>
              </div>
              <div className="table-wrap antecipacao-tabela">
                <table className="table-compact">
                  <thead>
                    <tr>
                      <th>NF-e</th><th>Data</th><th>Fornecedor</th><th>CFOP</th><th>CST</th>
                      <th className="num">Valor da operação</th><th className="num">Base ICMS NF</th><th className="num">Alíq. inter.</th><th className="num">ICMS destacado</th>
                      <th className="num">Base antecipação</th><th className="num">ICMS interno</th><th className="num">Antecipação</th><th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.linhas.map(l => (
                      <tr key={l.id}>
                        <td className="num">{l.numero}</td>
                        <td className="num">{l.data}</td>
                        <td className="antecipacao-fornecedor" title={l.fornecedor.nome + (l.ncms.length ? ' · NCM ' + l.ncms.join(', ') : '')}>{l.fornecedor.nome}</td>
                        <td className="num" title={'CFOP do fornecedor: ' + l.cfopDoFornecedor}>{l.cfop}</td>
                        <td className="num">{l.cst}</td>
                        <td className="num">{brl(l.valorOperacao)}</td>
                        <td className="num">{brl(l.baseNf)}</td>
                        <td className="num" title={l.aliquotaEstimada ? 'Estimada pelo ICMS e pela base (XML baixado antes da versão 4 do resumo do robô)' : undefined}>{pct(l.aliquotaInterestadual)}{l.aliquotaEstimada ? '*' : ''}</td>
                        <td className="num">{brl(l.icmsDestacado)}</td>
                        <td className="num">{brl(l.baseAntecipacao)}</td>
                        <td className="num">{brl(l.icmsInterno)}</td>
                        <td className="num"><b>{brl(l.antecipacao)}</b></td>
                        <td>
                          <select className="select-compact" value={l.situacao} onChange={e => vm.marcar(l.id, e.target.value as typeof l.situacao)} aria-label={'Situação da NF-e ' + l.numero}
                            title={l.marca ? 'Marcado por ' + l.marca.por + ' em ' + new Date(l.marca.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : l.motivo ? 'Sugerido: ' + l.motivo : 'Ainda não marcado'}>
                            {vm.situacoes.map(x => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}><b>Total ({vm.totais.notas} NF-e, {vm.totais.linhas} {vm.totais.linhas === 1 ? 'linha' : 'linhas'})</b></td>
                      <td className="num"><b>{brl(vm.totais.valorOperacao)}</b></td>
                      <td className="num"><b>{brl(vm.totais.baseNf)}</b></td>
                      <td />
                      <td className="num"><b>{brl(vm.totais.icmsDestacado)}</b></td>
                      <td className="num"><b>{brl(vm.totais.baseAntecipacao)}</b></td>
                      <td className="num"><b>{brl(vm.totais.icmsInterno)}</b></td>
                      <td className="num"><b>{brl(vm.totais.antecipacao)}</b></td>
                      <td className="fraco" title="Sem Dispensado e Não se aplica">a recolher {brl(vm.totais.aRecolher)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <section className="card">
                <div className="dp-lista-topo"><h3 className="dp-titulo">Totais por mês</h3><span className="hint">pela data da nota</span></div>
                <div className="table-wrap">
                  <table className="table-compact">
                    <thead><tr><th>Mês</th><th className="num">NF-e</th><th className="num">Valor das operações</th><th className="num">ICMS destacado</th><th className="num">Antecipação</th><th className="num">A recolher</th></tr></thead>
                    <tbody>
                      {vm.porMes.map(m => (
                        <tr key={m.mes}>
                          <td>{m.rotulo}</td><td className="num">{m.notas}</td><td className="num">{brl(m.valorOperacao)}</td><td className="num">{brl(m.icmsDestacado)}</td>
                          <td className="num">{brl(m.antecipacao)}</td><td className="num"><b>{brl(m.aRecolher)}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
