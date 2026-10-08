// A etapa Fornecedores da Tarefa (Vitor, 07/10/2026): a mesma tela do Clientes, peça por peça, com o fornecedor devedor no
// lugar do cliente credor (com ele, o "Corrigi, irei reimportar" no lugar do Próximo, até reimportar o dinâmico corrigido).
import { Icone, MenuSuspenso, Segmentado } from '@nads/ui';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { BotaoDeTeste, type ItemDeTeste } from '../../../../../../comum/BotaoDeTeste';
import { useFornecedores, type FiltroFornecedores, type TelaFornecedores } from './useFornecedores';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../../comum/GradeDosMeses';
import { DigitarLancamento } from '../clientes/DigitarLancamento';

type VM = ReturnType<typeof useFornecedores>;

export function Fornecedores() {
  const vm = useFornecedores();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Fornecedores</h2></div></header>
      <div className="tarefas-barra-topo">
        <Segmentado<TelaFornecedores> valor={vm.tela} onMudar={vm.irPara} opcoes={vm.telas} />
        <span className="tarefas-barra-espaco" />
        {/* com fornecedor devedor, o "Corrigi, irei reimportar" no lugar do Próximo travado: tira o dinâmico para importar o
            corrigido; deu tudo ok, volta o Próximo (Vitor, 07/10/2026) */}
        {vm.corrigir ? <button type="button" className="btn btn-primary" onClick={vm.tirar}>Corrigi, irei reimportar</button>
          : vm.temProxima && <button type="button" className="btn btn-primary" disabled={!vm.podeSeguir} onClick={vm.proximo}>Próximo</button>}
        {/* no Envio, só o Mandar pelo Mandei (Vitor, 07/10/2026: "remove isso tudo, deixa só o botão"): vai para o e-mail e o
            WhatsApp da empresa, os do Cadastro */}
        {vm.tela === 'envio' && vm.conferidos.length > 0 && (
          <button type="button" className="btn btn-primary" disabled={vm.faltaNoCadastro.length > 0 || vm.jaMandado} onClick={vm.mandarPeloMandei}
            title={vm.faltaNoCadastro.length ? 'Falta no Cadastro da empresa: ' + vm.faltaNoCadastro.join(' e ') : 'Mandar para ' + [vm.contato.email, vm.contato.whatsapp && 'o WhatsApp ' + vm.contato.whatsapp].filter(Boolean).join(' e ')}>
            <Icone nome={vm.jaMandado ? 'check' : 'caixaEntrada'} />{vm.jaMandado ? 'Mandado pelo Mandei' : 'Mandar pelo Mandei'}
          </button>
        )}
      </div>
      {vm.tela === 'arquivos' && <Arquivos vm={vm} />}
      {vm.tela === 'fornecedores' && <ListaDeFornecedores vm={vm} />}
      {vm.tela === 'envio' && <Envio vm={vm} />}
    </section>
  );
}

