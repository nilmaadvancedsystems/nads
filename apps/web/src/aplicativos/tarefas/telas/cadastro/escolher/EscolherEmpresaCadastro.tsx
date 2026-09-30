// Cadastro sem empresa aberta (/tarefas/cadastro/<página>): a lista de todas as empresas, com os bancos (do
// cadastro ou, sem cadastro, os que o robô já sabe) e o plano de contas. A busca e a situação filtram;
// clicar na linha abre a empresa na página pedida.
import { Icone, LogoBanco, MenuSuspenso, useCarregando } from '@nads/ui';
import { SITUACOES, useListaDoCadastro } from './useListaDoCadastro';

export function EscolherEmpresaCadastro({ pagina }: { pagina: string }) {
  const vm = useListaDoCadastro(pagina);
  useCarregando(vm.carregando);
  return (
    <section>
      <div className="tarefas-barra-topo">
        <span className="tarefas-contador"><Icone nome="briefcase" /><b>{vm.total}</b> empresas</span>
        <span className="tarefas-contador"><Icone nome="landmark" /><b>{vm.cadastradas}</b> com bancos cadastrados</span>
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" autoFocus placeholder="Buscar empresa" aria-label="Buscar empresa (nome ou código)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <MenuSuspenso rotulo={vm.rotuloSituacao} titulo="Situação" direita className={'btn btn-outline' + (vm.situacao ? ' ativo' : '')}
          itens={[{ rotulo: 'Todas', marcado: !vm.situacao, onClick: () => vm.setSituacao('') },
            ...SITUACOES.map(s => ({ rotulo: s.rotulo, marcado: s.valor === vm.situacao, onClick: () => vm.setSituacao(s.valor) }))]} />
      </div>

      {!vm.carregando && !vm.linhas.length ? <p className="empty">Nenhuma empresa com isso.</p> : (
        <div className="table-wrap">
          <table className="tabela-empresas cad-lista">
            <thead><tr><th>Código</th><th>Empresa</th><th>Bancos</th><th>Plano de contas</th><th>Atualizado</th></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(l => (
                <tr key={l.chave} className="linha-abre" tabIndex={0} title={'Abrir o cadastro de ' + l.nome}
                  onClick={() => vm.abrir(l.rota)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(l.rota); }}>
                  <td className="num">{l.codigo ?? '—'}</td>
                  <td><span className="cad-conta"><span>{l.nome}</span><span className="fraco">{l.regime}</span></span></td>
                  <td>
                    {l.bancos.length ? (
                      <span className={'cad-bancos-da-linha' + (l.origem === 'robo' ? ' do-robo' : '')}>
                        {l.bancos.map((b, i) => (
                          <span key={b.marca + i} className="cad-banco-mini" title={b.nome + (b.rotulo ? ' · ' + b.rotulo : '')}>
                            <span className="add-banco-logo"><LogoBanco banco={b.marca} cor={l.origem === 'cadastro'} /></span>{b.nome}
                          </span>
                        ))}
                        {l.origem === 'robo' && <span className="badge badge-neutral cad-badge" title="O robô achou pelo Drive e pelos extratos; ainda não confirmado no Cadastro">pelo robô</span>}
                      </span>
                    ) : <span className="fraco">—</span>}
                  </td>
                  <td className="fraco">{l.plano != null ? l.plano.toLocaleString('pt-BR') + ' contas' : '—'}</td>
                  <td className="fraco num">{l.atualizado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
