// Senhas › Acesso (07/10/2026: a chave por pessoa, "como o WhatsApp"; 13/10/2026: "consegue melhorar a ui do cofre"): o
// estado do cofre no topo, os pedidos de acesso em destaque (Liberar / Recusar), quem tem acesso em cartões com a foto
// (Tirar o acesso: o cofre troca de chave) e o código de recuperação (gerar um novo).
import { Esqueleto, Icone, useCarregando } from '@nads/ui';
import { FotoDaPessoa } from '../cadastro/responsaveis/FotoDaPessoa';
import { TelaDeBloqueio } from './TelaDeBloqueio';
import { useCofre } from './useCofre';

const quando = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const dia = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export function AcessoAoCofre() {
  const vm = useCofre();
  useCarregando(vm.estado === 'carregando');
  if (vm.estado === 'carregando') return <Esqueleto linhas={6} />;
  if (vm.estado !== 'aberto') return <TelaDeBloqueio vm={vm} />;
  const n = vm.comAcesso.length;
  return (
    <section className="cofre-acesso">
      <section className="card cofre-acesso-topo">
        <span className="cofre-acesso-selo" aria-hidden="true"><Icone nome="unlock" /></span>
        <span className="cofre-acesso-estado">
          <b>Cofre aberto neste computador</b>
          <span className="fraco">{n} {n === 1 ? 'pessoa tem' : 'pessoas têm'} acesso{vm.criadoPor ? ' · criado por ' + vm.criadoPor + ' em ' + dia(vm.criadoEm) : ''}</span>
        </span>
        {vm.pedidos.length > 0 && <span className="badge badge-warn">{vm.pedidos.length} {vm.pedidos.length === 1 ? 'pedido' : 'pedidos'}</span>}
      </section>

      {vm.pedidos.length > 0 && (
        <section className="card cofre-pedidos">
          <div className="card-head"><h3>Pedidos de acesso</h3><span className="badge badge-warn">{vm.pedidos.length}</span></div>
          <ul className="cofre-pedidos-lista">
            {vm.pedidos.map(p => {
              const f = vm.fotoDe(p.nome);
              return (
                <li key={p.id}>
                  <FotoDaPessoa foto={f.foto} iniciais={f.iniciais} />
                  <span className="cofre-pessoa-texto"><b>{p.nome}</b><span className="fraco">pediu em {quando(p.criadaEm)}</span></span>
                  <span className="cofre-pedidos-acoes">
                    <button type="button" className="btn btn-primary" disabled={vm.ocupado} onClick={() => void vm.liberar(p)}><Icone nome="check" />Liberar</button>
                    <button type="button" className="btn btn-outline" disabled={vm.ocupado} onClick={() => void vm.recusar(p)}>Recusar</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h3>Com acesso</h3><span className="badge badge-neutral">{n}</span></div>
        <ul className="cofre-pessoas">
          {vm.comAcesso.map(p => {
            const f = vm.fotoDe(p.nome);
            const eu = p.id === vm.meuId;
            return (
              <li key={p.id} className={'cofre-pessoa' + (eu ? ' eu' : '')}>
                <FotoDaPessoa foto={f.foto} iniciais={f.iniciais} />
                <span className="cofre-pessoa-texto">
                  <b>{p.nome}{eu && <span className="badge badge-ok">você</span>}</b>
                  <span className="fraco">{p.liberadoPor ? 'Liberado por ' + p.liberadoPor + ' em ' + dia(p.liberadoEm) : 'Com acesso'}</span>
                </span>
                {!eu && <button type="button" className="btn btn-ghost cofre-pessoa-tirar" disabled={vm.ocupado} onClick={() => void vm.tirarAcesso(p)}>Tirar o acesso</button>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card cofre-codigo">
        <span className="cofre-codigo-icone" aria-hidden="true"><Icone nome="lock" /></span>
        <span className="cofre-pessoa-texto">
          <b>Código de recuperação</b>
          <span className="fraco">Abre o cofre se todos perderem o acesso. Gere um novo se o impresso sumiu ou alguém de fora viu.</span>
        </span>
        <button type="button" className="btn btn-outline" disabled={vm.ocupado} onClick={() => void vm.novoCodigo()}><Icone nome="repeat" />Gerar um novo</button>
      </section>
    </section>
  );
}
