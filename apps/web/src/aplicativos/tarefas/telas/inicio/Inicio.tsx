// O Início da Tarefas (27/10/2026): à esquerda, o mural de avisos do escritório (o admin e o diretor escrevem no pé dele,
// fixam e apagam); à direita, a última empresa em que a pessoa mexeu, com o progresso dela e o botão de continuar, e o
// progresso das empresas dela no mês. Só as peças do catálogo (cartão, vazio, campo, barra de progresso, bolinha de
// situação, botões); nada anima.
import { Esqueleto, Icone, useCarregando, Vazio } from '@nads/ui';
import { useInicio } from './useInicio';

type Vm = ReturnType<typeof useInicio>;

function Mural({ vm }: { vm: Vm }) {
  return (
    <div className="card">
      <div className="card-head"><h3>Avisos do escritório</h3></div>
      {vm.carregandoAvisos ? <Esqueleto linhas={3} /> : vm.avisos.length === 0 ? (
        <Vazio compacto icone="alert" texto={vm.escreve ? 'Nenhum aviso. Escreva o primeiro aqui embaixo.' : 'Nenhum aviso do escritório por enquanto.'} />
      ) : (
        <ul className="mural-lista">
          {vm.avisos.map(a => (
            <li key={a.id} className="mural-aviso">
              <div className="mural-aviso-corpo">
                <p className="mural-aviso-texto">{a.texto}</p>
                <p className="hint" title={a.quandoCompleto}>{a.fixado && <><Icone nome="mapaPin" width={12} height={12} /> Fixado · </>}{a.por} · {a.quando}</p>
              </div>
              {vm.escreve && (
                <>
                  <button type="button" className="icon-btn" title={a.fixado ? 'Soltar do alto' : 'Fixar no alto'} aria-pressed={!!a.fixado} onClick={() => void vm.fixar(a.id, !a.fixado)}>
                    <Icone nome="mapaPin" width={16} height={16} />
                  </button>
                  <button type="button" className="icon-btn" title="Apagar o aviso" onClick={() => void vm.apagar(a.id)}>
                    <Icone nome="lixeira" width={16} height={16} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {vm.escreve && (
        <div className="mural-novo">
          <div className="field">
            <label htmlFor="mural-novo-texto">Novo aviso</label>
            <textarea id="mural-novo-texto" value={vm.texto} onChange={e => vm.setTexto(e.target.value)} placeholder="Escreva o aviso para todo o escritório"
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.publicar(); } }} />
          </div>
          <div className="mural-novo-pe">
            {vm.faltam < 100 && <span className={'hint' + (vm.faltam < 0 ? ' cor-entrada' : '')}>{vm.faltam} caracteres</span>}
            <button type="button" className="btn btn-primary" disabled={!vm.podePublicar} onClick={() => void vm.publicar()}>
              <Icone nome="envelope" width={16} height={16} />{vm.publicando ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UltimaEmpresa({ vm }: { vm: Vm }) {
  const u = vm.ultima;
  return (
    <div className="card">
      <div className="card-head"><h3>Última empresa</h3></div>
      {vm.carregando ? <Esqueleto linhas={2} /> : !u ? (
        <Vazio compacto icone="briefcase" texto={'Você ainda não mexeu em nenhuma empresa em ' + vm.rotuloCompetencia + '.'} />
      ) : (
        <div className="ultima-empresa">
          <p className="ultima-empresa-nome">{u.codigo != null && <>{u.codigo} · </>}{u.nome}</p>
          <p className="hint"><span className={'bolinha-sit ' + u.situacao} />{u.rotuloSituacao}{u.etapaAtual && <> · {u.etapaAtual}</>} · você mexeu {u.quando}</p>
          <div className="progresso-linha">
            <span className="tarefas-barra larga" role="progressbar" aria-valuemin={0} aria-valuemax={u.total} aria-valuenow={u.concluidas} aria-label="Etapas feitas">
              <span style={{ width: u.porcentagem + '%' }} />
            </span>
            <span className="num">{u.concluidas} de {u.total}</span>
          </div>
          <div>
            <button type="button" className={'btn ' + (u.situacao === 'concluida' ? 'btn-outline' : 'btn-primary')} onClick={u.abrir}>
              <Icone nome="play" width={16} height={16} />{u.acao}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MeuMes({ vm }: { vm: Vm }) {
  const r = vm.resumo;
  return (
    <div className="card">
      <div className="card-head"><h3>Suas empresas em {vm.rotuloCompetencia}</h3></div>
      {vm.carregando ? <Esqueleto linhas={2} /> : (
        <div className="ultima-empresa">
          <div className="progresso-linha">
            <span className="tarefas-barra larga" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.porcentagem} aria-label="Progresso do mês">
              <span style={{ width: r.porcentagem + '%' }} />
            </span>
            <span className="num">{r.porcentagem}%</span>
          </div>
          <p className="hint">
            {r.porSituacao.concluida} de {r.empresas} concluídas · {r.porSituacao['em-andamento']} em andamento · {r.porSituacao.parada} paradas · {r.porSituacao['nao-iniciada']} não iniciadas
          </p>
          <div><button type="button" className="btn btn-outline" onClick={vm.verEmpresas}><Icone nome="list" width={16} height={16} />Ver as empresas</button></div>
        </div>
      )}
    </div>
  );
}

export function Inicio() {
  const vm = useInicio();
  useCarregando(vm.carregando || vm.carregandoAvisos);
  return (
    <section>
      <p className="hint" style={{ marginBottom: 16 }}>Olá, {vm.nome}.</p>
      <div className="inicio-grade">
        <Mural vm={vm} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <UltimaEmpresa vm={vm} />
          {vm.temRotina && <MeuMes vm={vm} />}
        </div>
      </div>
    </section>
  );
}
