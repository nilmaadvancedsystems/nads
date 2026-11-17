// As telas do Administrativo da Área do Cliente (12/11/2026): os Dados cadastrais e o Fale com o escritório (antes,
// janelas; "quero uma tela melhor disso aqui") e o Faturamento ("quero o faturamento do cliente aqui via fiscal"). Só
// desenham: os dados vêm de useAdministrativo.ts.
import { Icone, LogoBanco, LogoExcel, LogoGmail, MenuSuspenso, SeletorMes, useRetorno } from '@nads/ui';
import { WhatsAppContorno } from '../partes/WhatsAppContorno';
import { useRef, type ReactNode } from 'react';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { Avatar } from '../partes/Avatar';
import { Vazio } from '../partes/Vazio';
import type { DaCasca } from './useAreaCliente';
import { useContato, useEmpresa, useFaturamento, type ColunaDoGrafico, type VistaDoRelatorio } from './useAdministrativo';
import { useVisualizar } from './useVisualizar';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { AjudaDaTela } from '../partes/AjudaDaTela';
import { MarcaDaTela } from '../partes/MarcaDaTela';
import './faturamento.css';

/**
 * O relatório do dia, no estilo da lista do portal do SIEG: os totais no alto e uma linha por nota. Enxuto em 16/11/2026
 * ("muita informação"): cada nota só com o número, o destinatário, o valor e a DANFE; a série, o CFOP e a situação
 * "Autorizada" saíram (a cancelada continua marcada) e a chave de acesso foi para o menu "⋯".
 */
