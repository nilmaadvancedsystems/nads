// A entrada de quem ainda não foi liberado neste computador: pedir a liberação, esperar o admin e digitar o código.
import { Icone, MarcaN } from '@nads/ui';
import type { useLiberacao } from './useLiberacao';

export function LiberarComputador({ vm, nome, sair }: { vm: ReturnType<typeof useLiberacao>; nome: string; sair: () => void }) {
  const p = vm.pedido;
  return (
    <div id="login">
      <div className="auth">
        <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
        <h1 className="auth-title">Liberar este computador</h1>
        <div className="auth-box liberar-caixa">
          <p>Olá, <b>{nome}</b>. Para usar o nads fora dos computadores já liberados, um administrador precisa liberar este login.</p>
          {!p || p.status === 'recusado' ? (
            <>
              {p?.status === 'recusado' && <p className="liberar-erro"><Icone nome="alert" />O pedido anterior foi recusado{p.aprovadoPor ? ' por ' + p.aprovadoPor : ''}.</p>}
              <button type="button" className="btn btn-primary liberar-botao" disabled={vm.enviando} onClick={() => void vm.pedir()}>
                {vm.enviando ? 'Pedindo…' : 'Pedir liberação'}
              </button>
            </>
          ) : p.status === 'pendente' ? (
            <p className="liberar-espera"><span className="drive-girando" aria-hidden="true" />Pedido enviado. Um administrador vai ver na tela dele e te passar o código.</p>
          ) : (
            <form onSubmit={ev => { ev.preventDefault(); void vm.confirmar(); }}>
              <p>{p.aprovadoPor ? p.aprovadoPor + ' aprovou.' : 'Aprovado.'} Digite o código que ele te passou:</p>
              <input type="text" inputMode="numeric" autoFocus className="liberar-codigo" placeholder="000000" value={vm.codigo}
                onChange={ev => vm.setCodigo(ev.target.value)} aria-label="Código de 6 números" />
              {vm.erro && <p className="liberar-erro"><Icone nome="alert" />{vm.erro}</p>}
              <button type="submit" className="btn btn-primary liberar-botao" disabled={vm.enviando || vm.codigo.length !== 6}>{vm.enviando ? 'Conferindo…' : 'Entrar'}</button>
            </form>
          )}
        </div>
        <p className="hint" style={{ textAlign: 'center' }}><button type="button" className="btn btn-ghost btn-sm" onClick={sair}>Sair da conta</button></p>
      </div>
    </div>
  );
}
