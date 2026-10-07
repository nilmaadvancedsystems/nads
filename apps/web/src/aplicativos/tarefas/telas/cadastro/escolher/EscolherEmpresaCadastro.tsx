// Cadastro (/tarefas/cadastro/empresas): a lista de todas as empresas, com os bancos (do
// cadastro ou, sem cadastro, os que o robô já sabe) e o plano de contas. A busca e a situação filtram;
// clicar na linha abre a janela da empresa, por cima da lista.
import { Icone, Interruptor, LogoBanco, MenuSuspenso, useCarregando, useEntradaAnimada, useLinhasQueSeMovem } from '@nads/ui';
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
        <span className="tarefas-contador"><Icone nome="landmark" /><b>{vm.cadastradas}</b> com bancos cadastrados</span>
        {vm.robo.carregado && (
          <span className={'cad-robo' + (vm.robo.podeMudar ? '' : ' so-leitura')}
            title={vm.robo.podeMudar ? 'O robô lê a agência e a conta do cabeçalho dos extratos (Gmail e Drive)' : 'Só um administrador liga ou desliga'}>
            <Icone nome="zap" />Robô lê agência e conta
            <Interruptor ligado={vm.robo.ligado} onMudar={() => void vm.alternarRobo()} rotulo="Robô lê agência e conta" />
          </span>
        )}
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

      {!vm.carregando && !vm.linhas.length ? <p className="empty">Nenhuma empresa com isso.</p> : (
        <div ref={tabela} className="table-wrap">
          <table ref={linhasQueSeMovem} className="tabela-empresas cad-lista">
            <thead><tr><th>Código</th><th>Empresa</th><th>Bancos</th><th>Plano de contas</th><th>Atualizado</th></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(l => (
                <tr key={l.chave} data-linha={l.chave} data-empresa={l.codigo ?? undefined} className="linha-abre" tabIndex={0} title={'Abrir o cadastro de ' + l.nome}
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