function RelatorioDoDia({ r, onCopiar, pegarDanfe }: { r: VistaDoRelatorio; onCopiar: (chave: string) => void; pegarDanfe: (chave: string) => Promise<{ nome: string; arquivo: Blob } | { erro: string }> }) {
  // a DANFE abre na janela de visualização (a mesma da guia), por cima do relatório
  const vista = useVisualizar();
  const verDanfe = (chave: string) => { if (!vista.abrindo) vista.ver(chave, () => pegarDanfe(chave)); };
  return (
    <div className="cli-app cli-janela cli-relatorio-dia">
      <div className="cli-relatorio-resumo">
        {r.resumo.map(x => <div key={x.rotulo}><span className="cli-sobre">{x.rotulo}</span><b>{x.valor}</b></div>)}
      </div>
      {r.aviso && <p className="hint">{r.aviso}</p>}
      {r.vazio ? <p className="hint cli-ficha-dica">Nenhuma nota emitida neste dia.</p> : (
        <div className="cli-relatorio-rolo">
          <table className="cli-tabela cli-tabela-sieg cli-fat-notas">
            <thead><tr><th>Número</th><th>Destinatário</th><th className="num">Valor</th><th aria-label="Ações" /></tr></thead>
            <tbody>
              {r.notas.map(n => (
                <tr key={n.chave} className={(n.cancelada ? 'cancelada' : '') + (n.temDanfe ? ' cli-linha-clica' : '')} onClick={n.temDanfe ? () => verDanfe(n.chave) : undefined}>
                  <td className="num-esq"><span className="cli-fat-nota-num"><b>{n.numero}</b><span className={'cli-modelo m-' + n.tipo.replace(/\W/g, '').toLowerCase()}>{n.tipo}</span></span></td>
                  <td className="cli-relatorio-cliente" title={n.cliente}>{n.cliente}{n.cancelada && <span className="badge badge-bad cli-fat-cancelada">Cancelada</span>}</td>
                  <td className="num"><span className="cli-valor">{n.valor}</span></td>
                  <td className="cli-relatorio-danfe">
                    <span className="cli-fat-acoes" onClick={ev => ev.stopPropagation()}>
                      {n.temDanfe ? (
                        <button type="button" className="btn btn-sm" disabled={!!vista.abrindo} aria-label={'Ver a DANFE da nota ' + n.numero} onClick={() => verDanfe(n.chave)}>
                          <Icone nome="olho" width={14} height={14} />{vista.abrindo === n.chave ? 'Abrindo…' : 'DANFE'}
                        </button>
                      ) : <span className="cli-fat-vaga" aria-hidden="true" />}
                      {n.chaveCurta ? (
                        <MenuSuspenso rotulo="" icone="mais" className="icon-btn" semSeta direita flutuante compacto dica="Mais ações" titulo={'Mais ações: nota ' + n.numero}
                          itens={[{ rotulo: 'Copiar a chave de acesso', icone: 'copiar', onClick: () => onCopiar(n.chaveInteira) }]} />
                      ) : <span className="cli-fat-vaga-menu" aria-hidden="true" />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {vista.abrindo && <p className="hint cli-relatorio-espera">Pedindo a DANFE ao escritório… a primeira de cada mês pode levar um minuto.</p>}
      {vista.aberto && <JanelaDoArquivo arquivo={vista.aberto} onBaixar={vista.baixar} onFechar={vista.fechar} />}
    </div>
  );
}

/**
 * O gráfico de colunas do Faturamento (os 12 meses, os dias do mês): colunas finas com a ponta arredondada, cinza; a
 * coluna em foco em carmim com o valor no topo; a grade em linha fina; o eixo numa coluna própria.
 */
export function Colunas({ colunas, eixo, rotulo, onFoco, onClique, compacto }: {
  colunas: ColunaDoGrafico[]; eixo: { valor: string; posicao: number }[]; rotulo: string;
  onFoco?: (i: number | null) => void; onClique?: (chave: string) => void; compacto?: boolean;
}) {
  return (
    <div className={'cli-grafico' + (compacto ? ' compacto' : '')} style={{ ['--cli-n' as string]: colunas.length }} onMouseLeave={() => onFoco?.(null)}>
      <div className="cli-eixo" aria-hidden="true">
        {eixo.map(l => <span key={l.valor} style={{ bottom: l.posicao + '%' }}>{l.valor}</span>)}
      </div>
      <div className="cli-plot">
        {eixo.map(l => <span key={l.valor} className={'cli-grade' + (l.posicao ? '' : ' base')} style={{ bottom: l.posicao + '%' }} aria-hidden="true" />)}
        <div className="cli-colunas" role="group" aria-label={rotulo}>
          {colunas.map((c, i) => (
            <button key={c.chave} type="button" aria-label={c.aria} aria-pressed={c.foco}
              className={'cli-coluna-mes' + (c.foco ? ' escolhida' : '') + (c.destaque ? ' destaque' : '') + (c.apagada ? ' andamento' : '')}
              onClick={() => { onFoco?.(i); onClique?.(c.chave); }} onMouseEnter={() => onFoco?.(i)} onFocus={() => onFoco?.(i)}>
              {c.vazia ? <span className="cli-col-fat vazia" /> : (
                <span className="cli-col-fat" style={{ height: c.altura + '%' }}>
                  {c.foco && <span className="cli-coluna-valor">{c.valor}</span>}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="cli-meses" aria-hidden="true">
        {colunas.map(c => <span key={c.chave} className={c.foco ? 'escolhida' : ''}><span className="cli-so-largo-in">{c.rotulo}</span><span className="cli-so-estreito-in">{c.rotuloCurto}</span></span>)}
      </div>
    </div>
  );
}

/**
 * Os maiores clientes em ranking: o nome, as notas, a barra e o valor (16/11/2026, "muita informação": sem a % ao lado
 * do valor, que a barra já mostra).
 */
function Ranking({ itens, fim }: { itens: { chave: string; nome: string; detalhe?: string; valor: string; largura: number }[]; fim?: { texto: string; valor: string } | null }) {
  return (
    <ol className="cli-ranking cli-fat-ranking">
      {itens.map(x => (
        <li key={x.chave}>
          <span className="cli-ranking-topo">
            <span className="cli-ranking-nome"><b>{x.nome}</b>{x.detalhe && <span className="hint">{x.detalhe}</span>}</span>
            <span className="cli-ranking-num"><b>{x.valor}</b></span>
          </span>
          <span className="cli-ranking-barra" aria-hidden="true"><span style={{ width: x.largura + '%' }} /></span>
        </li>
      ))}
      {fim && (
        <li className="cli-ranking-fim">
          <span className="cli-ranking-topo">
            <span className="cli-ranking-nome"><span className="hint">{fim.texto}</span></span>
            <span className="cli-ranking-num"><b>{fim.valor}</b></span>
          </span>
        </li>
      )}
    </ol>
  );
}

export function Empresa(props: DaCasca) {
  const vm = useEmpresa(props);
  if (!vm.tem) return <Vazio icone="predio" titulo="Os dados da empresa ainda não chegaram" texto="Quando o escritório completar o cadastro, eles aparecem aqui." />;
  // (13/11/2026: "não gostei" dos blocos; escolhida a "lista simples alinhada") uma coluna só: o rótulo à esquerda, o valor
  // à direita, todos na mesma linha de partida, sem caixas; o copiar logo depois do valor (ao passar o mouse; no toque, sempre)
  const linha = (rotulo: string, valor: string, extra?: ReactNode, copiavel = true) => (
    <div className="cli-fl-linha">
      <dt>{rotulo}</dt>
      <dd>
        <span className="cli-fl-valor">{valor}</span>
        {copiavel && <button type="button" className="cli-fi-copiar" title={'Copiar ' + rotulo.toLowerCase()} aria-label={'Copiar ' + rotulo.toLowerCase()} onClick={() => vm.copiar(valor, rotulo)}><Icone nome="copiar" width={14} height={14} /></button>}
        {extra}
      </dd>
    </div>
  );
  return (
    <>
      <div className="cli-titulo">
        <div><MarcaDaTela /><h1 className="page-title">Dados cadastrais</h1><AjudaDaTela /></div>
        <div className="cli-acoes"><button type="button" className="btn" onClick={vm.copiarTudo}><Icone nome="copiar" width={16} height={16} />Copiar todos os dados</button></div>
      </div>
      <section className="card cli-fi cli-fl">
        <header className="cli-fi-topo">
          <span className="cli-fi-marca">{vm.logo ? <img src={vm.logo} alt={'Logo de ' + vm.razaoSocial} /> : vm.iniciais}</span>
          <div className="cli-fi-nome">
            <h2>{vm.razaoSocial}</h2>
            <p>{[vm.nomeFantasia && 'Nome fantasia: ' + vm.nomeFantasia, vm.abertura && 'aberta em ' + vm.abertura + (vm.tempo ? ' (' + vm.tempo + ')' : '')].filter(Boolean).join(' · ')}</p>
          </div>
          {vm.regime && <span className={'cli-fi-regime ' + vm.seloDoRegime}>{vm.regime}</span>}
        </header>

        <dl className="cli-fl-lista">
          {linha('CNPJ', vm.cnpj)}
          {vm.inscricaoEstadual && linha('Inscrição estadual', vm.inscricaoEstadual)}
          {vm.inscricaoMunicipal && linha('Inscrição municipal', vm.inscricaoMunicipal)}
          {(vm.cnaeCodigo || vm.cnaeTexto) && (
            <div className="cli-fl-linha">
              <dt>Atividade principal</dt>
              <dd>{vm.cnaeCodigo && <code className="cli-fi-cnae">{vm.cnaeCodigo}</code>}<span className="cli-fl-valor">{vm.cnaeTexto}</span></dd>
            </div>
          )}
          {vm.endereco && linha('Endereço', vm.endereco, <a className="cli-fi-mapa" href={vm.mapa} target="_blank" rel="noreferrer"><Icone nome="mapaPin" width={14} height={14} />Ver no mapa</a>)}
          {vm.socios.length > 0 && (
            <div className="cli-fl-linha cli-fl-socios">
              <dt>{vm.socios.length === 1 ? 'Sócio' : 'Sócios'}</dt>
              <dd>
                <ul>
                  {vm.socios.map(s => (
                    <li key={s.nome}><Avatar nome={s.nome} tamanho={24} /><span className="cli-fl-valor">{s.nome}</span><span className="cli-fl-pct">{s.participacao}</span></li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
        <p className="cli-fi-pe">Algum dado mudou? <button type="button" className="cli-link-mini" onClick={() => props.irPara('chamados')}>Avise o escritório</button></p>
      </section>
    </>
  );
}

export function Contato(props: DaCasca & { contato: Parameters<typeof useContato>[1]; onWhatsapp?: () => void }) {
  const vm = useContato(props, props.contato);
  return (
    <>
      <div className="cli-titulo">
        <div><MarcaDaTela /><h1 className="page-title">Fale com o escritório</h1><AjudaDaTela /></div>
      </div>
      {/* o WhatsApp em destaque: é por onde o escritório conversa (12/11/2026: sem chat no site) */}
      {vm.whatsapp && (
        <section className="card cli-contato-destaque">
          <MarcaDoEscritorio tamanho={48} />
          <div className="cli-contato-txt">
            <span className="cli-sobre">WhatsApp do escritório</span>
            <b className="cli-contato-numero">{vm.whatsapp}</b>
            {vm.horario && <span className="hint">{vm.horario}</span>}
          </div>
          <span className="cli-acoes">
            {vm.emailGeral && <a className="btn" href={'mailto:' + vm.emailGeral} title={vm.emailGeral}><span className="cli-st-logo" aria-hidden="true"><LogoGmail /></span>E-mail</a>}
            {props.onWhatsapp && <button type="button" className="btn cli-sc-whats" onClick={props.onWhatsapp}><span className="cli-st-logo" aria-hidden="true"><WhatsAppContorno /></span>Abrir conversa</button>}
          </span>
        </section>
      )}
      {/* os setores em cartões pequenos (13/11/2026: "muita informação para o cliente"): o nome, o que cuida e dois
          botões; o número e o e-mail ficam no passar do mouse */}
      {vm.setores.length > 0 && (
        <>
          <h2 className="cli-st-titulo">Fale direto com o setor</h2>
          <ul className="cli-st-grade">
            {vm.setores.map(x => (
              <li key={x.setor} className="card cli-st-cartao">
                <b>{x.setor}</b>
                {x.cuida && <span className="hint">{x.cuida}</span>}
                <span className="cli-st-botoes">
                  {x.whatsapp && <a className="btn btn-sm" href={x.whatsapp.link} target="_blank" rel="noreferrer" title={'WhatsApp ' + x.whatsapp.numero}><span className="cli-st-logo" aria-hidden="true"><WhatsAppContorno /></span>WhatsApp</a>}
                  {x.email && <a className="btn btn-sm" href={x.email.mailto} title={x.email.email}><span className="cli-st-logo" aria-hidden="true"><LogoGmail /></span>E-mail</a>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/**
 * O Faturamento. Enxuto em 16/11/2026 (o dono apresentou a área e ouviu "tinha muita informação"): o mês com dois
 * números e o gráfico da venda por dia (o dia em foco numa linha só); o Banco sem os números repetidos; os Clientes sem
 * as porcentagens; o ano, recolhido, sem os três cartões que repetiam o resumo e o gráfico. O estilo novo fica em
 * faturamento.css.
 */
export function Faturamento(props: DaCasca) {
  const vm = useFaturamento(props);
  const p = vm.painel;
  const topo = useRef<HTMLDivElement>(null);
  const { modal } = useRetorno();
  // o clique no dia abre o relatório do dia (as notas, no estilo do SIEG)
  const abrirDia = async (i: number) => {
    const r = await vm.relatorioDoDia(i);
    if (r) void modal<null>({ titulo: 'Notas de ' + r.titulo.toLowerCase(), corpo: <RelatorioDoDia r={r} onCopiar={vm.copiarChave} pegarDanfe={vm.pegarDanfe} />, botoes: [{ rotulo: 'Voltar', valor: null, variante: 'btn-outline' }] });
  };
  // a coluna do ano e a linha da tabela trocam o mês do painel e sobem até ele
  const abrir = (c: string) => { vm.abrirMes(c); topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <>
      <div className="cli-titulo cli-titulo-fat" ref={topo}>
        <div><MarcaDaTela /><h1 className="page-title">Faturamento</h1><AjudaDaTela /></div>
        {vm.tem && (
          <span className="cli-acoes">
            {vm.empresas.length > 1 && (
              <span className="chip-row" role="radiogroup" aria-label="Empresa" style={{ margin: 0 }}>
                {vm.empresas.map(x => <button key={x.i} type="button" role="radio" aria-checked={x.ativa} className={'chip-f' + (x.ativa ? ' on' : '')} onClick={() => vm.escolher(x.i)}>{x.nome}</button>)}
              </span>
            )}
            <SeletorMes valor={vm.mes} onMudar={vm.abrirMes} rotulo="Mês do painel" max={vm.maxMes} />
            <button type="button" className="btn cli-botao-excel" onClick={vm.baixarPlanilha}><LogoExcel />Baixar planilha</button>
          </span>
        )}
      </div>
      {!vm.tem ? (
        <section className="card"><Vazio icone="barChart" titulo="O faturamento ainda não chegou" texto="Ele aparece aqui quando o escritório puxa as notas emitidas do mês." /></section>
      ) : !p ? (
        <section className="card"><Vazio icone="calendar" titulo="Sem dados deste mês" texto="Escolha um mês dos últimos dois anos." /></section>
      ) : (
        <>
          {/* as abas (13/11/2026: "muita informação aqui"): o mês, o banco e os clientes, uma parte por vez */}
          {vm.secoes.length > 1 && (
            <nav className="cli-fat-abas" role="tablist" aria-label="Partes do faturamento">
              {vm.secoes.map(x => (
                <button key={x.id} type="button" role="tab" data-aba={x.id} aria-selected={x.ativa} className={'cli-fat-aba' + (x.ativa ? ' ativa' : '')} onClick={() => vm.escolherSecao(x.id)}>
                  <Icone nome={x.icone} width={17} height={17} />{x.rotulo}
                </button>
              ))}
            </nav>
          )}

          {/* ---------- o mês ----------
              (16/11/2026, "muita informação") dois números: o faturado e as notas (a média por nota foi para a frase das
              notas; os clientes do mês estão na aba Clientes); o dia em foco numa linha só no topo do gráfico */}
          {vm.secao === 'mes' && <>
          <div className="cli-numeros cli-numeros-fat cli-fat-numeros">
            <div className="cli-numero cli-numero-principal">
              <span className="cli-sobre">{p.emAndamento && <span className="cli-ponto-vivo" aria-hidden="true" />}Faturado no mês</span>
              <span className="cli-numero-valor menor">{p.numeros.total}</span>
              {p.numeros.anterior ? <span className="hint"><span className={'cli-variacao ' + (p.numeros.anterior.subiu ? 'sobe' : 'desce')}>{p.numeros.anterior.variacao || p.numeros.anterior.diferenca}</span> {p.numeros.sobre}</span>
                : <span className="hint">{p.emAndamento ? 'em andamento' : ' '}</span>}
            </div>
            <div className="cli-numero">
              <span className="cli-sobre">Notas emitidas</span>
              <span className="cli-numero-valor menor">{p.numeros.notas}</span>
              <span className="hint">{p.numeros.notasDica || ' '}</span>
            </div>
          </div>

          <section className="card cli-painel-dias cli-fat-dias">
            <div className="card-head">
              <h3>Venda por dia</h3>
              {p.temNotas && p.dias.foco && (
                <span className="cli-fat-foco" aria-live="polite"><span>{p.dias.foco.texto}</span><b>{p.dias.foco.valor}</b></span>
              )}
            </div>
            {p.temNotas
              ? <Colunas colunas={p.dias.colunas} eixo={p.dias.eixo} rotulo="A venda de cada dia do mês. Clique num dia para ver as notas dele" onFoco={vm.focarDia} onClique={c => void abrirDia(Number(c) - 1)} compacto />
              : <Vazio icone="barChart" titulo="Ainda sem a venda por dia" texto="Aparece quando as notas do mês chegam ao escritório." />}
          </section>
          </>}

          {/* ---------- o banco ----------
              (16/11/2026, "muita informação") os dois valores e a leitura curta; o gráfico dos meses; uma linha por conta
              com o que saiu e o saldo (sem os três cartões que repetiam o "entrou"); os lançamentos sem o resumo */}
          {vm.banco && vm.secao === 'banco' && (
            <section className="card cli-fb cli-fat-banco">
              <div className="card-head"><h3>Faturado × entrou no banco</h3></div>
              {vm.banco.contasDaEmpresa.length > 0 && (
                <div className="cli-fb-contas" role="radiogroup" aria-label="Conta">
                  {vm.banco.contasDaEmpresa.map(b => (
                    <button key={b.id || 'todas'} type="button" role="radio" aria-checked={b.ativo} className={'cli-fb-conta' + (b.ativo ? ' ativa' : '')} onClick={() => vm.banco!.escolherBanco(b.id)}>
                      <span className="cli-fb-conta-logo" aria-hidden="true">{b.marca ? <LogoBanco banco={b.marca} cor /> : <Icone nome="landmark" width={15} height={15} />}</span>
                      {b.nome}
                    </button>
                  ))}
                </div>
              )}
              <div className="cli-fb-corpo">
                <div className="cli-fb-mes">
                  <div className="cli-fb-dois">
                    <div><span className="cli-fb-rotulo"><span className="cli-fb-ponto fat" />Faturado</span><b className="cli-valor">{vm.banco.faturado}</b></div>
                    <div><span className="cli-fb-rotulo" title="Todos os créditos dos extratos: entram também transferências entre as suas contas e empréstimos"><span className="cli-fb-ponto banco" />{vm.banco.rotuloEntradas}</span><b className="cli-valor">{vm.banco.entradas}</b></div>
                  </div>
                  <div className={'cli-fb-leitura t-' + vm.banco.tom}>
                    <Icone nome={vm.banco.tom === 'bom' ? 'checkCircle' : vm.banco.tom === 'atencao' ? 'ajuda' : 'clock'} width={16} height={16} />
                    <span>{vm.banco.leituraCurta.forte && <b>{vm.banco.leituraCurta.forte}</b>}{vm.banco.leituraCurta.forte && vm.banco.leituraCurta.resto && ' '}{vm.banco.leituraCurta.resto}</span>
                  </div>
                </div>
                <div className="cli-fb-grafico">
                  <p className="cli-fb-legenda"><span><span className="cli-fb-ponto fat" />Faturado</span><span><span className="cli-fb-ponto banco" />{vm.banco.rotuloEntradas}</span></p>
                  <div className="cli-fb-meses" role="img" aria-label="Os últimos meses: o faturado e o que entrou no banco, lado a lado. Toque num mês para abri-lo">
                    {vm.banco.serie.map(x => (
                      <button key={x.chave} type="button" className={'cli-fb-col' + (x.escolhido ? ' escolhido' : '')} title={x.aria} aria-label={x.aria} onClick={() => vm.abrirMes(x.chave)}>
                        <span className="cli-fb-par">
                          <span className="fat" style={{ height: x.faturado + '%' }} />
                          <span className={'banco' + (x.semBanco ? ' vazio' : '')} style={{ height: (x.semBanco ? 100 : x.entradas) + '%' }} />
                        </span>
                        <span className="cli-fb-mes-rot">{x.rotulo}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {vm.banco.movimento && vm.banco.movimento.contas.length > 0 && (
                <div className="cli-fat-contas" role="table" aria-label="O que saiu de cada conta no mês e o saldo">
                  <div className="cli-fat-conta cli-fat-conta-cabeca" role="row"><span role="columnheader">Conta</span><span role="columnheader">Saiu no mês</span><span role="columnheader">Saldo</span></div>
                  {vm.banco.movimento.contas.map(x => (
                    <div key={x.id} className="cli-fat-conta" role="row">
                      <span className="cli-mv-conta" role="cell"><span className="cli-fb-conta-logo" aria-hidden="true">{x.marca ? <LogoBanco banco={x.marca} cor /> : <Icone nome="landmark" width={15} height={15} />}</span>{x.nome}</span>
                      <span className="cli-valor cli-mv-fraco" role="cell"><span className="cli-fat-rot-cel">Saiu </span>{x.saiu}</span>
                      <span className={'cli-valor cli-variacao ' + x.saldoTom} role="cell" title={x.saldoEm}><span className="cli-fat-rot-cel">Saldo </span>{x.saldo}</span>
                    </div>
                  ))}
                </div>
              )}
              {vm.lancamentos && (vm.lancamentos.carregando || vm.lancamentos.tem) && (
                <div className="cli-lc">
                  <div className="cli-lc-topo">
                    <h4>Lançamentos do mês</h4>
                    <span className="cli-lc-filtros" role="radiogroup" aria-label="Mostrar">
                      {(['todos', 'entradas', 'saidas'] as const).map(f => (
                        <button key={f} type="button" role="radio" aria-checked={vm.lancamentos!.filtro === f} className={'cli-lc-filtro' + (vm.lancamentos!.filtro === f ? ' ativo' : '')} onClick={() => vm.lancamentos!.filtrar(f)}>
                          {{ todos: 'Todos', entradas: 'Entradas', saidas: 'Saídas' }[f]}
                        </button>
                      ))}
                    </span>
                  </div>
                  {vm.lancamentos.carregando ? <p className="hint">Carregando os lançamentos…</p> : (
                    <>
                      {/* a conta só pela logo (o nome no passar do mouse) */}
                      <ul className={'cli-lc-lista cli-fat-lc' + (vm.lancamentos.linhas.some(l => l.conta) ? ' com-conta' : '')}>
                        {vm.lancamentos.linhas.map(l => (
                          <li key={l.chave} className="cli-lc-linha">
                            <span className="cli-lc-data">{l.data}</span>
                            <span className="cli-lc-hist" title={l.historico}>{l.historico}</span>
                            {l.conta && <span className="cli-fb-conta-logo" role="img" title={l.conta.nome} aria-label={l.conta.nome}>{l.conta.marca ? <LogoBanco banco={l.conta.marca} cor /> : <Icone nome="landmark" width={14} height={14} />}</span>}
                            <span className={'cli-valor cli-lc-valor' + (l.entrada ? ' entra' : ' sai')}>{l.valor}</span>
                          </li>
                        ))}
                      </ul>
                      {vm.lancamentos.mais > 0 && <button type="button" className="btn btn-sm cli-lc-mais" onClick={vm.lancamentos.verMais}>Mostrar mais ({vm.lancamentos.mais})</button>}
                      {vm.lancamentos.cortados > 0 && <p className="hint">Mais {vm.lancamentos.cortados} lançamentos no extrato: peça o extrato completo ao escritório.</p>}
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ---------- os clientes ----------
              (16/11/2026, "muita informação") como vendeu numa faixa só (a barra e os três valores lado a lado) e os
              maiores clientes sem a % e sem o "23 no mês" (o "Mais 18 clientes" já fecha a conta) */}
          {vm.secao === 'clientes' && <>
            <section className="card cli-painel-como cli-fat-como">
              <div className="card-head"><h3>Como vendeu</h3></div>
              {p.composicao.partes ? (
                <>
                  <div className="cli-partes" role="img" aria-label={'NF-e ' + p.composicao.textoNfe + ', NFC-e ' + p.composicao.textoNfce}>
                    {p.composicao.partes.nfe > 0 && <span className="cli-parte-nfe" style={{ width: p.composicao.partes.nfe + '%' }} />}
                    {p.composicao.partes.nfce > 0 && <span className="cli-parte-nfce" style={{ width: p.composicao.partes.nfce + '%' }} />}
                  </div>
                  <ul className="cli-fat-como-lista">
                    <li><span><i className="cli-chave cli-parte-nfe" />NF-e <span className="hint">nota de venda</span></span><b>{p.composicao.nfe}</b></li>
                    <li><span><i className="cli-chave cli-parte-nfce" />NFC-e <span className="hint">cupom do balcão</span></span><b>{p.composicao.nfce}</b></li>
                    {p.composicao.servicos && <li><span><i className="cli-chave cli-parte-servico" />Serviços</span><b>{p.composicao.servicos.valor}</b></li>}
                  </ul>
                </>
              ) : <Vazio icone="recibo" titulo="Nenhuma nota no mês" texto="Sem venda de produto neste mês." />}
            </section>
            {p.temNotas && p.clientes.length > 0 && (
              <section className="card">
                <div className="card-head"><h3>Maiores clientes</h3></div>
                <Ranking itens={p.clientes.map(c => ({ chave: c.chave, nome: c.nome, detalhe: c.notas, valor: c.valor, largura: c.largura }))} fim={p.outrosClientes} />
              </section>
            )}
          </>}

          {/* ---------- o ano: recolhido (12/11/2026: "ficou muita informação") ----------
              (16/11/2026, "muita informação") sem os três números (o acumulado já está na linha do botão; o mês em
              andamento, no gráfico e na tabela; os 12 meses foram para o topo do gráfico) e a tabela só com o total e
              a variação (a NF-e, a NFC-e e as notas de cada mês estão na planilha) */}
          {vm.secao === 'mes' && <button type="button" className="cli-ver-ano" aria-expanded={vm.anoAberto} onClick={vm.alternarAno}>
            <span><b>O ano</b><span className="hint">{vm.anoResumo}</span></span>
            <Icone nome="chevronDown" width={16} height={16} className={vm.anoAberto ? 'aberta' : ''} />
          </button>}
          {vm.secao === 'mes' && vm.anoAberto && <>
          {vm.ano.limite && (
            <section className={'card cli-limite' + (vm.ano.limite.alerta ? ' alerta' : '')}>
              <div className="card-head"><h3>{vm.ano.limite.titulo}</h3><span className={'badge ' + vm.ano.limite.situacao.tom}>{vm.ano.limite.situacao.rotulo}</span></div>
              <div className="cli-limite-numeros">
                <span><b className="cli-limite-usado">{vm.ano.limite.usado}</b> <span className="cli-suave">de {vm.ano.limite.teto}</span></span>
                <span className="cli-suave">{vm.ano.limite.texto}</span>
              </div>
              <div className="cli-limite-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={vm.ano.limite.fracao} aria-label={vm.ano.limite.texto}>
                <span className="cli-limite-uso" style={{ width: vm.ano.limite.fracao + '%' }} />
                {vm.ano.limite.sublimite && <span className="cli-limite-marca" style={{ left: vm.ano.limite.sublimite.posicao + '%' }} title={vm.ano.limite.sublimite.rotulo} />}
              </div>
              {vm.ano.limite.sublimite && (
                <div className="cli-limite-regua cli-fat-regua"><span className="cli-limite-sub" style={{ left: vm.ano.limite.sublimite.posicao + '%' }}>{vm.ano.limite.sublimite.rotulo}</span></div>
              )}
              <p className="hint cli-fat-limite-nota">Conta só as notas de produto (NF-e e NFC-e).</p>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h3>Mês a mês</h3><span className="card-head-ctl hint">{vm.ano.doze.valor} nos últimos 12 meses</span></div>
            <Colunas colunas={vm.ano.colunas} eixo={vm.ano.eixo} rotulo="O faturamento de cada mês" onClique={abrir} />
            {/* a tabela no mesmo cartão do gráfico (16/11/2026: um cartão a menos) */}
            <table className="cli-tabela cli-fat-tabela">
              <thead><tr><th>Mês</th><th className="num">Total</th><th className="num">Variação</th><th aria-label="Abrir o mês" /></tr></thead>
              <tbody>
                {vm.ano.linhas.map(l => (
                  <tr key={l.mes} className={'cli-linha-clica' + (l.escolhida ? ' escolhida' : '')} onClick={() => abrir(l.competencia)}>
                    <td><button type="button" className="cli-mes-botao" onClick={ev => { ev.stopPropagation(); abrir(l.competencia); }} aria-label={'Abrir o painel de ' + l.mes}>{l.mes}</button>{l.emAndamento && <span className="badge badge-neutral cli-badge-andamento">em andamento</span>}</td>
                    <td className="num"><span className="cli-valor">{l.total}</span></td>
                    <td className="num">{l.variacao && <span className={'cli-variacao ' + (l.subiu ? 'sobe' : 'desce')}>{l.variacao}</span>}</td>
                    <td className="cli-seta" aria-hidden="true"><Icone nome="chevronRight" width={16} height={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          </>}
        </>
      )}
    </>
  );
}
