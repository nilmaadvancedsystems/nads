// Senhas › Acesso (07/10/2026: a chave por pessoa, "como o WhatsApp"): os pedidos de acesso (Liberar / Recusar), quem tem
// acesso (Tirar o acesso: o cofre troca de chave) e o código de recuperação (gerar um novo).
import { Esqueleto, Icone, useCarregando } from '@nads/ui';
import { CofreFechado } from './CofreFechado';
import { useCofre } from './useCofre';

const quando = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export function AcessoAoCofre() {
  const vm = useCofre();
  useCarregando(vm.estado === 'carregando');
  if (vm.estado === 'carregando') return <Esqueleto linhas={6} />;
  if (vm.estado !== 'aberto') return <CofreFechado vm={vm} />;
  return (
    <section className="cofre-acesso">
      {vm.pedidos.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>Pedidos de acesso</h3><span className="badge badge-warn">{vm.pedidos.length}</span></div>
          <ul className="emp-pessoa-lista cofre-lista">
            {vm.pedidos.map(p => (
              <li key={p.id}>
                <Icone nome="usuario" />
                <span className="emp-pessoa-nome">{p.nome}</span>
                <span className="fraco">{quando(p.criadaEm)}</span>
                <span className="emp-pessoa-acoes">
                  <button type="button" className="btn btn-primary" disabled={vm.ocupado} onClick={() => void vm.liberar(p)}>Liberar</button>
                  <button type="button" className="btn" disabled={vm.ocupado} onClick={() => void vm.recusar(p)}>Recusar</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card">
        <div className="card-head"><h3>Com acesso</h3><span className="badge badge-neutral">{vm.comAcesso.length}</span></div>
        <ul className="emp-pessoa-lista cofre-lista">
          {vm.comAcesso.map(p => (
            <li key={p.id}>
              <Icone nome="lock" />
              <span className="emp-pessoa-nome">{p.nome}{p.id === vm.meuId && <span className="fraco"> (este computador)</span>}</span>
              <span className="fraco">{p.liberadoPor ? 'por ' + p.liberadoPor + ' em ' + quando(p.liberadoEm) : ''}</span>
              <span className="emp-pessoa-acoes">
                {p.id !== vm.meuId && <button type="button" className="btn btn-ghost" disabled={vm.ocupado} onClick={() => void vm.tirarAcesso(p)}>Tirar o acesso</button>}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <div className="card-head">
          <h3>Código de recuperação</h3>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" disabled={vm.ocupado} onClick={() => void vm.novoCodigo()}><Icone nome="repeat" />Gerar um novo</button>
        </div>
      </section>
    </section>
  );
}
