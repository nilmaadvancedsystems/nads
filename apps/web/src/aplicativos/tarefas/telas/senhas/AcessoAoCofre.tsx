// Senhas › Acesso (07/10/2026: a chave por pessoa, "como o WhatsApp"; 13/10/2026: "consegue melhorar a ui do cofre"): o
// estado do cofre no topo, os pedidos de acesso em destaque (Liberar / Recusar), quem tem acesso em cartões com a foto
// (Tirar o acesso: o cofre troca de chave) e o código de recuperação (gerar um novo).
import { Esqueleto, Icone, useCarregando } from '@nads/ui';
import { useState } from 'react';
import { FotoDaPessoa } from '../cadastro/responsaveis/FotoDaPessoa';
import { TelaDeBloqueio } from './TelaDeBloqueio';
import { useCofre } from './useCofre';

const quando = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
/** de onde o login entrou por último: o navegador, o IP, a cidade do IP e quando (26/10/2026: "quero que apareça o IP", e
 *  "a localização de cidade") */
const deOnde = (a?: { em: string; ip: string; cidade?: string; navegador: string }, desde = 'último acesso') =>
  (a ? [a.navegador, 'IP ' + (a.ip || 'não informado'), ...(a.cidade ? [a.cidade] : []), desde + ' ' + quando(a.em)].join(' · ') : 'Sem acesso registrado ainda (aparece na próxima vez que o cofre abrir nele)');
const dia = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export function AcessoAoCofre() {
  const vm = useCofre();
  const [aberto, setAberto] = useState<string | null>(null);
  useCarregando(vm.estado === 'carregando');
  if (vm.estado === 'carregando') return <Esqueleto linhas={6} />;
  if (vm.estado !== 'aberto') return <TelaDeBloqueio vm={vm} />;
  const n = vm.comAcesso.length;
  // um cartão por usuário; clicar mostra os logins ativos dele (13/10/2026: "podia ser por usuário, aí eu clicava e aparecia os logins ativos")
  const porUsuario = new Map<string, { chave: string; nome: string; logins: typeof vm.comAcesso }>();
  for (const p of vm.comAcesso) {
    const k = p.nome.trim().toLowerCase();
    const u = porUsuario.get(k) || { chave: k, nome: p.nome, logins: [] };
    u.logins = [...u.logins, p];
    porUsuario.set(k, u);
  }
  const usuarios = [...porUsuario.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const doAberto = usuarios.find(u => u.chave === aberto) || null;
  return (
    <section className="cofre-acesso">
      <section className="card cofre-acesso-topo">
        <span className="cofre-acesso-selo" aria-hidden="true"><Icone nome="unlock" /></span>
        <span className="cofre-acesso-estado">
          <b>Cofre aberto neste computador</b>
          <span className="fraco">{usuarios.length} {usuarios.length === 1 ? 'pessoa tem' : 'pessoas têm'} acesso · {n} {n === 1 ? 'login' : 'logins'}{vm.criadoPor ? ' · criado por ' + vm.criadoPor + ' em ' + dia(vm.criadoEm) : ''}</span>
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
                  <span className="cofre-pessoa-texto"><b>{p.nome}</b><span className="fraco">pediu em {quando(p.criadaEm)}</span>{p.ultimoAcesso && <span className="fraco">{deOnde(p.ultimoAcesso, 'pedido em')}</span>}</span>
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
        <div className="card-head"><h3>Com acesso</h3><span className="badge badge-neutral">{usuarios.length}</span></div>
        <ul className="cofre-pessoas">
          {usuarios.map(u => {
            const f = vm.fotoDe(u.nome);
            const eu = u.logins.some(p => p.id === vm.meuId);
            const ultimo = u.logins.reduce((a, p) => ((p.liberadoEm || '') > (a.liberadoEm || '') ? p : a), u.logins[0]);
            return (
              <li key={u.chave}>
                <button type="button" className={'cofre-pessoa' + (eu ? ' eu' : '') + (aberto === u.chave ? ' ativa' : '')} aria-expanded={aberto === u.chave} onClick={() => setAberto(a => (a === u.chave ? null : u.chave))}>
                  <FotoDaPessoa foto={f.foto} iniciais={f.iniciais} />
                  <span className="cofre-pessoa-texto">
                    <b>{u.nome}{eu && <span className="badge badge-ok">você</span>}</b>
                    <span className="fraco">{u.logins.length} {u.logins.length === 1 ? 'login ativo' : 'logins ativos'} · desde {dia(ultimo.liberadoEm)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {doAberto && (
          <div className="cofre-logins">
            <div className="cofre-logins-titulo"><b>Logins ativos de {doAberto.nome}</b><span className="fraco">cada login é um navegador com a chave do cofre</span></div>
            <ul>
              {doAberto.logins.map((p, i) => {
                const eu = p.id === vm.meuId;
                return (
                  <li key={p.id}>
                    <span className="cofre-login-icone" aria-hidden="true"><Icone nome="monitor" /></span>
                    <span className="cofre-pessoa-texto">
                      <b>{eu ? 'Este computador' : 'Login ' + (i + 1)}</b>
                      <span className="fraco">Liberado por {p.liberadoPor || '—'} em {quando(p.liberadoEm)}</span>
                      <span className="fraco">{deOnde(p.ultimoAcesso)}</span>
                    </span>
                    {!eu && <button type="button" className="btn btn-ghost cofre-pessoa-tirar" disabled={vm.ocupado} onClick={() => void vm.tirarAcesso(p)}>Tirar o acesso</button>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="card cofre-codigo">
        <span className="cofre-codigo-icone" aria-hidden="true"><Icone nome="lock" /></span>
        <span className="cofre-pessoa-texto">
          <b>Código de recuperação</b>
          <span className="fraco">Abre o cofre se todos perderem o acesso. Tirar um acesso não muda o código. Gere um novo se o impresso sumiu; resete a chave e o código se alguém que saiu pode ter guardado o código ou a chave.</span>
        </span>
        <span className="cofre-codigo-botoes">
          <button type="button" className="btn btn-outline" disabled={vm.ocupado} onClick={() => void vm.novoCodigo()}><Icone nome="repeat" />Gerar um novo</button>
          <button type="button" className="btn btn-outline" disabled={vm.ocupado} onClick={() => void vm.resetarTudo()}><Icone nome="lock" />Resetar a chave e o código</button>
        </span>
      </section>
    </section>
  );
}
