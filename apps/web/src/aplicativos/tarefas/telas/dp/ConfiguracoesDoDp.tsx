// DP › Configurações, no estilo do Cadastro (Vitor, 06/10/2026): a lista dos clientes do DP com os parâmetros de cada um,
// só para ler; clicar no cliente abre a janela dele (a mesma janela com painéis laterais do Cadastro) — Obrigações (o
// movimento e as obrigações do mês; a REINF é do Fiscal) e Entrega (como recebe e o agrupamento). Grava ao mudar; o que foi mudado
// ganha o selo "mudado" e o "Voltar à planilha".
import { MenuDeAgrupamento } from './MenuDeAgrupamento';
import { BotaoIcone, Esqueleto, Icone, useCarregando, useRetorno, MenuSuspenso } from '@nads/ui';
import { Cartao, JanelaLateral, Linha, type TopicoDaJanela } from '../janela/JanelaLateral';
import { useConfiguracoesDoDp, type TopicoDoClienteDp } from './useConfiguracoesDoDp';

const TOPICOS: TopicoDaJanela<TopicoDoClienteDp>[] = [
  { id: 'obrigacoes', rotulo: 'Obrigações', icone: 'checklist' },
  { id: 'entrega', rotulo: 'Entrega', icone: 'envelope' },
];

