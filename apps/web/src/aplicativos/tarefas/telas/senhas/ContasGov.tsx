// Senhas › Contas gov.br (07/10/2026): as contas gov.br de pessoas (nome e nível), a busca e o Importar planilha (a
// prévia antes de gravar). Clicar abre a conta: o CPF, a senha (mostrar e copiar) e a observação.
import { cofre as c } from '@nads/core';
import { BotaoAcao, BotaoIcone, CampoArquivo, Esqueleto, Icone, useCarregando, useRetorno } from '@nads/ui';
import { Cartao, JanelaLateral, Linha } from '../janela/JanelaLateral';
import { CofreFechado } from './CofreFechado';
import { Senha } from './SegredosDaEmpresa';
import { useContasGov } from './useContasGov';

export function ContasGov() {
  const vm = useContasGov();
  const { toast } = useRetorno();
  useCarregando(vm.cofre.estado === 'carregando');
  if (vm.cofre.estado === 'carregando') return <Esqueleto linhas={8} />;
  const aberto = vm.cofre.estado === 'aberto';
  return (
    <section>
      {!aberto && <CofreFechado vm={vm.cofre} />}
      <div className="tarefas-barra-topo">
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder={'Buscar nas ' + vm.total} aria-label="Buscar pessoa" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        <span className="tarefas-barra-espaco" />
        {aberto && !vm.previa && <CampoArquivo id="planilha-senhas" arquivo={null} aceitar=".xlsx,.xls,.csv" onEscolher={f => void vm.escolherPlanilha(f)} />}
      </div>

      {vm.previa && (
        <section className="card cofre-previa">
          <div className="card-head">
            <h3>{vm.previa.arquivo}</h3>
            <span className="badge badge-neutral">{vm.previa.contas.length}</span>
            <span className="hint">{vm.previa.contas.filter(x => !x.existe).length} novas · {vm.previa.contas.filter(x => x.existe).length} atualizam{vm.previa.ignoradas ? ' · ' + vm.previa.ignoradas + ' sem CPF ou senha' : ''}</span>
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-outline" onClick={vm.cancelarPrevia}>Cancelar</button>
            <BotaoAcao carregando={vm.importando} textoCarregando="Guardando…" onClick={() => void vm.importar()}>Importar {vm.previa.contas.length}</BotaoAcao>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>CPF</th><th>Nível</th><th /></tr></thead>
              <tbody>
                {vm.previa.contas.map(x => (
                  <tr key={x.id}>
                    <td>{x.nome}</td><td className="num fraco">{c.cpfMascarado(x.cpf)}</td><td>{x.nivel || '—'}</td>
                    <td>{x.existe ? <span className="badge badge-neutral">Atualiza</span> : <span className="badge badge-ok">Nova</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!vm.previa && (
        vm.contas.length ? (
          <div className="table-wrap cofre-tabela">
            <table>
              <thead><tr><th>Nome</th><th>Nível</th><th>Atualizado</th></tr></thead>
              <tbody>
                {vm.contas.map(x => (
                  <tr key={x.id} className="dp-linha-abre" onClick={() => vm.abrir(x.id)}>
                    <td className="cofre-nome">{x.nome}</td>
                    <td>{x.nivel ? <span className="badge badge-neutral">{x.nivel}</span> : <span className="fraco">—</span>}</td>
                    <td className="fraco">{x.atualizadoPor}{x.atualizadoEm ? ' · ' + new Date(x.atualizadoEm).toLocaleDateString('pt-BR') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : aberto ? <div className="card gh-blank"><Icone nome="lock" /><h4>Nenhuma conta gov.br no cofre</h4></div> : null
      )}

      {vm.aberta && (
        <JanelaLateral rotulo={vm.aberta.nome} topicos={[{ id: 'gov', rotulo: 'gov.br', icone: 'usuario' }]} topico="gov" mudar={() => {}} fechar={vm.fechar} resumo={(
          <div className="usuario-quem"><b>{vm.aberta.nome}</b>{vm.aberta.nivel && <span className="badge badge-neutral">{vm.aberta.nivel}</span>}</div>
        )}>
          {!aberto ? <CofreFechado vm={vm.cofre} /> : !vm.conta ? <Esqueleto linhas={3} /> : (
            <Cartao titulo="gov.br">
              <Linha rotulo="CPF">
                <span className="cofre-senha">
                  <input type="text" className="pessoal-select" value={c.cpfFormatado(vm.conta.login)} onChange={e => vm.setConta({ ...vm.conta!, login: e.target.value.replace(/\D/g, '') })} aria-label="CPF" autoComplete="off" />
                  <BotaoIcone icone="copiar" titulo="Copiar" onClick={() => { void navigator.clipboard.writeText(vm.conta!.login).then(() => toast('Copiado.')); }} />
                </span>
              </Linha>
              <Linha rotulo="Senha"><Senha valor={vm.conta.senha} onMudar={v => vm.setConta({ ...vm.conta!, senha: v })} rotulo="Senha gov.br" /></Linha>
              <Linha rotulo="Observação">
                <input type="text" className="pessoal-select cofre-obs" value={vm.conta.obs || ''} onChange={e => vm.setConta({ ...vm.conta!, obs: e.target.value })} aria-label="Observação" />
              </Linha>
              <div className="cofre-salvar"><button type="button" className="btn btn-primary" disabled={vm.cofre.ocupado} onClick={() => void vm.salvarConta()}>Salvar</button></div>
            </Cartao>
          )}
        </JanelaLateral>
      )}
    </section>
  );
}
