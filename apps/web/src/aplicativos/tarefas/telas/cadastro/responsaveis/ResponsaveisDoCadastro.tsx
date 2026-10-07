// Cadastro › Responsáveis: quem cuida de cada empresa no Fiscal e no Contábil. Sem responsável, escolhe direto; com
// responsável, só pela transferência (Vitor, 07/10/2026), que vale com o aceite do emitente e do destinatário. Em cima, as pessoas com quantas
// empresas têm (clicar filtra a lista); embaixo, a lista com um seletor por departamento (grava ao escolher).
import { Esqueleto, Icone, MenuSuspenso, useCarregando } from '@nads/ui';
import { useResponsaveisDoCadastro } from './useResponsaveisDoCadastro';

export function ResponsaveisDoCadastro() {
  const vm = useResponsaveisDoCadastro();
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        <label className="field dp-filtro dp-busca">
          <span className="hint">Buscar empresa</span>
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Nome ou código" aria-label="Buscar empresa (nome ou código)" />
        </label>
        <label className="field dp-filtro">
          <span className="hint">Sem responsável no</span>
          <select className="select-compact" value={vm.semEm} onChange={e => vm.setSemEm(e.target.value as typeof vm.semEm)}>
            <option value="">—</option>
            {vm.departamentos.map(d => <option key={d.id} value={d.id}>{d.rotulo} ({vm.semResponsavel[d.id]})</option>)}
          </select>
        </label>
        {(vm.pessoa || vm.semEm || vm.busca) && (
          <button type="button" className="btn btn-ghost dp-limpar" onClick={() => { vm.setPessoa(''); vm.setSemEm(''); vm.setBusca(''); }}><Icone nome="x" />Limpar filtros</button>
        )}
      </div>
      {vm.carregando ? <Esqueleto numeros={4} linhas={8} /> : (
        <>
          <section className="card dp-progresso">
            <h3 className="dp-titulo">Pessoas</h3>
            <div className="dp-progresso-grade">
              {vm.pessoas.map(p => (
                <button key={p.nome} type="button" className={'dp-pessoa' + (vm.pessoa === p.nome ? ' ativa' : '')} onClick={() => vm.setPessoa(vm.pessoa === p.nome ? '' : p.nome)}
                  title={'Ver as empresas de ' + p.nome}>
                  <span className="dp-pessoa-topo"><b>{p.nome}</b><span className="num">{p.total}</span></span>
                  <span className="hint">{[p.fiscal ? p.fiscal + ' no Fiscal' : '', p.contabil ? p.contabil + ' no Contábil' : ''].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="card dp-lista">
            <div className="dp-lista-topo">
              <h3 className="dp-titulo">Empresas</h3>
              <span className="badge badge-neutral">{vm.linhas.length}</span>
            </div>
            <div className="table-wrap">
              <table className="dp-tabela dp-config">
                <thead><tr><th>Cód.</th><th>Empresa</th>{vm.departamentos.map(d => <th key={d.id}>{d.rotulo}</th>)}</tr></thead>
                <tbody>
                  {vm.linhas.map(l => (
                    <tr key={l.chave}>
                      <td className="num fraco">{l.codigo ?? ''}</td>
                      <td className="dp-cliente"><span className="dp-cliente-nome">{l.nome}</span><span className="dp-cliente-info">{l.regime}</span></td>
                      {vm.departamentos.map(d => {
                        const valor = l.responsaveis[d.id];
                        const opcoes = [...new Set([...vm.opcoes[d.id], valor].filter(Boolean))];
                        const t = l.transferencias[d.id];
                        const atual = vm.atual(l, d.id);
                        const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
                        if (t) {
                          // o pedido em andamento: de → para, quem falta aceitar e o que eu posso fazer
                          const falta = vm.faltam(t);
                          const souEu = falta.some(n => igual(n, vm.eu));
                          return (
                            <td key={d.id}>
                              <div className="resp-transf">
                                <span className="resp-transf-nomes"><Icone nome="repeat" /><b>{t.de}</b> → <b>{t.para}</b></span>
                                <span className="hint">Falta o aceite de {falta.join(' e ')}</span>
                                <span className="resp-transf-botoes">
                                  {souEu && <button type="button" className="btn btn-primary" onClick={() => vm.responder(l.nome, l.codigo, d.id, true)}><Icone nome="check" />Aceitar</button>}
                                  {souEu && <button type="button" className="btn" onClick={() => vm.responder(l.nome, l.codigo, d.id, false)}>Recusar</button>}
                                  {(igual(t.pedidoPor, vm.eu) || vm.admin) && <button type="button" className="btn btn-ghost" onClick={() => vm.cancelar(l.nome, l.codigo, d.id)}>Cancelar</button>}
                                </span>
                              </div>
                            </td>
                          );
                        }
                        if (atual) {
                          // com responsável: só pela transferência (com o aceite dos dois)
                          const outros = vm.opcoes[d.id].filter(n => !igual(n, atual));
                          return (
                            <td key={d.id}>
                              <div className="resp-atual">
                                <span>{atual}{!valor && <span className="hint"> (planilha)</span>}</span>
                                <MenuSuspenso rotulo="Transferir" icone="repeat" className="btn btn-outline resp-transferir" titulo={'Transferir para (' + d.rotulo + ')'} direita
                                  itens={outros.length ? outros.map(n => ({ rotulo: n, icone: 'usuario' as const, onClick: () => vm.transferir(l.nome, l.codigo, d.id, atual, n) }))
                                    : [{ rotulo: 'Ninguém mais no ' + d.rotulo, icone: 'usuario' as const, desabilitado: true, onClick: () => {} }]} />
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={d.id}>
                            <select className="select-compact dp-resp" value={valor} onChange={e => vm.definir(l.nome, l.codigo, d.id, e.target.value)}
                              aria-label={'Responsável ' + d.rotulo + ' de ' + l.nome}>
                              <option value="">{d.id === 'fiscal' && l.daPlanilha ? l.daPlanilha + ' (planilha)' : '—'}</option>
                              {opcoes.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
