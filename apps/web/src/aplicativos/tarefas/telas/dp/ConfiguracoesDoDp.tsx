// DP › Configurações, no estilo do Cadastro (Vitor, 06/10/2026): a lista dos clientes do DP com os parâmetros de cada um,
// só para ler; clicar no cliente abre a janela dele (a mesma janela com painéis laterais do Cadastro) — Identificação (o
// CNPJ/CPF: o do Entregas ou, sem ele, o do Cadastro, onde se cadastra; 20/10/2026), Obrigações (o
// movimento e as obrigações do mês; a REINF é do Fiscal) e Entrega (como recebe e o agrupamento). Grava ao mudar; o que foi mudado
// ganha o selo "mudado" e o "Voltar à planilha".
import { MenuDeAgrupamento } from './MenuDeAgrupamento';
import { BotaoIcone, Esqueleto, Icone, useCarregando, useEntradaAnimada, useRetorno, MenuSuspenso } from '@nads/ui';
import { Cartao, JanelaLateral, Linha, type TopicoDaJanela } from '../janela/JanelaLateral';
import { MenuDeFiltro } from './MenuDeFiltro';
import { useConfiguracoesDoDp, type TopicoDoClienteDp } from './useConfiguracoesDoDp';

const TOPICOS: TopicoDaJanela<TopicoDoClienteDp>[] = [
  { id: 'identificacao', rotulo: 'Identificação', icone: 'cartao' },
  { id: 'obrigacoes', rotulo: 'Obrigações', icone: 'checklist' },
  { id: 'entrega', rotulo: 'Entrega', icone: 'envelope' },
];

export function ConfiguracoesDoDp() {
  const vm = useConfiguracoesDoDp();
  const { toast } = useRetorno();
  useCarregando(vm.carregando);
  // o DP animado (14/10/2026): a lista entra em cascata ao abrir e ao filtrar
  const tabela = useEntradaAnimada<HTMLDivElement>('tbody > tr', [vm.carregando, vm.busca, vm.movimento, vm.soMudados, vm.competencia], 'lista');
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
      <div className="tarefas-barra-topo dp-filtros-linha">
        {/* a barra no padrão do resto do app (revisão da UI, 16/10/2026): a busca de lupa e os filtros em menus numa linha */}
        {/* a competência (Vitor, 07/10/2026): o que mudar vale dela em diante */}
        <MenuSuspenso icone="calendar" rotulo={'A partir de ' + vm.rotuloCompetencia} className="btn btn-outline" titulo="A partir de" dica="O que mudar vale desta competência em diante" largura={220}
          itens={vm.competencias.map(x => ({ rotulo: x.rotulo, marcado: x.valor === vm.competencia, onClick: () => vm.setCompetencia(x.valor) }))} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome, código ou CNPJ/CPF)"
            onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <MenuDeFiltro rotulo="Movimento" valor={vm.movimento} mudar={vm.setMovimento} opcoes={vm.movimentos} />
        <label className="dp-check">
          <input type="checkbox" checked={vm.soMudados} onChange={e => vm.setSoMudados(e.target.checked)} />
          Só os mudados ({vm.mudados})
        </label>
        {/* o botão Categorias saiu (Vitor, 28/10/2026: "exclui o botão categorias"); as criadas continuam nas colunas */}
      </div>
      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <section className="card dp-lista">
          <div className="dp-lista-topo">
            <h3 className="dp-titulo">Clientes do DP</h3>
            <span className="badge badge-neutral">{vm.linhas.length}</span>
          </div>
          <div className="table-wrap" ref={tabela}>
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
                      {/* clicar no número copia (Vitor, 14/10/2026: "remova esse botão de copiar e faça com que o número ao clicar seja copiado") */}
                      {l.documento ? (
                        <button type="button" className="texto-copiavel num" title="Clique para copiar" onClick={() => copiar(l.documento)}>{l.documentoNaTela}</button>
                      ) : (
                        // sem CNPJ/CPF em lugar nenhum (nem no Cadastro, nem no Entregas): digita-se aqui mesmo, com a máscara,
                        // e grava no Cadastro da empresa (Sávio, 20/10/2026: "não tem como cadastrar")
                        <span className="dp-documento-novo">
                          <input type="text" inputMode="numeric" className="pessoal-select num" value={vm.naLinha(l.codigo).texto} placeholder="Digite o CNPJ ou CPF"
                            aria-label={'CNPJ ou CPF de ' + l.nomeNaTela} aria-invalid={!!vm.naLinha(l.codigo).erro || undefined} title={vm.naLinha(l.codigo).erro || 'Sem CNPJ/CPF no Cadastro e no Entregas: digite e tecle Enter'}
                            onChange={e => vm.mudarNaLinha(l.codigo, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') vm.gravarNaLinha(l.codigo); }} />
                          {vm.naLinha(l.codigo).texto && <BotaoIcone icone="check" pequeno titulo="Gravar o CNPJ/CPF" onClick={() => vm.gravarNaLinha(l.codigo)} />}
                        </span>
                      )}
                      {!l.documento && vm.naLinha(l.codigo).erro && <span className="feedback-erro dp-documento-erro">{vm.naLinha(l.codigo).erro}</span>}
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
        <JanelaLateral rotulo={c.nomeNaTela} topicos={TOPICOS.map(t => t.id === 'identificacao' ? { ...t, alerta: vm.identificacao?.origem === 'nenhum' } : t)} topico={vm.topico} mudar={vm.setTopico} fechar={vm.fechar} resumo={(
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
          {vm.topico === 'identificacao' && vm.identificacao && (
            <Cartao titulo="Identificação">
              {vm.identificacao.origem === 'entregas' ? (
                // o do Entregas vale e não se muda daqui
                <Linha rotulo="CNPJ/CPF" dica="Do cadastro do Entregas">
                  <button type="button" className="texto-copiavel num" title="Clique para copiar" onClick={() => copiar(vm.identificacao!.documento.replace(/\D/g, ''))}>{vm.identificacao.documento}</button>
                </Linha>
              ) : (
                <>
                  <Linha rotulo="CNPJ/CPF" dica={vm.identificacao.origem === 'cadastro' ? 'Do Cadastro do nads' : vm.identificacao.origem === 'exemplo' ? 'Inventado (dados de exemplo)' : 'O Entregas não tem: cadastre aqui (vai para o Cadastro da empresa)'}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="text" inputMode="numeric" className="pessoal-select num" value={vm.documentoNovo.texto} placeholder="CNPJ ou CPF" aria-label="CNPJ ou CPF"
                        onChange={e => vm.mudarDocumentoNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') vm.gravarDocumento(); }} />
                      <BotaoIcone icone="check" titulo="Gravar o CNPJ/CPF" onClick={vm.gravarDocumento} />
                    </span>
                  </Linha>
                  {vm.documentoNovo.erro && <span className="feedback-erro">{vm.documentoNovo.erro}</span>}
                </>
              )}
            </Cartao>
          )}
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

    </section>
  );
}
