// Cadastro (/tarefas/cadastro/empresas): a lista de todas as empresas, com os bancos (do
// cadastro ou, sem cadastro, os que o robô já sabe) e o plano de contas. A busca e a situação filtram;
// clicar na linha abre a janela da empresa, por cima da lista.
import { Icone, LogoBanco, MenuSuspenso, useCarregando, useEntradaAnimada, useLinhasQueSeMovem, Vazio } from '@nads/ui';
import { useState } from 'react';
import { JanelaNovaEmpresa } from './JanelaNovaEmpresa';
import { SITUACOES, useListaDoCadastro } from './useListaDoCadastro';

export function EscolherEmpresaCadastro() {
  // a Nova empresa (Vitor, 07/10/2026: "um cadastro de empresas sem o botão de cadastrar empresa")
  const [nova, setNova] = useState(false);
  const vm = useListaDoCadastro();
  useCarregando(vm.carregando);
  // as linhas chegam em cascata quando o banco responde
  // tela com muitas caixas (Vitor, 01/10/2026: "tudo que tiver muita box pode reduzir"): a lista inteira só acende rápido
  const tabela = useEntradaAnimada<HTMLDivElement>(null, [vm.carregando], 'repetida');
  // ordenou, filtrou, chegou ou saiu uma: as linhas deslizam até o lugar novo (a busca é teclado: vai sem animar)
  const linhasQueSeMovem = useLinhasQueSeMovem<HTMLTableElement>(vm.carregando ? '' : vm.linhas.map(l => l.chave).join('|'), vm.busca);
  return (
    <section>
      {nova && <JanelaNovaEmpresa fechar={() => setNova(false)} />}
      <div className="tarefas-barra-topo">
        <span className="tarefas-contador"><Icone nome="briefcase" /><b>{vm.total}</b> empresas</span>
        {/* o que falta (13/10/2026): clicar filtra as incompletas; o robô que lê agência e conta foi para Robôs e agentes */}
        <button type="button" className={'tarefas-contador cad-contador-botao' + (vm.situacao === 'incompletos' ? ' ativo' : '')}
          onClick={() => vm.setSituacao(vm.situacao === 'incompletos' ? '' : 'incompletos')} title="Mostrar só as empresas com o cadastro incompleto">
          <Icone nome="alert" /><b>{vm.incompletas}</b> com o cadastro incompleto
        </button>
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" autoFocus placeholder="Buscar empresa" aria-label="Buscar empresa (nome ou código)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <MenuSuspenso rotulo={vm.rotuloSituacao} titulo="Situação" direita className={'btn btn-outline' + (vm.situacao ? ' ativo' : '')}
          itens={[{ rotulo: 'Todas', marcado: !vm.situacao, onClick: () => vm.setSituacao('') },
            ...SITUACOES.map(s => ({ rotulo: s.rotulo, marcado: s.valor === vm.situacao, onClick: () => vm.setSituacao(s.valor) }))]} />
        <button type="button" className="btn btn-primary" onClick={() => setNova(true)}><Icone nome="plus" />Nova empresa</button>
      </div>

      {!vm.carregando && !vm.linhas.length ? <Vazio icone="search" titulo="Nenhuma empresa com isso">
        {/* a saída do vazio (revisão da UI, 18/10/2026) */}
        {(vm.busca || vm.situacao) && <button type="button" className="btn btn-outline" onClick={() => { vm.setBusca(''); vm.setSituacao(''); }}>Limpar a busca e a situação</button>}
      </Vazio> : (
        <div ref={tabela} className="table-wrap">
          <table ref={linhasQueSeMovem} className="tabela-empresas cad-lista">
            <thead><tr><th>Código</th><th>Empresa</th><th>Cadastro</th><th>Bancos</th><th>Atualizado</th></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(l => (
                <tr key={l.chave} data-linha={l.chave} data-empresa={l.codigo ?? undefined} className="linha-abre" tabIndex={0} title={'Abrir o cadastro de ' + l.nome}
                  onClick={() => vm.abrir(l.rota)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(l.rota); }}>
                  <td className="num">{l.codigo ?? '—'}</td>
                  <td><span className="cad-empresa-nome">{l.nome}</span>{l.regime && <span className="badge badge-neutral cad-regime">{l.regime}</span>}</td>
                  <td>
                    <span className="cad-completo" title={l.completos === l.itens.length ? 'Cadastro completo' : 'Falta: ' + l.itens.filter(i => !i.tem).map(i => i.rotulo).join(', ')}>
                      {l.itens.map(i => <i key={i.id} className={i.tem ? 'tem' : undefined} aria-hidden="true" />)}
                      <span className="fraco">{l.completos}/{l.itens.length}</span>
                    </span>
                  </td>
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
