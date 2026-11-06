// Cadastro › empresa › Contas bancárias: a barra de cima (quantas contas, encerradas, "Nova conta") e a lista.
// Empresa sem cadastro: o aviso com a lista que o Extrator usa hoje e "Confirmar esta lista".
import { Alerta, Icone, LogoBanco, MenuSuspenso, useCarregando } from '@nads/ui';
import { useState } from 'react';
import { JanelaDaConta, type JanelaAberta } from './partes/JanelaDaConta';
import { useContasBancarias, type LinhaConta, type VmContasBancarias } from './useContasBancarias';

// o menu da engrenagem: Editar e Encerrar fecham o menu e abrem a janela do centro
function AcoesDaConta({ vm, l, fechar, abrir }: { vm: VmContasBancarias; l: LinhaConta; fechar: () => void; abrir: (j: JanelaAberta) => void }) {
  return (
    <div role="menu">
      <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); abrir({ modo: 'editar', linha: l }); }}><Icone nome="settings" /><span className="popover-texto">Editar</span></button>
      {l.temFim
        ? <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); vm.reabrir(l.id); }}><Icone nome="repeat" /><span className="popover-texto">Reabrir</span></button>
        : <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); abrir({ modo: 'encerrar', linha: l }); }}><Icone nome="lock" /><span className="popover-texto">Encerrar…</span></button>}
      <hr className="popover-sep" />
      <button type="button" className="popover-item perigo" role="menuitem" onClick={() => { fechar(); void vm.excluir(l); }}><Icone nome="x" /><span className="popover-texto">Excluir</span></button>
    </div>
  );
}

export function ContasBancarias({ rota }: { rota: string }) {
  const vm = useContasBancarias(rota);
  useCarregando(vm.carregando);
  // a janela do centro (incluir, editar ou encerrar); undefined = fechada
  const [janela, setJanela] = useState<JanelaAberta>();
  return (
    <section>
      <div className="tarefas-barra-topo">
        <span className="tarefas-contador"><Icone nome="landmark" /><b>{vm.total}</b> {vm.total === 1 ? 'conta' : 'contas'}</span>
        {vm.encerradas > 0 && (
          <button type="button" className="tarefas-contador" onClick={vm.alternarEncerradas} title={vm.verEncerradas ? 'Esconder as encerradas' : 'Mostrar as encerradas'}>
            <Icone nome="lock" /><b>{vm.encerradas}</b> {vm.encerradas === 1 ? 'encerrada' : 'encerradas'}{vm.verEncerradas ? ' (mostrando)' : ''}
          </button>
        )}
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-primary" onClick={() => setJanela({ modo: 'nova' })}><Icone nome="plus" />Nova conta</button>
      </div>
      {janela && <JanelaDaConta vm={vm} aberta={janela} fechar={() => setJanela(undefined)} />}

      {vm.semCadastro && (
        <Alerta naLinha className="cad-aviso" titulo="Esta empresa ainda não tem os bancos cadastrados"
          texto={vm.linhas.length
            ? 'A lista abaixo junta o que o Extrator usa hoje e o que o robô já sabe do cliente (ele aprende pelo Drive e pelos extratos). Confira e confirme; incluir ou editar uma conta também já grava a lista.'
            : 'O Extrator mostra uma linha "Banco" só. Inclua as contas da empresa.'}>
          {!!vm.linhas.length && <button type="button" className="btn btn-outline" onClick={vm.confirmarLista}>Confirmar esta lista</button>}
        </Alerta>
      )}

      {!vm.carregando && !vm.semCadastro && vm.sugestoes.length > 0 && (
        <div className="card cad-sugestoes">
          <div className="card-head">
            <h3>O robô já sabe</h3>
            {vm.sugestoes.some(s => s.comNumero) && vm.sugestoes.length > 1 && (
              <button type="button" className="btn btn-outline" onClick={vm.incluirTodas}>Incluir todas</button>
            )}
          </div>
          <ul className="cad-sugestoes-lista">
            {vm.sugestoes.map(s => (
              <li key={s.chave}>
                <span className="cad-banco">
                  <span className="add-banco-logo"><LogoBanco banco={s.marca} cor /></span>
                  <span><b>{s.nome}</b><span className="cad-apelido">{s.rotulo || 'o robô sabe só o banco'}</span></span>
                </span>
                <span className="tarefas-barra-espaco" />
                {s.comNumero ? (
                  <button type="button" className="btn btn-outline" onClick={() => vm.incluirSugestao(s)}>{s.tipo === 'completar' ? 'Completar' : 'Incluir'}</button>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={() => setJanela({ modo: 'nova', inicial: { marca: s.marca, agencia: '', conta: '', tipo: 'corrente' } })}>Incluir</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!vm.carregando && !vm.linhas.length ? (
        <div className="gh-blank">
          <Icone nome="landmark" />
          <h4>Nenhuma conta bancária</h4>
          <p>Use "Nova conta" para incluir as contas da empresa.</p>
        </div>
      ) : (
        <div className="table-wrap cad-tabela-wrap">
          {/* a caixa da tabela não corta o menu da engrenagem (Vitor, 09/10/2026: "não consigo alterar os dados do banco") */}
          <table className="cad-tabela">
            <thead><tr><th>Banco</th><th>Agência</th><th>Conta</th><th>Tipo</th><th>Conta contábil</th><th>Vigência</th><th /></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(l => (
                <tr key={l.id} className={l.encerrada ? 'cad-encerrada' : undefined}>
                  <td>
                    <span className="cad-banco">
                      <span className="add-banco-logo"><LogoBanco banco={l.marca} cor={!l.encerrada} /></span>
                      <span><b>{l.nome}</b>{l.apelido && <span className="cad-apelido">{l.apelido}</span>}</span>
                    </span>
                  </td>
                  <td className="num">{l.agencia || '—'}</td>
                  <td className="num">{l.conta || '—'}</td>
                  <td className="fraco">{l.tipo || '—'}</td>
                  <td>
                    {l.contaContabil
                      ? <span className="cad-conta"><b className="num">{l.contaContabil}</b>{l.nomeContabil && <span className="fraco">{l.nomeContabil}</span>}</span>
                      : <span className="fraco">—</span>}
                    {l.aviso && <span className="badge badge-bad cad-badge" title={l.aviso}>confira</span>}
                  </td>
                  <td className="fraco">{l.vigencia}{l.encerrada && <span className="badge badge-neutral cad-badge">encerrada</span>}</td>
                  <td className="cad-acoes">
                    <MenuSuspenso rotulo="" icone="settings" className="btn btn-ghost" dica="Editar, encerrar ou excluir" direita
                      conteudo={fechar => <AcoesDaConta vm={vm} l={l} fechar={fechar} abrir={setJanela} />} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
