// As telas do Administrativo da Área do Cliente (12/11/2026): os Dados cadastrais e o Fale com o escritório (antes,
// janelas; "quero uma tela melhor disso aqui") e o Faturamento ("quero o faturamento do cliente aqui via fiscal"). Só
// desenham: os dados vêm de useAdministrativo.ts.
import { Icone, LogoExcel, SeletorMes, useRetorno } from '@nads/ui';
import { useRef } from 'react';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { Avatar } from '../partes/Avatar';
import { Vazio } from '../partes/Vazio';
import type { DaCasca } from './useAreaCliente';
import { useContato, useEmpresa, useFaturamento, type ColunaDoGrafico, type VistaDoRelatorio } from './useAdministrativo';
import { useVisualizar } from './useVisualizar';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';

/** O relatório do dia, no estilo da lista do portal do SIEG: os totais no alto e uma linha por nota. */
function RelatorioDoDia({ r, onCopiar, pegarDanfe }: { r: VistaDoRelatorio; onCopiar: (chave: string) => void; pegarDanfe: (chave: string) => Promise<{ nome: string; arquivo: Blob } | { erro: string }> }) {
  // a DANFE abre na janela de visualização (a mesma da guia), por cima do relatório
  const vista = useVisualizar();
  const verDanfe = (chave: string) => { if (!vista.abrindo) vista.ver(chave, () => pegarDanfe(chave)); };
  return (
    <div className="cli-app cli-janela cli-relatorio-dia">
      <div className="cli-relatorio-resumo">
        {r.resumo.map(x => <div key={x.rotulo}><span className="cli-sobre">{x.rotulo}</span><b>{x.valor}</b></div>)}
      </div>
      {r.porTipo && <p className="hint">{r.porTipo}</p>}
      {r.aviso && <p className="hint">{r.aviso}</p>}
      {r.vazio ? <p className="hint cli-ficha-dica">Nenhuma nota emitida neste dia.</p> : (
        <div className="cli-relatorio-rolo">
          <table className="cli-tabela cli-tabela-sieg">
            <thead><tr><th>Número</th><th>Modelo</th><th>Destinatário</th><th className="cli-so-largo">CFOP</th><th className="num">Valor</th><th>Situação</th><th className="cli-so-largo">Chave de acesso</th><th aria-label="DANFE" /></tr></thead>
            <tbody>
              {r.notas.map(n => (
                <tr key={n.chave} className={(n.cancelada ? 'cancelada' : '') + (n.temDanfe ? ' cli-linha-clica' : '')} onClick={n.temDanfe ? () => verDanfe(n.chave) : undefined}>
                  <td className="num-esq"><b>{n.numero}</b><span className="hint"> · série {n.serie}</span></td>
                  <td><span className={'cli-modelo m-' + n.tipo.replace(/\W/g, '').toLowerCase()}>{n.tipo}</span></td>
                  <td className="cli-relatorio-cliente" title={n.cliente}>{n.cliente}</td>
                  <td className="cli-so-largo cli-suave">{n.cfop}</td>
                  <td className="num"><span className="cli-valor">{n.valor}</span></td>
                  <td>{n.cancelada ? <span className="badge badge-bad">Cancelada</span> : <span className="badge badge-ok">Autorizada</span>}</td>
                  <td className="cli-so-largo">{n.chaveCurta && <button type="button" className="cli-chave-botao" title={n.chaveInteira} onClick={ev => { ev.stopPropagation(); onCopiar(n.chaveInteira); }}>{n.chaveCurta}<Icone nome="copiar" width={13} height={13} /></button>}</td>
                  <td className="cli-relatorio-danfe">
                    {n.temDanfe && (
                      <button type="button" className="btn btn-sm" disabled={!!vista.abrindo} aria-label={'Ver a DANFE da nota ' + n.numero}
                        onClick={ev => { ev.stopPropagation(); verDanfe(n.chave); }}>
                        <Icone nome="olho" width={14} height={14} />{vista.abrindo === n.chave ? 'Abrindo…' : 'DANFE'}
                      </button>
                    )}
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
function Colunas({ colunas, eixo, rotulo, onFoco, onClique, compacto }: {
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

/** Uma lista em ranking (os maiores clientes, as operações): o nome, o valor, a parte e a barra. */
function Ranking({ itens, fim }: { itens: { chave: string; nome: string; detalhe?: string; valor: string; parte: string; largura: number }[]; fim?: { texto: string; valor: string; parte: string } | null }) {
  return (
    <ol className="cli-ranking">
      {itens.map(x => (
        <li key={x.chave}>
          <span className="cli-ranking-topo">
            <span className="cli-ranking-nome"><b>{x.nome}</b>{x.detalhe && <span className="hint">{x.detalhe}</span>}</span>
            <span className="cli-ranking-num"><b>{x.valor}</b><span className="hint">{x.parte}</span></span>
          </span>
          <span className="cli-ranking-barra" aria-hidden="true"><span style={{ width: x.largura + '%' }} /></span>
        </li>
      ))}
      {fim && (
        <li className="cli-ranking-fim">
          <span className="cli-ranking-topo">
            <span className="cli-ranking-nome"><span className="hint">{fim.texto}</span></span>
            <span className="cli-ranking-num"><b>{fim.valor}</b><span className="hint">{fim.parte}</span></span>
          </span>
        </li>
      )}
    </ol>
  );
}

export function Empresa(props: DaCasca) {
  const vm = useEmpresa(props);
  if (!vm.tem) return <Vazio icone="predio" titulo="Os dados da empresa ainda não chegaram" texto="Quando o escritório completar o cadastro, eles aparecem aqui." />;
  return (
    <>
      <div className="cli-titulo"><div><h1 className="page-title">Dados cadastrais</h1></div></div>
      {/* o cartão da empresa: a identificação no alto, os dados em duas colunas e os sócios embaixo */}
      <section className="card cli-ce">
        <div className="cli-ce-topo">
          <span className="cli-ce-marca">{vm.logo ? <img src={vm.logo} alt={'Logo de ' + vm.razaoSocial} /> : vm.iniciais}</span>
          <div className="cli-ce-nome">
            <h2>{vm.razaoSocial}</h2>
            {vm.nomeFantasia && <span className="hint">{vm.nomeFantasia}</span>}
            <span className="cli-ce-selos">
              <button type="button" className="cli-ce-cnpj" title="Copiar o CNPJ" onClick={() => vm.copiar(vm.cnpj, 'CNPJ')}>
                <span className="cli-sobre">CNPJ</span><b>{vm.cnpj}</b><Icone nome="copiar" width={13} height={13} />
              </button>
              {vm.regime && <span className="badge badge-neutral">{vm.regime}</span>}
            </span>
          </div>
        </div>
        {vm.campos.length > 0 && (
          <dl className="cli-ce-campos">
            {vm.campos.map(f => (
              <div key={f.rotulo} className={'cli-ce-campo' + (f.largo ? ' largo' : '')}>
                <dt>{f.rotulo}</dt>
                <dd>
                  <span>{f.valor}</span>
                  {f.copiar && <button type="button" className="icon-btn icon-btn-sm" title={'Copiar ' + f.rotulo.toLowerCase()} aria-label={'Copiar ' + f.rotulo.toLowerCase()} onClick={() => vm.copiar(f.valor, f.rotulo)}><Icone nome="copiar" width={14} height={14} /></button>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {vm.socios.length > 0 && (
          <div className="cli-ce-socios">
            <span className="cli-sobre">Sócios</span>
            <ul>
              {vm.socios.map(s => (
                <li key={s.nome}><Avatar nome={s.nome} tamanho={28} /><b>{s.nome}</b>{s.participacao && <span className="cli-ce-pct">{s.participacao}</span>}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

export function Contato(props: DaCasca & { contato: Parameters<typeof useContato>[1]; onWhatsapp?: () => void }) {
  const vm = useContato(props, props.contato);
  return (
    <>
      <div className="cli-titulo">
        <div><h1 className="page-title">Fale com o escritório</h1></div>
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
            <button type="button" className="icon-btn" title="Copiar o número" aria-label="Copiar o número do WhatsApp" onClick={() => vm.copiar(vm.whatsapp, 'WhatsApp')}><Icone nome="copiar" width={16} height={16} /></button>
            {props.onWhatsapp && <button type="button" className="btn btn-primary" onClick={props.onWhatsapp}><Icone nome="mensagem" width={16} height={16} />Abrir conversa</button>}
          </span>
        </section>
      )}
      {/* os outros contatos num cartão só, uma linha por contato */}
      {vm.linhas.length > 0 && (
        <section className="card cli-fc">
          <div className="card-head"><h3>Telefone e e-mails</h3></div>
          <ul className="cli-fc-lista">
            {vm.linhas.map(l => (
              <li key={l.chave} className="cli-fc-linha">
                <span className="cli-fc-ico" aria-hidden="true"><Icone nome={l.icone} width={16} height={16} /></span>
                <span className="cli-fc-txt"><span className="cli-sobre">{l.setor}</span><b>{l.usuario}{l.dominio && <><wbr />{l.dominio}</>}</b></span>
                <span className="cli-fc-acoes">
                  <a className="btn btn-sm" href={l.href}>{l.acao}</a>
                  <button type="button" className="icon-btn" title={'Copiar ' + (l.icone === 'telefone' ? 'o telefone' : 'o e-mail')} aria-label={'Copiar ' + l.valor} onClick={() => vm.copiar(l.valor, l.rotuloDoCopiar)}><Icone nome="copiar" width={16} height={16} /></button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

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
        <div><h1 className="page-title">Faturamento</h1></div>
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
          {/* ---------- o mês ---------- */}
          <div className="cli-numeros cli-numeros-fat">
            <div className="cli-numero cli-numero-principal">
              <span className="cli-sobre">{p.emAndamento && <span className="cli-ponto-vivo" aria-hidden="true" />}Faturado em {p.titulo.toLowerCase()}</span>
              <span className="cli-numero-valor menor">{p.numeros.total}</span>
              {p.numeros.anterior ? <span className="hint"><span className={'cli-variacao ' + (p.numeros.anterior.subiu ? 'sobe' : 'desce')}>{p.numeros.anterior.variacao || p.numeros.anterior.diferenca}</span> sobre {p.numeros.anterior.mes.toLowerCase()}</span>
                : <span className="hint">{p.emAndamento ? 'em andamento' : ' '}</span>}
            </div>
            <div className="cli-numero">
              <span className="cli-sobre">Notas emitidas</span>
              <span className="cli-numero-valor menor">{p.numeros.notas}</span>
              <span className="hint">{p.numeros.canceladas}</span>
            </div>
            <div className="cli-numero">
              <span className="cli-sobre">Média por nota</span>
              <span className="cli-numero-valor menor">{p.numeros.ticket}</span>
              <span className="hint">{p.numeros.clientes !== '—' ? p.numeros.clientes + ' clientes ' + p.numeros.clientesDica : p.numeros.clientesDica}</span>
            </div>
          </div>

          {!p.temNotas && p.tem && (
            <div className="cli-aviso-fat"><Icone nome="lampada" width={16} height={16} /><span>A venda por dia, os clientes e as operações aparecem quando o escritório baixa os XMLs do mês no SIEG.</span></div>
          )}

          <div className="cli-painel-fat">
            <section className="card cli-painel-dias">
              <div className="card-head">
                <h3>Venda por dia</h3>
                {p.temNotas && <span className="card-head-ctl hint">{p.dias.diasComVenda}</span>}
              </div>
              {p.temNotas ? (
                <>
                  {p.dias.foco && (
                    <div className="cli-foco" aria-live="polite">
                      <span className="cli-sobre">{p.dias.foco.data}</span>
                      <span className="cli-foco-valor"><b>{p.dias.foco.valor}</b>{p.dias.foco.melhor && <span className="badge badge-neutral">melhor dia do mês</span>}</span>
                    </div>
                  )}
                  <Colunas colunas={p.dias.colunas} eixo={p.dias.eixo} rotulo="A venda de cada dia do mês. Clique num dia para ver as notas dele" onFoco={vm.focarDia} onClique={c => void abrirDia(Number(c) - 1)} compacto />
                </>
              ) : <Vazio icone="barChart" titulo="Ainda sem o detalhe do mês" texto="Chega com os XMLs do SIEG." />}
            </section>

            <section className="card cli-painel-como">
              <div className="card-head"><h3>Como vendeu</h3></div>
              {p.composicao.partes ? (
                <>
                  <div className="cli-partes alta" role="img" aria-label={'NF-e ' + p.composicao.textoNfe + ', NFC-e ' + p.composicao.textoNfce}>
                    {p.composicao.partes.nfe > 0 && <span className="cli-parte-nfe" style={{ width: p.composicao.partes.nfe + '%' }}>{p.composicao.partes.nfe >= 14 && p.composicao.textoNfe}</span>}
                    {p.composicao.partes.nfce > 0 && <span className="cli-parte-nfce" style={{ width: p.composicao.partes.nfce + '%' }}>{p.composicao.partes.nfce >= 14 && p.composicao.textoNfce}</span>}
                  </div>
                  <ul className="cli-como">
                    <li><span><i className="cli-chave cli-parte-nfe" />NF-e <span className="hint">nota de venda</span></span><b>{p.composicao.nfe}</b></li>
                    <li><span><i className="cli-chave cli-parte-nfce" />NFC-e <span className="hint">cupom do balcão</span></span><b>{p.composicao.nfce}</b></li>
                    {p.composicao.servicos && <li><span><i className="cli-chave cli-parte-servico" />Serviços <span className="hint">{p.composicao.servicos.notas}</span></span><b>{p.composicao.servicos.valor}</b></li>}
                  </ul>
                </>
              ) : <Vazio icone="recibo" titulo="Nenhuma nota no mês" texto="Sem venda de produto neste mês." />}
            </section>
          </div>

          {p.temNotas && p.clientes.length > 0 && (
              <section className="card">
                <div className="card-head"><h3>Maiores clientes</h3><span className="card-head-ctl hint">{p.numeros.clientes} no mês</span></div>
                {p.clientes.length ? <Ranking itens={p.clientes.map(c => ({ chave: c.chave, nome: c.nome, detalhe: c.notas, valor: c.valor, parte: c.parte, largura: c.largura }))} fim={p.outrosClientes} />
                  : <p className="hint">Só serviço neste mês.</p>}
              </section>
          )}

          {/* ---------- o ano: recolhido (12/11/2026: "ficou muita informação") ---------- */}
          <button type="button" className="cli-ver-ano" aria-expanded={vm.anoAberto} onClick={vm.alternarAno}>
            <span><b>O ano</b><span className="hint">{vm.anoResumo}</span></span>
            <Icone nome="chevronDown" width={16} height={16} className={vm.anoAberto ? 'aberta' : ''} />
          </button>
          {vm.anoAberto && <>
          <div className="cli-numeros cli-numeros-fat">
            {vm.ano.acumulado && (
              <div className="cli-numero">
                <span className="cli-sobre">{vm.ano.acumulado.titulo}</span>
                <span className="cli-numero-valor menor">{vm.ano.acumulado.valor}</span>
                <span className="hint">{vm.ano.acumulado.periodo}{vm.ano.acumulado.comparacao && <> · <span className={'cli-variacao ' + (vm.ano.acumulado.subiu ? 'sobe' : 'desce')}>{vm.ano.acumulado.comparacao}</span></>}</span>
              </div>
            )}
            <div className="cli-numero">
              <span className="cli-sobre">Últimos 12 meses</span>
              <span className="cli-numero-valor menor">{vm.ano.doze.valor}</span>
              <span className="hint">{vm.ano.doze.media}</span>
            </div>
            <div className="cli-numero cli-numero-andamento">
              <span className="cli-sobre"><span className="cli-ponto-vivo" aria-hidden="true" />{vm.ano.andamento.mes}</span>
              <span className="cli-numero-valor menor">{vm.ano.andamento.valor}</span>
              <span className="hint">em andamento</span>
            </div>
          </div>

          {vm.ano.limite && (
            <section className={'card cli-limite' + (vm.ano.limite.alerta ? ' alerta' : '')}>
              <div className="card-head"><h3>{vm.ano.limite.titulo}</h3><span className={'badge ' + vm.ano.limite.situacao.tom}>{vm.ano.limite.situacao.rotulo}</span></div>
              <div className="cli-limite-numeros">
                <span><b className="cli-limite-usado">{vm.ano.limite.usado}</b> <span className="cli-suave">de {vm.ano.limite.teto}</span></span>
                <span className="cli-suave">{vm.ano.limite.texto}{vm.ano.limite.resta && ' · ' + vm.ano.limite.resta}</span>
              </div>
              <div className="cli-limite-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={vm.ano.limite.fracao} aria-label={vm.ano.limite.texto}>
                <span className="cli-limite-uso" style={{ width: vm.ano.limite.fracao + '%' }} />
                {vm.ano.limite.sublimite && <span className="cli-limite-marca" style={{ left: vm.ano.limite.sublimite.posicao + '%' }} title={vm.ano.limite.sublimite.rotulo} />}
              </div>
              <div className="cli-limite-regua">
                <span>R$ 0</span>
                {vm.ano.limite.sublimite && <span className="cli-limite-sub" style={{ left: vm.ano.limite.sublimite.posicao + '%' }}>{vm.ano.limite.sublimite.rotulo}</span>}
                <span>{vm.ano.limite.tetoCurto}</span>
              </div>
              <p className="hint">Pelas notas de produto (NF-e e NFC-e) emitidas no ano. Se a empresa também presta serviço, a receita real é maior: fale com o escritório.</p>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h3>Mês a mês</h3></div>
            <Colunas colunas={vm.ano.colunas} eixo={vm.ano.eixo} rotulo="O faturamento de cada mês" onClique={abrir} />
          </section>

          <section className="card cli-card-tabela">
            <div className="card-head cli-tabela-topo"><h3>Detalhe por mês</h3></div>
            <table className="cli-tabela">
              <thead><tr><th>Mês</th><th className="num cli-so-largo">NF-e</th><th className="num cli-so-largo">NFC-e</th><th className="num cli-so-largo">Notas</th><th className="num">Total</th><th className="num">Variação</th><th aria-label="Abrir o mês" /></tr></thead>
              <tbody>
                {vm.ano.linhas.map(l => (
                  <tr key={l.mes} className={'cli-linha-clica' + (l.escolhida ? ' escolhida' : '')} onClick={() => abrir(l.competencia)}>
                    <td><button type="button" className="cli-mes-botao" onClick={ev => { ev.stopPropagation(); abrir(l.competencia); }} aria-label={'Abrir o painel de ' + l.mes}>{l.mes}</button>{l.emAndamento && <span className="badge badge-neutral cli-badge-andamento">em andamento</span>}</td>
                    <td className="num cli-so-largo cli-suave">{l.nfe}</td><td className="num cli-so-largo cli-suave">{l.nfce}</td><td className="num cli-so-largo cli-suave">{l.notas}</td>
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
