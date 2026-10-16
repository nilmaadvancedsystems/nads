// A etapa Clientes da Tarefa (Vitor, 06/10/2026), com as peças do catálogo: as etapas no Segmentado com o Próximo à
// direita; os arquivos na linha da Importação (o ícone de importar; importado, o check que vira × e tira); o credor na
// grade dos Arquivos (com ele, o "Corrigi, irei reimportar" no lugar do Próximo); os clientes em tabela; o selo de cada cliente (o saldo, Conferido ou Ok) é do sistema: Conferido é o razão com nota em
// aberto ou pagamento solto (Vitor, 07/10/2026), e o conferido abre a observação; o envio, só o Mandar pelo Mandei. Só o balancete dinâmico (Vitor, 06/10/2026).
import { CampoArquivo, fundoSuaveDoBanco, Icone, LogoBanco, MenuSuspenso, Segmentado } from '@nads/ui';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { BotaoDeTeste, type ItemDeTeste } from '../../../../../../comum/BotaoDeTeste';
import { useClientes, type FiltroClientes, type TelaClientes } from './useClientes';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../../comum/GradeDosMeses';
import { DigitarLancamento } from './DigitarLancamento';
import { ConsultaDeNotas, useAbasDaConsulta } from '../consulta/ConsultaDeNotas';

type VM = ReturnType<typeof useClientes>;

/** O texto da cápsula da nota: as sugestões no banco; sem elas, as aceitas ou as recusadas. Sem nada, vazio. */
function capsulaDoBanco(i: { sugestoes: readonly unknown[]; baixas: readonly unknown[]; recusadas: readonly unknown[] }): string {
  const n = (k: number, um: string, varios: string) => k + ' ' + (k === 1 ? um : varios);
  return i.sugestoes.length ? n(i.sugestoes.length, 'no banco', 'no banco') : i.baixas.length ? n(i.baixas.length, 'aceita', 'aceitas') : i.recusadas.length ? n(i.recusadas.length, 'recusada', 'recusadas') : '';
}

/** A cor leve de uma nota sim, outra não, na relação do razão (com a sugestão dela junto). */
const LISTRA = { background: 'var(--surface-2)' };

export function Clientes() {
  const vm = useClientes();
  // a aba Consulta no menu de cima (Vitor, 14/10/2026: "igual à Consulta normal")
  const consulta = useAbasDaConsulta('Clientes');
  if (consulta) return <ConsultaDeNotas tipos={['saidas', 'prestados']} />;
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Clientes</h2></div></header>
      <div className="tarefas-barra-topo">
        <Segmentado<TelaClientes> valor={vm.tela} onMudar={vm.irPara} opcoes={vm.telas} />
        <span className="tarefas-barra-espaco" />
        {/* com cliente credor, o "Corrigi, irei reimportar" no lugar do Próximo travado: tira o dinâmico para importar o
            corrigido; deu tudo ok, volta o Próximo (Vitor, 07/10/2026) */}
        {vm.corrigir ? <button type="button" className="btn btn-primary" onClick={vm.tirar}>Corrigi, irei reimportar</button>
          : vm.temProxima ? <button type="button" className="btn btn-primary" disabled={!vm.podeSeguir} onClick={vm.proximo}>Próximo</button>
          // nada para questionar: sem o Envio, segue para a próxima etapa pela seta lá de cima (Vitor, 15/10/2026)
          : vm.semQuestionamento && <span className="hint">{vm.dicaDoFim}</span>}
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
      {vm.tela === 'clientes' && <ListaDeClientes vm={vm} />}
      {vm.tela === 'envio' && <Envio vm={vm} />}
    </section>
  );
}