export function ConfiguracoesDoDp() {
  const vm = useConfiguracoesDoDp();
  const { toast } = useRetorno();
  useCarregando(vm.carregando);
  /** copia o CNPJ/CPF só com os dígitos (para colar nos sites do governo) */
  const copiar = (doc: string) => {
    // o jeito antigo quando o navegador recusa a área de transferência (um campo escondido e o "copiar" do navegador)
    const antigo = () => {
      const campo = Object.assign(document.createElement('textarea'), { value: doc });
      campo.style.position = 'fixed'; campo.style.opacity = '0';
      document.body.appendChild(campo); campo.select();
      const ok = document.execCommand('copy');
      campo.remove();
      toast(ok ? 'Copiado: ' + doc : 'Não consegui copiar.');
    };
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(doc).then(() => toast('Copiado: ' + doc), antigo);
    else antigo();
  };
  const c = vm.cliente;
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        {/* a competência (Vitor, 07/10/2026): o que mudar vale dela em diante */}
        <div className="field dp-filtro">
          <span className="hint">A partir de</span>
          <MenuSuspenso rotulo={vm.rotuloCompetencia} className="btn btn-outline" titulo="Competência" largura={200}
            itens={vm.competencias.map(x => ({ rotulo: x.rotulo, marcado: x.valor === vm.competencia, onClick: () => vm.setCompetencia(x.valor) }))} />
        </div>
        <label className="field dp-filtro dp-busca">
          <span className="hint">Buscar cliente</span>
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Nome, código ou CNPJ/CPF" aria-label="Buscar cliente (nome, código ou CNPJ/CPF)" />
        </label>
        <label className="field dp-filtro">
          <span className="hint">Movimento</span>
          <select className="select-compact" value={vm.movimento} onChange={e => vm.setMovimento(e.target.value)}>
            <option value="">Todos</option>
            {vm.movimentos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="dp-check">
          <input type="checkbox" checked={vm.soMudados} onChange={e => vm.setSoMudados(e.target.checked)} />
          Só os mudados ({vm.mudados})
        </label>
        {vm.admin && (
          <>
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-outline dp-categorias-botao" onClick={vm.abrirCategorias}><Icone nome="plus" />Categorias</button>
          </>
        )}
      </div>
      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <section className="card dp-lista">
          <div className="dp-lista-topo">
            <h3 className="dp-titulo">Clientes do DP</h3>
            <span className="badge badge-neutral">{vm.linhas.length}</span>
          </div>
          <div className="table-wrap">
            <table className="dp-tabela dp-config-lista">
              <thead><tr><th>Cód.</th><th>Cliente</th><th>CNPJ/CPF</th><th>Movimento</th><th>Obrigações do mês</th><th>Entrega</th><th>Agrupamento</th></tr></thead>
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.codigo} className="dp-linha-abre" onClick={() => vm.abrir(l.codigo)} title={'Abrir ' + l.nomeNaTela}>
                    <td className="num fraco">{l.codigo}</td>
                    <td className="dp-cliente">
                      <span className="dp-cliente-nome">{l.nomeNaTela}{l.mudadoNoMes ? <span className="badge badge-warn dp-selo-mudado">muda em {vm.competencia.slice(5, 7)}/{vm.competencia.slice(0, 4)}</span> : l.mudado && <span className="badge badge-neutral dp-selo-mudado">mudado</span>}</span>
                    </td>
                    <td className="dp-documento" onClick={e => e.stopPropagation()}>
                      {l.documento ? (
                        <span className="dp-documento-celula">
                          <span className="num">{l.documento}</span>
                          <BotaoIcone icone="copiar" titulo={'Copiar ' + l.documento} pequeno onClick={() => copiar(l.documento)} />
                        </span>
                      ) : <span className="pill-vazio">sem cadastro</span>}
                    </td>
                    <td>{l.movimento}</td>
                    <td className="dp-obrig-texto">{l.obrigacoesTexto}</td>
                    <td>{l.entrega || <span className="fraco">—</span>}</td>
                    <td>{l.agrupamento || <span className="fraco">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {c && (
        <JanelaLateral rotulo={c.nomeNaTela} topicos={TOPICOS} topico={vm.topico} mudar={vm.setTopico} fechar={vm.fechar} resumo={(
          <div className="usuario-quem">
            <b>{c.nomeNaTela}</b>
            <span className="fraco">Código {c.codigo} · {c.enquadramento}</span>
            {c.responsavel && <span className="fraco">Responsável no Fiscal: {c.responsavel.split('.').map(x => x.charAt(0) + x.slice(1).toLowerCase()).join('.')}</span>}
            <span className="fraco">A partir de {vm.rotuloCompetencia}</span>
            <span className={'badge ' + (c.mudadoNoMes ? 'badge-warn' : c.mudado ? 'badge-neutral' : 'badge-neutral')}>{c.mudadoNoMes ? 'Muda neste mês' : c.mudado ? 'Mudado' : 'Igual à planilha'}</span>
            {c.mudadoNoMes && <button type="button" className="btn" onClick={() => vm.desfazerMes(c.codigo)}><Icone nome="girar" />Desfazer {vm.competencia.slice(5, 7)}/{vm.competencia.slice(0, 4)}</button>}
            {c.mudado && <button type="button" className="btn btn-ghost" onClick={() => vm.voltarAPlanilha(c.codigo)}>Voltar à planilha</button>}
          </div>
        )}>
          {vm.topico === 'obrigacoes' && (
            <>
              <Cartao titulo="Movimento">
                <Linha rotulo="Movimento do mês">
                  <MenuSuspenso rotulo={c.movimento} className="btn btn-outline" titulo="Movimento" direita largura={200}
                    itens={vm.movimentos.map(m => ({ rotulo: m, marcado: m === c.movimento, onClick: () => vm.mudarMovimento(c.codigo, m) }))} />
                </Linha>
              </Cartao>
              <Cartao titulo="Obrigações do mês">
                {vm.obrigacoes.map(o => {
                  const tem = (c.obrigacoes as string[]).includes(o.id);
                  return (
                    <Linha key={o.id} rotulo={o.nome}>
                      <input type="checkbox" checked={tem} aria-label={o.nome} onChange={() => vm.alternarObrigacao(c.codigo, o.id)} />
                    </Linha>
                  );
                })}
              </Cartao>
            </>
          )}
          {vm.topico === 'entrega' && (
            <Cartao titulo="Entrega">
              <Linha rotulo="Como recebe">
                <MenuSuspenso rotulo={c.entrega || 'Escolher'} className="btn btn-outline" titulo="Como recebe" direita largura={200}
                  itens={[...new Set([...vm.entregas, c.entrega])].filter(Boolean).map(x => ({ rotulo: x, marcado: x === c.entrega, onClick: () => vm.mudarEntrega(c.codigo, x) }))} />
              </Linha>
              <Linha rotulo="Agrupamento">
                <MenuDeAgrupamento valor={c.agrupamento} agrupamentos={vm.agrupamentos} onEscolher={v => vm.mudarAgrupamento(c.codigo, v)} />
              </Linha>
            </Cartao>
          )}
        </JanelaLateral>
      )}

      {/* as categorias novas de obrigações (Vitor, 07/10/2026): criar e tirar (só o admin) */}
      {vm.categoriasAbertas && (
        <JanelaLateral rotulo="Categorias do DP" topicos={[{ id: 'categorias', rotulo: 'Categorias', icone: 'checklist' }]} topico="categorias" mudar={() => undefined}
          fechar={vm.fecharCategorias} resumo={<div className="usuario-quem"><b>Categorias do DP</b><span className="fraco">{vm.categorias.length} criada{vm.categorias.length === 1 ? '' : 's'}</span></div>}>
          <Cartao titulo="Nova categoria">
            <Linha rotulo="Nome">
              <input type="text" className="pessoal-select" value={vm.nova.nome} onChange={e => vm.mudarNova({ nome: e.target.value })} placeholder="Ex.: Vale-transporte" aria-label="Nome da categoria"
                onKeyDown={e => { if (e.key === 'Enter') void vm.criarCategoria(); }} />
            </Linha>
            <Linha rotulo="Coluna">
              <input type="text" className="pessoal-select" maxLength={10} value={vm.nova.rotulo} onChange={e => vm.mudarNova({ rotulo: e.target.value })} placeholder="Ex.: VT" aria-label="Rótulo da coluna" />
            </Linha>
            <Linha rotulo="Parte">
              <MenuSuspenso rotulo={vm.partesDasCategorias.find(p => p.id === vm.nova.parte)?.rotulo || ''} className="btn btn-outline" titulo="Parte" direita largura={180}
                itens={vm.partesDasCategorias.map(p => ({ rotulo: p.rotulo, marcado: p.id === vm.nova.parte, onClick: () => vm.mudarNova({ parte: p.id }) }))} />
            </Linha>
            <div className="dp-categoria-pe">
              {vm.nova.erro && <span className="feedback-erro">{vm.nova.erro}</span>}
              <span className="tarefas-barra-espaco" />
              <button type="button" className="btn btn-primary" disabled={!vm.nova.nome.trim()} onClick={() => void vm.criarCategoria()}>Criar</button>
            </div>
          </Cartao>
          {vm.categorias.length > 0 && (
            <Cartao titulo="Criadas">
              {vm.categorias.map(k => (
                <Linha key={k.id} rotulo={k.nome} dica={k.rotulo + ' · ' + k.parteRotulo}>
                  <BotaoIcone icone="x" titulo={'Tirar ' + k.nome} onClick={() => void vm.tirarCategoria(k.id)} />
                </Linha>
              ))}
            </Cartao>
          )}
        </JanelaLateral>
      )}
    </section>
  );
}
