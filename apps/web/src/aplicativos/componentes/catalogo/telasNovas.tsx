// As peças das telas novas (23/10/2026: "quero que deixe tudo nos componentes"): a lista com barra (Uso do sistema), a
// empresa na barra e a tabela com a coluna parada (Fiscal), a tabela em árvore e a janela larga (Financeiro). Ficam numa
// lista própria, juntada por último no catálogo (index.ts): assim cada uma é a última do seu tipo e os códigos das peças
// de antes (as janelas, as do Arquivador) não mudam. Peça nova entra no fim daqui.
import { BotaoFechar, Icone, Segmentado, Variacao } from '@nads/ui';
import type { Peca } from './tipos';

export const PECAS_DAS_TELAS_NOVAS: Peca[] = [
  // ─── As peças das telas do Fiscal e do Financeiro (23/10/2026: "quero que deixe tudo nos componentes") ───────────────────
  { id: 'empresa-da-barra', tipo: 'campos', nome: 'Empresa na barra (busca com lista / botão que troca)', descricao: 'Nas ferramentas do Fiscal: sem empresa, a busca curta com lupa e a lista embaixo (↑ ↓ e Enter escolhem); escolhida, o botão com borda com o código e o nome, que troca', componente: 'EmpresaDaBarra (fiscal/partes)', classes: ['busca-curta empresa-da-barra', 'btn btn-outline empresa-da-barra', 'empresa-da-barra-busca', 'nf-achados'], telas: ['t-fiscal-rateio', 't-fiscal-simples'],
    uso: '<EmpresaDaBarra vm={vm} id="rateio-empresas" />',
    demo: () => (
      <div className="tarefas-barra-topo" style={{ width: '100%', margin: 0 }}>
        <label className="busca-curta empresa-da-barra"><Icone nome="search" width={16} height={16} /><input type="text" placeholder="Empresa: código ou nome" aria-label="Buscar a empresa" /></label>
        <button type="button" className="btn btn-outline empresa-da-barra"><Icone nome="briefcase" width={16} height={16} /><span className="empresa-da-barra-nome"><b>462</b> · 3M EMPREENDIMENTOS FLORESTAIS LTDA</span><Icone nome="x" width={14} height={14} /></button>
      </div>) },
  { id: 'tabela-coluna-fixa', tipo: 'tabelas', nome: 'Tabela com a coluna parada (os meses rolam)', descricao: 'No Faturamento: o código e o cliente ficam parados quando a tabela rola para o lado (no celular também), o regime pequeno embaixo do nome, o total e a variação logo depois dele, o cabeçalho e o total parados', classes: ['faturamento-tabela', 'fat-fixa fat-fixa-cod', 'fat-fixa fat-fixa-nome', 'fat-regime', 'fat-col-total'], telas: ['t-fiscal-faturamento'], largo: true,
    uso: '<td className="fat-fixa fat-fixa-cod">23</td><td className="fat-fixa fat-fixa-nome">…<span className="fat-regime">Simples</span></td>',
    demo: () => (
      <div className="table-wrap faturamento-tabela" style={{ width: '100%', maxWidth: 560 }}>
        <table className="table-compact">
          <thead><tr><th className="fat-fixa fat-fixa-cod">Cód.</th><th className="fat-fixa fat-fixa-nome">Cliente</th><th className="num fat-col-total">Total</th><th className="num">Variação</th>{['out/25', 'nov/25', 'dez/25', 'jan/26', 'fev/26'].map(m => <th key={m} className="num">{m}</th>)}</tr></thead>
          <tbody>
            {([[23, 'FLORENCIO MENDES DE OLIVEIRA LTDA', '1.196.820,00', 22.2], [10, 'DORNAS HAVANA LTDA', '588.654,88', -8.3]] as const).map(([c, n, t, v]) => (
              <tr key={c} className="fat-linha"><td className="num fraco fat-fixa fat-fixa-cod">{c}</td><td className="faturamento-nome fat-fixa fat-fixa-nome"><span className="fat-nome-btn">{n}</span><span className="fat-regime">Simples</span></td><td className="num fat-col-total"><b>{t}</b></td><td className="num"><Variacao pct={v} /></td>{[1, 2, 3, 4, 5].map(i => <td key={i} className="num">98.100,00</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>) },
  { id: 'tabela-arvore', tipo: 'tabelas', nome: 'Tabela em árvore com subtotais (Resultado por conta)', descricao: 'As contas pela árvore do plano: o grupo soma os de baixo e abre e fecha na seta; o nome abre os lançamentos; as colunas dizem o que são (atual, mês anterior, ano passado), a variação fica ao lado do que ela compara e o % do total dá o peso; Entradas e Saídas marcadas em verde e vermelho', classes: ['fin-resultado', 'fin-resultado-grupo entrada', 'fin-resultado-grupo saida', 'fin-resultado-conta', 'fin-resultado-abre', 'fin-resultado-nome', 'fin-resultado-col', 'fin-resultado-atual', 'fin-resultado-total', 'fin-resultado-final'], telas: ['t-financeiro-painel'], largo: true,
    uso: '<tr className="fin-resultado-grupo saida"><td colSpan={n}>Saídas</td></tr> · <span className="fin-resultado-col">set/2026<small>atual</small></span>',
    demo: () => (
      <div className="table-wrap fin-resultado-wrap" style={{ width: '100%', maxWidth: 720 }}>
        <table className="table-compact fin-resultado">
          <thead><tr><th>Conta</th><th className="num fin-resultado-atual"><span className="fin-resultado-col">set/2026<small>atual</small></span></th><th className="num"><span className="fin-resultado-col">% do total<small>no set/2026</small></span></th><th className="num fin-resultado-inicio"><span className="fin-resultado-col">ago/2026<small>mês anterior</small></span></th><th className="num"><span className="fin-resultado-col">Variação<small>sobre ago/2026</small></span></th></tr></thead>
          <tbody>
            <tr className="fin-resultado-grupo saida"><td colSpan={5}>Saídas</td></tr>
            <tr className="fin-resultado-pai"><td><span className="fin-resultado-conta" style={{ paddingLeft: 4 }}><button type="button" className="fin-resultado-abre" aria-expanded><Icone nome="caretDown" /></button><button type="button" className="fin-resultado-nome">5 DESPESAS</button></span></td><td className="num fin-resultado-atual">R$ 3.936,31</td><td className="num"><span className="fin-peso">100%</span></td><td className="num fin-resultado-antes fin-resultado-inicio">R$ 1.506,81</td><td className="num"><Variacao pct={161.2} subirEhRuim /></td></tr>
            <tr><td><span className="fin-resultado-conta" style={{ paddingLeft: 22 }}><span className="fin-resultado-abre-vazio" /><button type="button" className="fin-resultado-nome">5.1 Despesas com Pessoal</button></span></td><td className="num fin-resultado-atual">R$ 3.087,00</td><td className="num"><span className="fin-peso">78,4%</span></td><td className="num fin-resultado-antes fin-resultado-inicio">R$ 1.260,00</td><td className="num"><Variacao pct={145} subirEhRuim /></td></tr>
            <tr className="fin-resultado-total"><td>Total de saídas</td><td className="num fin-resultado-atual fin-valor-saida">R$ 3.936,31</td><td className="num" /><td className="num fin-resultado-antes fin-resultado-inicio">R$ 1.506,81</td><td className="num"><Variacao pct={161.2} subirEhRuim /></td></tr>
          </tbody>
        </table>
      </div>) },
  { id: 'lista-com-barra', tipo: 'listas', nome: 'Lista com barra e ação (Uso do sistema)', descricao: 'Uma linha por item: o nome, o número, o botão de ação e, embaixo, a barra na cor (verde = usam, vermelho = ninguém usa); a legenda em palavras com o quadradinho da cor', classes: ['uso-telas-lista', 'uso-tela-item', 'uso-tela-item sem-uso', 'uso-tela-barra', 'uso-explica', 'uso-cor calor-5', 'uso-cor calor-0'], telas: ['t-cadastro-uso'],
    uso: '<div className="uso-tela-item"><span className="uso-tela-nome">…</span><span className="uso-tela-val">202 visitas</span><button className="btn btn-outline btn-sm">Ver os botões</button><span className="uso-tela-barra"><span className="calor-5" style={{ width: pct + "%" }} /></span></div>',
    demo: () => (
      <div className="card uso-telas" style={{ width: '100%', maxWidth: 560, margin: 0 }}>
        <p className="uso-explica"><span className="uso-cor calor-5">verde = usam</span><span className="uso-cor calor-0">vermelho = ninguém usa</span></p>
        <div className="uso-telas-lista">
          {([['Minhas empresas › Empresas', 202, 100], ['Financeiro › Caixa', 61, 30], ['Fiscal › REINF', 0, 0]] as const).map(([n, v, p]) => (
            <div key={n} className={'uso-tela-item' + (v ? '' : ' sem-uso')}><span className="uso-tela-nome">{n}</span><span className="uso-tela-val">{v ? v + ' visitas' : 'ninguém abriu'}</span><button type="button" className="btn btn-outline btn-sm">Ver os botões</button><span className="uso-tela-barra" aria-hidden="true"><span className={'calor-' + (v ? 5 : 0)} style={{ width: p + '%' }} /></span></div>
          ))}
        </div>
      </div>) },
  { id: 'janela-larga', tipo: 'janelas', nome: 'Janela larga com barra e tabela (Resultado por conta)', descricao: 'Aberta por um botão (o Resultado por conta, no Painel do Financeiro): o caminho no topo, a barra das escolhas, a tabela rolando por dentro com o cabeçalho parado e as ações no pé; até 1240 px', classes: ['modal registro-novo fin-resultado-janela', 'registro-topo', 'registro-corpo fin-resultado-corpo', 'registro-pe'], telas: ['t-financeiro-painel'], largo: true,
    uso: '<div className="modal registro-novo fin-resultado-janela"><header className="registro-topo">…</header><div className="registro-corpo fin-resultado-corpo">…</div><footer className="registro-pe">…</footer></div>',
    demo: () => (
      <div className="modal registro-novo fin-resultado-janela" style={{ position: 'static', width: '100%', maxWidth: 640 }}>
        <header className="registro-topo"><span className="registro-caminho"><Icone nome="scale" />Financeiro<Icone nome="chevronRight" /><b>Resultado por conta</b></span><BotaoFechar onClick={() => undefined} /></header>
        <div className="registro-corpo fin-resultado-corpo"><div className="tarefas-barra-topo"><Segmentado valor="c" opcoes={[{ valor: 'c', rotulo: 'Comparativo' }, { valor: 'a', rotulo: 'Ano mês a mês' }]} onMudar={() => undefined} /></div><p className="fraco">A tabela em árvore vai aqui.</p></div>
        <footer className="registro-pe"><span className="tarefas-barra-espaco" /><button type="button" className="btn btn-outline"><Icone nome="download" />Exportar planilha</button><button type="button" className="btn btn-outline">Fechar</button></footer>
      </div>) },
  { id: 'espelho-nota', tipo: 'janelas', nome: 'Espelho da nota (conferir a NF-e)', descricao: 'O "Ver" das notas (Rateio, Faturamento detalhado, SIEG da etapa): a chave de acesso (clicar copia; a consulta da SEFAZ ao lado), o emitente e o destinatário, os totais numa linha (produtos, frete, desconto, IPI, ICMS-ST, total) e os itens (NCM, CFOP, CST, valor, ICMS, ST, IPI)', componente: 'EspelhoDaNota (fiscal/partes)', classes: ['modal registro-novo espelho-nota', 'espelho-chave', 'stat-grid espelho-totais', 'espelho-itens'], telas: ['t-fiscal-rateio', 't-fiscal-faturamento'], largo: true,
    uso: '<EspelhoDaNota nota={notaDoSieg} fechar={fechar} />',
    demo: () => (
      <div className="modal registro-novo espelho-nota" style={{ position: 'static', width: '100%', maxWidth: 720 }}>
        <header className="registro-topo"><span className="registro-caminho"><Icone nome="recibo" />Nota fiscal<Icone nome="chevronRight" /><b>NF-e 502 · série 1 · 08/09/2026</b></span><BotaoFechar onClick={() => undefined} /></header>
        <div className="registro-corpo espelho-corpo">
          <div className="stat-grid fin-numeros espelho-totais">{([['Produtos', '1.000,00'], ['Frete', '500,00'], ['Desconto', '0,00'], ['IPI', '10,00'], ['ICMS-ST', '26,00'], ['Total da nota', '1.536,00']] as const).map(([r, v]) => <div key={r} className="stat"><p className="stat-label">{r}</p><p className="stat-value">R$ {v}</p></div>)}</div>
          <div className="table-wrap espelho-itens"><table className="table-compact"><thead><tr><th>#</th><th>NCM</th><th>CFOP</th><th className="num">Valor</th><th className="num">ICMS</th></tr></thead><tbody><tr><td className="num fraco">1</td><td className="num">39241000</td><td className="num">2102</td><td className="num"><b>600,00</b></td><td className="num">72,00</td></tr></tbody></table></div>
        </div>
        <footer className="registro-pe"><span className="fraco">1 item</span><span className="tarefas-barra-espaco" /><button type="button" className="btn btn-outline">Fechar</button></footer>
      </div>) },
];
