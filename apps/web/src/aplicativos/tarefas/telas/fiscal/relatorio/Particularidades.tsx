// Fiscal › Particularidades Simples / Particularidades Presumido (28/10/2026: "arroz, parcelamento, não é toda empresa
// que tem, estou pensando em colocar em uma tabela de particularidades"): as guias que saíram do Relatório, com o valor em
// reais, só para as empresas que têm (algum valor nelas neste mês ou no anterior). "Todas as empresas" mostra o regime
// inteiro: escrever o valor põe a empresa na lista. Os mesmos dados do Relatório (controleTributos). Só peças que já
// existem: a barra das Obrigações do DP, o Segmentado, a busca, o Excel e a tabela do DP.
import { baixarBytes, Esqueleto, Icone, LogoExcel, MenuSuspenso, Segmentado, useCarregando } from '@nads/ui';
import { Valor } from './PartesDoRelatorio';
import { useRelatorioGeral, type RegimeDoRelatorio } from './useRelatorioGeral';

const MOSTRAR = [{ valor: 'com' as const, rotulo: 'Com particularidade' }, { valor: 'todas' as const, rotulo: 'Todas as empresas' }];

export function Particularidades({ regime }: { regime: RegimeDoRelatorio }) {
  const vm = useRelatorioGeral(regime, 'particularidades');
  const f = vm.filtros;
  const nomes = vm.nomesParticulares.join(' ou ');
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel rel-geral">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <MenuSuspenso icone="calendar" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <Segmentado valor={vm.soComParticularidade ? 'com' : 'todas'} opcoes={MOSTRAR} onMudar={m => vm.setSoComParticularidade(m === 'com')} />
        <MenuSuspenso rotulo={'Por página: ' + (f.porPagina || 'Todas')} titulo="Empresas por página" dica="Quantas empresas por página" className="btn btn-outline"
          itens={f.porPaginaOpcoes.map(o => ({ rotulo: o.rotulo, marcado: o.valor === f.porPagina, onClick: () => f.setPorPagina(o.valor) }))} />
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: o que se escreve fica só nesta aba.</p>}
      {!vm.podeGravar && <p className="hint">Só o Fiscal preenche; você está vendo.</p>}

      {vm.carregando ? <Esqueleto linhas={6} /> : (
        <>
          <div className="tarefas-barra-topo dp-filtros-linha">
            <span className="hint">{vm.soComParticularidade ? vm.achadas + (vm.achadas === 1 ? ' empresa com ' : ' empresas com ') + nomes : vm.achadas + ' empresas do ' + vm.grupo.rotulo}</span>
            <span className="tarefas-barra-espaco" />
            <label className="busca-curta">
              <Icone nome="search" />
              <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)"
                onKeyDown={e => { if (e.key === 'Escape') f.setBusca(''); }} />
            </label>
            <button type="button" className="icon-btn" title="Exportar a tabela para o Excel" aria-label="Exportar a tabela para o Excel" disabled={!vm.linhas.length}
              onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
              <LogoExcel />
            </button>
          </div>
          <section className="card dp-lista">
            {!vm.linhas.length ? (
              <p className="hint dp-vazio">{f.busca ? 'Nenhum cliente com essa busca.' : vm.soComParticularidade
                ? 'Nenhuma empresa com ' + nomes + ' neste mês ou no anterior. Em "Todas as empresas", escreva o valor para pôr uma.'
                : 'Nenhuma empresa do ' + vm.grupo.rotulo + ' no Cadastro.'}</p>
            ) : (
              <div className="table-wrap">
                <table className="dp-tabela">
                  <thead>
                    <tr className="dp-cabeca-grupo">
                      <th colSpan={2} />
                      <th colSpan={vm.guias.length} className="dp-ob-grupo dp-ob-primeira">Guias (R$)</th>
                    </tr>
                    <tr>
                      <th>Cód.</th><th>Cliente</th>
                      {vm.guias.map((c, i) => <th key={c.id} className={'dp-ob' + (i === 0 ? ' dp-ob-primeira' : '')} title={c.nome}>{c.nome}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {vm.linhas.map(r => (
                      <tr key={r.codigo} className="dp-linha">
                        <td className="num fraco">{r.codigo}</td>
                        <td className="dp-cliente"><span className="dp-cliente-nome" title={r.nome}>{r.nome}</span></td>
                        {vm.guias.map((c, i) => (
                          <td key={c.id} className={'num' + (i === 0 ? ' dp-ob-primeira' : '')}>
                            <Valor estreito valor={r.linha.valores[c.id] || ''} sugestao={r.sugestao?.valores[c.id]} rotulo={c.nome + ' de ' + r.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarValor(r.codigo, c.id, v)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}><b>Total</b></td>
                      {vm.totais.map((x, i) => <td key={x.id} className={'num' + (i === 0 ? ' dp-ob-primeira' : '')}>{x.valor}</td>)}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
          {vm.pagina.paginas > 1 && (
            <div className="tarefas-barra-topo dp-filtros-linha">
              <span className="tarefas-barra-espaco" />
              <span className="hint">{vm.pagina.de}–{vm.pagina.ate} de {vm.achadas} · página {vm.pagina.atual + 1} de {vm.pagina.paginas}</span>
              <button type="button" className="btn btn-outline" disabled={vm.pagina.atual === 0} onClick={vm.pagina.anterior}><Icone nome="chevronLeft" />Anterior</button>
              <button type="button" className="btn btn-outline" disabled={vm.pagina.atual >= vm.pagina.paginas - 1} onClick={vm.pagina.proxima}>Próxima<Icone nome="chevronRight" /></button>
            </div>
          )}
          <p className="hint">O número em reais, "-" quando não tem guia ou "0". Em cinza, o que o Entregas já entregou. A empresa fica aqui enquanto tiver valor neste mês ou no anterior.</p>
        </>
      )}
    </section>
  );
}