function Arquivos({ vm }: { vm: VM }) {
  // a primeira coluna (os fornecedores) encolhe um pouco quando há mais meses, para os 12 caberem (Vitor, 07/10/2026)
  const grade = useColunaAjustavel('fornecedores-devedores', Math.max(18, 30 - vm.mesesDosCredores.length) + '%', vm.mesesDosCredores.length);
  return (
    <div className="imp-lista">
      <LinhaDoArquivo titulo="Balancete dinâmico" feito={vm.dinamico} onArquivo={vm.importar} onTirar={vm.tirar} teste={vm.teste}>
        {/* importado: os devedores em algum mês, na grade dos meses do Caixa; o mês devedor em azul (Vitor, 07/10/2026) (o saldo do lado do fornecedor: negativo = devedor) */}
        {vm.dinamico && vm.credoresNoPeriodo.length > 0 && (
          <div className="imp-periodo-linha">
            <table className="imp-meses" style={grade.tabela}>
              <colgroup><col style={{ width: grade.largura }} /></colgroup>
              <thead>
                <tr>
                  <th scope="col">Devedores em algum mês ({vm.credoresNoPeriodo.length}){grade.alca}</th>
                  {vm.mesesDosCredores.map(m => <th key={m} scope="col">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {vm.credoresNoPeriodo.map(c => (
                  <tr key={c.codigo}>
                    <th scope="row" style={{ textAlign: 'left' }} title={c.codigo + ' — ' + c.nome}><b>{c.codigo}</b> — {c.nome}</th>
                    {c.saldos.map(x => <td key={x.mes} className={'num ' + x.cor} title={x.credor ? 'Devedor neste mês' : undefined}>{x.valor === '—' ? x.valor : <ValorNaGrade texto={x.valor} />}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LinhaDoArquivo>
    </div>
  );
}

function LinhaDoArquivo({ titulo, dica = '', feito, onArquivo, onTirar, teste, children }: {
  titulo: string; dica?: string; feito: { nome: string; resumo: string } | null; onArquivo: (f: File | undefined) => void; onTirar: () => void; teste: ItemDeTeste[];
  children?: ReactNode;
}) {
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <div className={'imp-bloco' + (feito ? ' imp-ok' : '')}>
      <div className="imp-linha">
        <span className="imp-ico imp-logo"><Icone nome="fileText" /></span>
        <div className="imp-txt"><span><b>{titulo}</b>{(feito || dica) && <span className="imp-conta">{feito ? feito.nome : dica}</span>}</span></div>
        <div className="imp-resumo">{feito && <div><span>{feito.resumo}</span></div>}</div>
        <div className="imp-grupos">
          <div className="imp-grupo">
            {feito ? (
              <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={onTirar} title={'Importado: ' + feito.nome + '. Clique para tirar.'} aria-label={'Tirar o ' + titulo.toLowerCase()}>
                <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
              </button>
            ) : (
              <>
                <BotaoDeTeste itens={teste} />
                <button type="button" className="icon-btn icon-btn-sm imp-btn" title={'Importar o ' + titulo.toLowerCase()} aria-label={'Importar o ' + titulo.toLowerCase()} onClick={() => arquivo.current?.click()}>
                  <Icone nome="upload" />
                </button>
                <input ref={arquivo} type="file" accept=".xls,.xlsx,.csv" className="sr-only" tabIndex={-1} aria-hidden="true"
                  onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; onArquivo(f); }} />
              </>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

const ROTULO_FILTRO: Record<FiltroFornecedores, string> = { todos: 'Todos', pendente: 'Pendentes', ok: 'Ok', conferido: 'Conferidos' };

function ListaDeFornecedores({ vm }: { vm: VM }) {
  // um campo de arquivo só para a lista: guarda de qual conta é o razão
  const arquivo = useRef<HTMLInputElement>(null);
  const conta = useRef('');
  // a mini tabela do razão de cada fornecedor: começa fechada (Vitor, 08/10/2026: "abra recuado"); a seta do lado da conta abre
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set());
  // o formulário do lançamento digitado, aberto embaixo de qual conta (Vitor, 08/10/2026)
  const [digitando, setDigitando] = useState<string | null>(null);
  // alguma linha com a relação do razão: todas guardam o lugar da seta
  const comSeta = vm.linhas.some(l => !!l.razao && l.razao.itens.length > 0);
  const alternar = (codigo: string) => setAbertas(f => { const n = new Set(f); if (n.has(codigo)) n.delete(codigo); else n.add(codigo); return n; });
  return (
    <>
      <input ref={arquivo} type="file" accept=".xls,.xlsx,.ods" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; vm.importarRazao(conta.current, f); }} />
      <div className="tarefas-barra-topo">
        <MenuSuspenso rotulo={ROTULO_FILTRO[vm.filtro]} className="btn btn-outline" dica="Filtrar os fornecedores"
          itens={(Object.keys(ROTULO_FILTRO) as FiltroFornecedores[]).map(f => ({
            rotulo: ROTULO_FILTRO[f] + ' (' + vm.contagem[f] + ')', marcado: vm.filtro === f, desabilitado: f !== 'todos' && !vm.contagem[f], onClick: () => vm.setFiltro(f),
          }))} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar fornecedor" aria-label="Buscar fornecedor" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Conta</th><th>Fornecedor</th><th>Situação</th><th className="num">Razão</th></tr></thead>
          <tbody>
            {vm.linhas.map(l => (
              <Fragment key={l.codigo}>
              <tr>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {/* a seta do razão (Vitor, 07/10/2026): mostra ou esconde a relação embaixo; a seta e o número na mesma
                      linha, e o lugar da seta guardado em todas as linhas para os números ficarem alinhados */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {comSeta && (l.razao && l.razao.itens.length > 0 ? (
                      <button type="button" className={'imp-seta' + (abertas.has(l.codigo) ? ' aberta' : '')} aria-expanded={abertas.has(l.codigo)} style={{ margin: 0 }}
                        title={abertas.has(l.codigo) ? 'Esconder a relação do razão' : 'Ver a relação do razão'} aria-label={'A relação do razão de ' + l.nome} onClick={() => alternar(l.codigo)}>
                        <Icone nome="caretDown" />
                      </button>
                    ) : <span style={{ width: 26, flex: 'none' }} />)}
                    {l.codigo}
                  </span>
                </td>
                <td className="wrap">
                  {l.nome}{l.doMesAnterior && <> <span className="badge badge-neutral" title="Conferido no mês anterior: revise">do mês anterior</span></>}
                  {/* o razão que não bate com o balancete (as notas ficam na relação embaixo; Vitor, 07/10/2026) */}
                  {l.razao?.naoBate && <span className="hint ext-neg" style={{ display: 'block', marginTop: 2 }}>O razão fecha em {l.razao.naoBate}: confira se é desta conta</span>}
                  {/* o conferido mostra o que vai para o fornecedor (o que foi adicionado no "+" de cada linha da relação; Vitor, 07/10/2026) */}
                  {l.situacao === 'conferido' && (l.perguntar
                    ? <span style={{ display: 'block', marginTop: 4 }}><span className="hint">Questionar: </span>{l.perguntar}</span>
                    : <span className="hint" style={{ display: 'block', marginTop: 4 }}>Use o + nas linhas para perguntar ao fornecedor.</span>)}
                </td>
                <td>
                  {/* os selos do catálogo: o saldo (Diferença, SE-03), Conferido (SE-02) e Ok (SE-01), todos do sistema: o Ok é a conta
                      zerada; o Conferido, o razão com nota em aberto ou pagamento solto (Vitor, 07/10/2026: sem o conferido manual) */}
                  {l.situacao === 'ok' ? <span className="badge badge-ok" title={l.razao?.zerado ? 'Zerado no razão importado' : 'Saldo zerado'}>Ok</span> : (
                    <span className={'badge ' + (l.situacao === 'pendente' ? 'badge-bad' : 'badge-conferido')}
                      title={l.situacao === 'pendente' ? 'Saldo em aberto: importe o razão da conta (com nota em aberto ou pagamento solto, vira Conferido)' : 'Conferido pelo razão: vai para o fornecedor responder'}>
                      {l.situacao === 'pendente' ? l.valor : 'Conferido'}
                    </span>
                  )}
                </td>
                {/* o razão da conta, no fim da linha (Vitor, 06/10/2026): importar; importado, o check que vira × e tira; o Ok do dinâmico não tem (o Ok do razão zerado mostra o check, para tirar) */}
                <td className="num">
                  <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                  {/* digitar o lançamento à mão, sem upar o razão (Vitor, 08/10/2026) */}
                  {!(l.situacao === 'ok' && !l.razao) && (
                    <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={!vm.carregado} aria-expanded={digitando === l.codigo}
                      onClick={() => setDigitando(x => (x === l.codigo ? null : l.codigo))}
                      title="Digitar um lançamento (sem upar o razão)" aria-label={'Digitar um lançamento de ' + l.nome}>
                      <Icone nome="lapis" />
                    </button>
                  )}
                  {l.situacao === 'ok' && !l.razao ? null : l.razao ? (
                    <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={!vm.carregado} onClick={() => vm.tirarRazao(l.codigo)}
                      title={'Razão importado: ' + l.razao.arquivo + '. Clique para tirar.'} aria-label={'Tirar o razão de ' + l.nome}>
                      <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                    </button>
                  ) : (
                    <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={!vm.carregado}
                      onClick={() => { conta.current = l.codigo; arquivo.current?.click(); }}
                      title={'Importar o razão da conta ' + l.codigo + ' (as notas em aberto vão para a relação do cliente)'} aria-label={'Importar o razão de ' + l.nome}>
                      <Icone nome="upload" />
                    </button>
                  )}
                  </span>
                </td>
              </tr>
              {digitando === l.codigo && (
                <tr>
                  <td colSpan={4}>
                    <DigitarLancamento nome={l.nome} onFechar={() => setDigitando(null)}
                      onAdicionar={x => { vm.digitarLancamento(l.codigo, x); setAbertas(a => new Set(a).add(l.codigo)); }} />
                  </td>
                </tr>
              )}
              {l.razao && l.razao.itens.length > 0 && abertas.has(l.codigo) && (
                <tr>
                  <td colSpan={4}>
                    {/* a relação isolada: o cabeçalho fixo dela não passa por cima do menu "Perguntar" da linha de cima */}
                    <div className="table-wrap" style={{ isolation: 'isolate' }}>
                      <table className="table-compact">
                        <thead><tr><th>Data</th><th>Nota fiscal</th><th>Descrição</th><th className="num">Valor</th><th>Status</th>{(l.situacao === 'conferido' || !!l.razao?.itens.some(x => x.digitado)) && <th className="num">Perguntar</th>}</tr></thead>
                        <tbody>
                          {l.razao.itens.map((i, k) => (
                            <tr key={k}><td style={{ whiteSpace: 'nowrap' }}>{i.data}</td><td>{i.nf}</td><td className="wrap">{i.descricao}{i.digitado && <span className="hint"> · digitado</span>}</td><td className={'num' + (i.abate ? ' ext-neg' : '')}>{i.valor}</td>
                              <td className={i.status === 'aberto' ? undefined : 'hint'}>{i.rotulo}</td>
                              {/* o "+" de cada linha (Vitor, 07/10/2026: "colocando esse + em cada linha"): adiciona ao que vai para o fornecedor;
                                  adicionada, o check que vira × e tira (o mesmo botão da importação) */}
                              {(l.situacao === 'conferido' || !!l.razao?.itens.some(x => x.digitado)) && <td className="num">{!i.chave ? <span className="hint" title="Só do escritório">—</span> : i.digitado ? (
                                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={!vm.carregado} onClick={() => vm.tirarDigitado(l.codigo, i.chave)}
                                  title="Lançamento digitado: vai para o fornecedor. Clique para tirar." aria-label="Tirar o lançamento digitado">
                                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                                </button>
                              ) : i.marcado ? (
                                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={!vm.carregado} onClick={() => vm.definirEnvio(l.codigo, i.chave, false)}
                                  title="Vai para o fornecedor. Clique para tirar." aria-label={'Tirar ' + (i.nf !== '—' ? 'a NF ' + i.nf : 'o pagamento') + ' do que vai para o fornecedor'}>
                                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                                </button>
                              ) : (
                                <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={!vm.carregado} onClick={() => vm.definirEnvio(l.codigo, i.chave, true)}
                                  title="Perguntar ao fornecedor sobre esta linha" aria-label={'Perguntar ao fornecedor sobre ' + (i.nf !== '—' ? 'a NF ' + i.nf : 'o pagamento')}>
                                  <Icone nome="plus" />
                                </button>
                              )}</td>}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {!vm.linhas.length && <tr><td colSpan={4} className="hint">Nenhum fornecedor neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Envio({ vm }: { vm: VM }) {
  if (!vm.conferidos.length) return <p className="hint">Nenhum fornecedor conferido: em Fornecedores, importe o razão da conta; com nota em aberto ou pagamento solto, ele vira Conferido.</p>;
  return (
    <>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Conta</th><th>Fornecedor</th><th className="num">Saldo</th><th>Notas em aberto</th><th>No Mandei</th></tr></thead>
          <tbody>
            {vm.conferidos.map(l => (
              <tr key={l.codigo}><td>{l.codigo}</td><td className="wrap">{l.nome}</td><td className="num">{l.valor}</td><td className="wrap">{l.notas || '—'}</td><td className="wrap">{l.perguntar || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* sem o e-mail ou o WhatsApp no Cadastro, o Mandar fica travado */}
      {vm.faltaNoCadastro.length > 0
        ? <p className="hint" style={{ marginTop: 12 }}>Para mandar pelo Mandei, cadastre {vm.faltaNoCadastro.join(' e ')} da empresa em Cadastro › Empresa.</p>
        : <p className="hint" style={{ marginTop: 12 }}>O Mandei manda para {[vm.contato.email, vm.contato.whatsapp && 'o WhatsApp ' + vm.contato.whatsapp].filter(Boolean).join(' e ')}.</p>}
    </>
  );
}
