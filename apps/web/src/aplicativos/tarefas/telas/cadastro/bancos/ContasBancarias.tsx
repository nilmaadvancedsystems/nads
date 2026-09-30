// Cadastro › Contas bancárias: a barra de cima (empresa ▾, quantas contas, encerradas, "Nova conta ▾") e a lista.
// Empresa sem cadastro: o aviso com a lista que o Extrator usa hoje e "Confirmar esta lista".
import { Icone, LogoBanco, MenuSuspenso, useCarregando } from '@nads/ui';
import { useState } from 'react';
import { TrocarEmpresa } from '../partes/TrocarEmpresa';
import { FormConta, FormEncerrar } from './partes/FormConta';
import { useContasBancarias, type LinhaConta, type VmContasBancarias } from './useContasBancarias';

function AcoesDaConta({ vm, l, fechar }: { vm: VmContasBancarias; l: LinhaConta; fechar: () => void }) {
  const [modo, setModo] = useState<'menu' | 'editar' | 'encerrar'>('menu');
  if (modo === 'editar') return <FormConta vm={vm} id={l.id} inicial={l.dados} fechar={fechar} />;
  if (modo === 'encerrar') return <FormEncerrar vm={vm} id={l.id} fechar={fechar} />;
  return (
    <div role="menu">
      <button type="button" className="popover-item" role="menuitem" onClick={() => setModo('editar')}><Icone nome="settings" /><span className="popover-texto">Editar</span></button>
      {l.temFim
        ? <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); vm.reabrir(l.id); }}><Icone nome="repeat" /><span className="popover-texto">Reabrir</span></button>
        : <button type="button" className="popover-item" role="menuitem" onClick={() => setModo('encerrar')}><Icone nome="lock" /><span className="popover-texto">Encerrar…</span></button>}
      <hr className="popover-sep" />
      <button type="button" className="popover-item perigo" role="menuitem" onClick={() => { fechar(); void vm.excluir(l); }}><Icone nome="x" /><span className="popover-texto">Excluir</span></button>
    </div>
  );
}

export function ContasBancarias({ rota }: { rota: string }) {
  const vm = useContasBancarias(rota);
  useCarregando(vm.carregando);
  return (
    <section>
      <div className="tarefas-barra-topo">
        <TrocarEmpresa empresa={vm.empresa} rota={rota} pagina="bancos" />
        <span className="tarefas-contador"><Icone nome="landmark" /><b>{vm.total}</b> {vm.total === 1 ? 'conta' : 'contas'}</span>
        {vm.encerradas > 0 && (
          <button type="button" className="tarefas-contador" onClick={vm.alternarEncerradas} title={vm.verEncerradas ? 'Esconder as encerradas' : 'Mostrar as encerradas'}>
            <Icone nome="lock" /><b>{vm.encerradas}</b> {vm.encerradas === 1 ? 'encerrada' : 'encerradas'}{vm.verEncerradas ? ' (mostrando)' : ''}
          </button>
        )}
        <span className="tarefas-barra-espaco" />
        <MenuSuspenso icone="plus" rotulo="Nova conta" className="btn btn-primary" direita largura={400} titulo="Banco"
          conteudo={fechar => (vm.carregando ? <p className="empty">Carregando…</p> : <FormConta vm={vm} id={null} fechar={fechar} />)} />
      </div>

      {vm.semCadastro && (
        <div className="alert cad-aviso">
          <Icone nome="alert" />
          <div>
            <p className="alert-title">Esta empresa ainda não tem os bancos cadastrados</p>
            <p className="alert-text">
              {vm.linhas.length
                ? 'A lista abaixo é a que o Extrator usa hoje. Confira e confirme; incluir ou editar uma conta também já grava a lista.'
                : 'O Extrator mostra uma linha "Banco" só. Inclua as contas da empresa.'}
            </p>
            {!!vm.linhas.length && <button type="button" className="btn btn-outline btn-sm" onClick={vm.confirmarLista}>Confirmar esta lista</button>}
          </div>
        </div>
      )}

      {!vm.carregando && !vm.linhas.length ? (
        <div className="gh-blank">
          <Icone nome="landmark" />
          <h4>Nenhuma conta bancária</h4>
          <p>Use "Nova conta" para incluir as contas da empresa.</p>
        </div>
      ) : (
        <div className="table-wrap">
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
                    <MenuSuspenso rotulo="" icone="settings" className="btn btn-ghost btn-sm" dica="Editar, encerrar ou excluir" direita largura={400}
                      conteudo={fechar => <AcoesDaConta vm={vm} l={l} fechar={fechar} />} />
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
