// Etapa 1 do Creditor: a competência. Ao abrir, o relatório de liquidação vem da pasta da empresa no
// Drive (pelo Entregas); sem o Drive, segue para anexar à mão.
import { Alerta, Icone } from '@nads/ui';
import { useCompetencia } from './useCompetencia';

export function Competencia() {
  const vm = useCompetencia();
  const d = vm.drive;
  return (
    <section>
      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="calendar" /></span>Competência</h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="fCompetencia">Mês da conciliação</label>
            <input type="month" id="fCompetencia" value={vm.mes} onChange={e => vm.setMes(e.target.value)} />
          </div>
        </div>
        <p className="hint">{vm.valida ? 'Conciliação de ' + vm.porExtenso + '. ' : ''}O relatório de liquidação é buscado em <b>{vm.caminho}</b>.</p>
        {vm.origemCarregada && <p className="hint">Já carregado: {vm.origemCarregada}.</p>}
      </div>

      {/* acoplado no Entregas e logado lá: nada a mostrar, o Drive já está pronto */}
      {!d.exemplos && !(d.loginDeFora && d.entrou) && (
        <div className="card">
          <h3><span className="import-card-ico"><Icone nome="fileDown" /></span>Drive do escritório</h3>
          {!d.pronto ? <p className="hint">Conectando ao Entregas…</p> : d.loginDeFora ? (
            <p className="hint">Entre no Entregas para buscar o relatório no Drive.</p>
          ) : d.entrou ? (
            <p className="hint">Conectado como <b>{d.quem}</b>. <button className="btn btn-ghost btn-sm" type="button" onClick={d.sair}>Sair</button></p>
          ) : (
            <form onSubmit={e => { e.preventDefault(); void d.entrar(); }}>
              <p className="hint" style={{ marginTop: 0 }}>Entre com o mesmo usuário do app Pendências (Entregas). Precisa ser do contábil.</p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="fDriveUsuario">Usuário</label>
                  <input id="fDriveUsuario" autoComplete="username" value={d.login.usuario} onChange={e => d.setLogin({ ...d.login, usuario: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="fDriveSenha">Senha</label>
                  <input id="fDriveSenha" type="password" autoComplete="current-password" value={d.login.senha} onChange={e => d.setLogin({ ...d.login, senha: e.target.value })} />
                </div>
              </div>
              <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                <button className="btn btn-outline" type="submit" disabled={d.entrando || !d.login.usuario || !d.login.senha}>{d.entrando ? 'Entrando…' : 'Entrar'}</button>
              </div>
              {d.erroLogin && <p className="hint" style={{ color: 'var(--danger)' }}>{d.erroLogin}</p>}
            </form>
          )}
        </div>
      )}

      {vm.busca.ocupado && <p className="hint"><span className="btn-spinner" /> {vm.busca.texto}</p>}
      {vm.busca.fase === 'problema' && (
        <Alerta titulo="O relatório não veio do Drive" texto={vm.busca.texto}>
          {vm.busca.candidatos.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>Arquivo em RECEBIMENTO DE CLIENTES</th><th>Modificado</th><th /></tr></thead>
                <tbody>
                  {vm.busca.candidatos.map(a => (
                    <tr key={a.id}>
                      <td>{a.caminho}{a.daCompetencia && <> <span className="badge badge-ok">{vm.mes.slice(5) + '/' + vm.mes.slice(0, 4)}</span></>}</td>
                      <td>{a.modificado ? new Date(a.modificado).toLocaleDateString('pt-BR') : '—'}</td>
                      <td><button className="btn btn-outline btn-sm" type="button" onClick={() => vm.usar(a)}>Usar este</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={vm.anexarAMao}>Anexar à mão →</button>
          </div>
        </Alerta>
      )}

      <div className="btn-row">
        <button className="btn btn-primary" type="button" disabled={!vm.podeAbrir} onClick={vm.abrir}>{vm.rotuloAbrir}</button>
      </div>
    </section>
  );
}