function Arquivos({ vm }: { vm: VM }) {
  // a primeira coluna (os clientes) encolhe um pouco quando há mais meses, para os 12 caberem (Vitor, 07/10/2026)
  const grade = useColunaAjustavel('clientes-credores', Math.max(18, 30 - vm.mesesDosCredores.length) + '%', vm.mesesDosCredores.length);
  return (
    <div className="imp-lista">
      <LinhaDoArquivo titulo="Balancete dinâmico" feito={vm.dinamico} onArquivo={vm.importar} onTirar={vm.tirar} teste={vm.teste}>
        {/* importado: os credores em algum mês, na grade dos meses do Caixa (Vitor, 07/10/2026); o mês credor em vermelho */}
        {vm.dinamico && vm.credoresNoPeriodo.length > 0 && (
          <div className="imp-periodo-linha">
            <table className="imp-meses" style={grade.tabela}>
              <colgroup><col style={{ width: grade.largura }} /></colgroup>
              <thead>
                <tr>
                  <th scope="col">Credores em algum mês ({vm.credoresNoPeriodo.length}){grade.alca}</th>
                  {vm.mesesDosCredores.map(m => <th key={m} scope="col">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {vm.credoresNoPeriodo.map(c => (
                  <tr key={c.codigo}>
                    <th scope="row" style={{ textAlign: 'left' }} title={c.codigo + ' — ' + c.nome}><b>{c.codigo}</b> — {c.nome}</th>
                    {c.saldos.map(x => <td key={x.mes} className={'num ' + x.cor} title={x.credor ? 'Credor neste mês' : undefined}>{x.valor === '—' ? x.valor : <ValorNaGrade texto={x.valor} />}</td>)}
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
                <CampoArquivo semCaixa semFoco ref={arquivo} aceitar=".xls,.xlsx,.csv" onEscolher={f => onArquivo(f ?? undefined)} />
              </>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

const ROTULO_FILTRO: Record<FiltroClientes, string> = { todos: 'Todos', pendente: 'Pendentes', ok: 'Ok', conferido: 'Conferidos' };

function ListaDeClientes({ vm }: { vm: VM }) {
  // um campo de arquivo só para a lista: guarda de qual conta é o razão
  const arquivo = useRef<HTMLInputElement>(null);
  const conta = useRef('');
  // a mini tabela do razão de cada cliente: começa fechada (Vitor, 08/10/2026: "abra recuado"); a seta do lado da conta abre
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set());
  // o formulário do lançamento digitado, aberto embaixo de qual conta (Vitor, 08/10/2026)
  const [digitando, setDigitando] = useState<string | null>(null);
  // alguma linha com a relação do razão: todas guardam o lugar da seta
  const comSeta = vm.linhas.some(l => !!l.razao && l.razao.itens.length > 0);
  const alternar = (codigo: string) => setAbertas(f => { const n = new Set(f); if (n.has(codigo)) n.delete(codigo); else n.add(codigo); return n; });
  // as sugestões de baixa de cada nota, fechadas até clicar na cápsula (Vitor, 15/10/2026: "tá muito embolado")
  const [noBanco, setNoBanco] = useState<ReadonlySet<string>>(new Set());
  const alternarNoBanco = (k: string) => setNoBanco(f => { const n = new Set(f); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <>
      <CampoArquivo semCaixa semFoco ref={arquivo} aceitar=".xls,.xlsx,.ods" onEscolher={f => vm.importarRazao(conta.current, f ?? undefined)} />
      <div className="tarefas-barra-topo">
        <MenuSuspenso rotulo={ROTULO_FILTRO[vm.filtro]} className="btn btn-outline" dica="Filtrar os clientes"
          itens={(Object.keys(ROTULO_FILTRO) as FiltroClientes[]).map(f => ({
            rotulo: ROTULO_FILTRO[f] + ' (' + vm.contagem[f] + ')', marcado: vm.filtro === f, desabilitado: f !== 'todos' && !vm.contagem[f], onClick: () => vm.setFiltro(f),
          }))} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Conta</th><th>Cliente</th><th>Situação</th><th className="num">Razão</th></tr></thead>
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
                  {/* o razão de outro participante (pelo nome nos históricos, não pelo saldo; Vitor, 15/10/2026) */}
                  {l.razao?.deOutro && <span className="hint ext-neg" style={{ display: 'block', marginTop: 2 }}>O razão é de {l.razao.deOutro}: confira se é desta conta</span>}
                  {/* o conferido mostra o que vai para o cliente (o que foi adicionado no "+" de cada linha da relação, em texto: "Questionar: NF 9971 · NF 10111"; Vitor, 07/10/2026) */}
                  {/* sem a dica do + (Vitor, 15/10/2026: "remove isso") */}
                  {l.situacao === 'conferido' && l.perguntar && (
                    <span style={{ display: 'block', marginTop: 4 }}><span className="badge badge-neutral" title="O que vai para o cliente responder">Questionar: {l.perguntar}</span></span>
                  )}
                </td>
                <td>
                  {/* os selos do catálogo: o saldo (Diferença, SE-03), Conferido (SE-02) e Ok (SE-01), todos do sistema: o Ok é a conta
                      zerada; o Conferido, o razão com nota em aberto ou pagamento solto (Vitor, 07/10/2026: sem o conferido manual) */}
                  {l.situacao === 'ok' ? <span className="badge badge-ok" title={l.razao?.zerado ? 'Zerado no razão importado' : 'Saldo zerado'}>Ok</span> : (
                    <span className={'badge ' + (l.situacao === 'pendente' ? 'badge-bad' : 'badge-conferido')}
                      title={l.situacao === 'pendente' ? 'Saldo em aberto: importe o razão da conta (com nota em aberto ou pagamento solto, vira Conferido)' : 'Conferido pelo razão: vai para o cliente responder'}>
                      {l.situacao === 'pendente' ? l.valor : 'Conferido'}
                    </span>
                  )}
                </td>
                {/* o razão da conta, no fim da linha (Vitor, 06/10/2026): importar; importado, o check que vira × e tira; o Ok do dinâmico não tem (o Ok do razão zerado mostra o check, para tirar) */}
                <td className="num">
                  <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                  {/* digitar o lançamento à mão, sem upar o razão (Vitor, 08/10/2026) */}
                  {/* com o razão importado do arquivo, não tem o que digitar (Vitor, 15/10/2026) */}
                  {!(l.situacao === 'ok' && !l.razao) && !(l.razao && l.razao.arquivo !== 'Digitado à mão') && (
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
                            <Fragment key={k}><tr style={k % 2 ? LISTRA : undefined}><td style={{ whiteSpace: 'nowrap' }}>{i.data}</td><td>{i.nf}</td><td className="wrap">{i.descricao}{i.digitado && <span className="hint"> · digitado</span>}</td><td className={'num' + (i.abate ? ' ext-neg' : '')} title={i.aceito ? 'Aceito no banco: ' + i.aceito : undefined}>{i.valor}</td>
                              <td className={i.status === 'aberto' ? undefined : 'hint'}>{i.quitada ? <span className="badge badge-ok" title={'Aceito no banco: ' + i.aceito}>Ok</span> : i.rotulo}
                                {capsulaDoBanco(i) && (
                                  <button type="button" className="badge badge-neutral" aria-expanded={noBanco.has(l.codigo + '|' + i.chave)} onClick={() => alternarNoBanco(l.codigo + '|' + i.chave)}
                                    title={noBanco.has(l.codigo + '|' + i.chave) ? 'Esconder o que achei no banco' : 'Ver o que achei no banco'}
                                    style={{ marginLeft: 8, cursor: 'pointer', background: 'transparent', font: 'inherit', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                    {capsulaDoBanco(i)}<Icone nome="caretDown" />
                                  </button>
                                )}
                                {!i.quitada && i.aceito && <span className="hint" style={{ display: 'block' }}>aceito {i.aceito}</span>}</td>
                              {/* o "+" de cada linha (Vitor, 07/10/2026: "colocando esse + em cada linha"): adiciona ao que vai para o cliente;
                                  adicionada, o check que vira × e tira (o mesmo botão da importação) */}
                              {(l.situacao === 'conferido' || !!l.razao?.itens.some(x => x.digitado)) && <td className="num">{!i.chave || i.quitada ? <span className="hint" title={i.quitada ? 'Com a baixa no banco' : 'Só do escritório'}>—</span> : i.digitado ? (
                                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={!vm.carregado} onClick={() => vm.tirarDigitado(l.codigo, i.chave)}
                                  title="Lançamento digitado: vai para o cliente. Clique para tirar." aria-label="Tirar o lançamento digitado">
                                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                                </button>
                              ) : i.marcado ? (
                                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={!vm.carregado} onClick={() => vm.definirEnvio(l.codigo, i.chave, false)}
                                  title="Vai para o cliente. Clique para tirar." aria-label={'Tirar ' + (i.nf !== '—' ? 'a NF ' + i.nf : 'o pagamento') + ' do que vai para o cliente'}>
                                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                                </button>
                              ) : (
                                <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={!vm.carregado} onClick={() => vm.definirEnvio(l.codigo, i.chave, true)}
                                  title="Perguntar ao cliente sobre esta linha" aria-label={'Perguntar ao cliente sobre ' + (i.nf !== '—' ? 'a NF ' + i.nf : 'o pagamento')}>
                                  <Icone nome="plus" />
                                </button>
                              )}</td>}</tr>
                            {/* a sugestão de baixa logo abaixo da nota em aberto (Vitor, 15/10/2026): sem título e sem o fio do lado, uma
                                mini tabela com Banco (só o logo), Data, Descrição (letra menor), Valor e Situação (os selos) */}
                            {/* o botão de aceitar (Vitor, 15/10/2026: "quando o usuário mudar ou aceitar a sugestão, fique Ok"): aceita, a nota
                                fica Ok e só o lançamento escolhido fica, com o check que vira × para desfazer */}
                            {noBanco.has(l.codigo + '|' + i.chave) && (i.baixas.length > 0 || i.sugestoes.length > 0 || i.recusadas.length > 0) && (
                              <tr style={k % 2 ? LISTRA : undefined}>
                                <td colSpan={6} style={{ padding: 0 }}>
                                  {/* sem caixa, sem borda e sem o cabeçalho; mais de uma, separadas pela linha suave da tabela (Vitor, 15/10/2026) */}
                                  <div>
                                    <table className="table-compact" aria-label="Possível recebimento desta nota no banco">
                                      <tbody>
                                        {[...i.baixas.map(b => ({ ...b, selos: [], aceita: true, recusada: false })), ...i.sugestoes.map(g => ({ ...g, aceita: false, recusada: false })),
                                          ...i.recusadas.map(r => ({ ...r, selos: [], aceita: false, recusada: true }))].map((g, j) => (
                                          <tr key={j} style={g.recusada ? { opacity: 0.55 } : fundoSuaveDoBanco(g.marca) ? { background: fundoSuaveDoBanco(g.marca) } : undefined}>
                                            {/* o Aceitar e o Recusar à esquerda do logo do banco (Vitor, 15/10/2026) */}
                                            <td style={{ width: 84, whiteSpace: 'nowrap' }}>
                                              {g.recusada ? (
                                                <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={!vm.carregado} onClick={() => vm.desfazerRecusa(l.codigo, i.chave, g.bruto)}
                                                  title="Recusada. Clique para desfazer." aria-label={'Desfazer a recusa do lançamento de ' + g.data}>
                                                  <Icone nome="girar" />
                                                </button>
                                              ) : g.aceita ? (
                                                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={!vm.carregado} onClick={() => vm.aceitarBaixa(l.codigo, i.chave, g.bruto, false)}
                                                  title="Baixa aceita. Clique para desfazer." aria-label={'Desfazer a baixa ' + (i.nf !== '—' ? 'da NF ' + i.nf : 'da nota')}>
                                                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                                                </button>
                                              ) : (
                                                <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={!vm.carregado} onClick={() => vm.aceitarBaixa(l.codigo, i.chave, g.bruto, true)}
                                                  title="Aceitar: é a baixa desta nota" aria-label={'Aceitar o lançamento de ' + g.data + ' como a baixa ' + (i.nf !== '—' ? 'da NF ' + i.nf : 'da nota')}>
                                                  <Icone nome="check" />
                                                </button>
                                              )}
                                              {!g.aceita && !g.recusada && (
                                                <button type="button" className="icon-btn icon-btn-sm imp-btn" style={{ marginLeft: 6 }} disabled={!vm.carregado} onClick={() => vm.recusarSugestao(l.codigo, i.chave, g.bruto)}
                                                  title="Recusar: não é a baixa desta nota" aria-label={'Recusar o lançamento de ' + g.data + ' para ' + (i.nf !== '—' ? 'a NF ' + i.nf : 'a nota')}>
                                                  <Icone nome="x" />
                                                </button>
                                              )}
                                            </td>
                                            {/* o banco: só o logo (o nome na dica), para sobrar espaço (Vitor, 15/10/2026) */}
                                            <td title={g.banco} style={{ width: 56 }}><span className="drive-candidato-logo" style={{ display: 'inline-flex' }} aria-label={g.banco}><LogoBanco banco={g.marca} cor /></span></td>
                                            <td style={{ whiteSpace: 'nowrap', width: 96 }}>{g.data}</td>
                                            <td title={g.historico} style={{ fontSize: 12, maxWidth: 0, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.curto}</td>
                                            <td className="num" style={{ whiteSpace: 'nowrap' }}>{g.valor}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                              <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'nowrap' }}>
                                                {g.aceita ? <span className="badge badge-ok">Aceita</span> : g.recusada ? <span className="badge badge-neutral">Recusada</span> : g.selos.map(x => <span key={x.texto} className={'badge badge-' + x.tom} title={x.dica}>{x.texto}</span>)}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {!vm.linhas.length && <tr><td colSpan={4} className="hint">Nenhum cliente neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Envio({ vm }: { vm: VM }) {
  if (!vm.conferidos.length) return <p className="hint">Nenhum cliente conferido: em Clientes, importe o razão da conta; com nota em aberto ou pagamento solto, ele vira Conferido.</p>;
  return (
    <>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Conta</th><th>Cliente</th><th className="num">Saldo</th><th>Notas em aberto</th><th>No Mandei</th></tr></thead>
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
