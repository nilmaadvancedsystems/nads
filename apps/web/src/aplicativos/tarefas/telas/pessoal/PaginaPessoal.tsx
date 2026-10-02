// View da Minha página (a página pessoal): o desenho das Configurações do Entregas — cartões com cabeçalho e uma
// opção por linha (o rótulo e a explicação à esquerda, o controle à direita). Cada tópico da lateral é uma parte.
import { Esqueleto, Icone, SeletorTema, useCarregando } from '@nads/ui';
import type { ReactNode } from 'react';
import { usePaginaPessoal, type VmPessoal } from './usePaginaPessoal';

/** Uma opção: o rótulo e a explicação à esquerda, o controle (ou o valor) à direita. */
function Linha({ rotulo, dica, children }: { rotulo: string; dica?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pessoal-linha">
      <div className="pessoal-linha-texto">
        <b>{rotulo}</b>
        {dica && <span className="fraco">{dica}</span>}
      </div>
      {children != null && <div className="pessoal-linha-controle">{children}</div>}
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="card pessoal-cartao">
      <div className="card-head"><h3>{titulo}</h3></div>
      {children}
    </section>
  );
}

function CaixaDeEntrada({ vm }: { vm: VmPessoal }) {
  const c = vm.caixa;
  useCarregando(c.carregando);
  return (
    <>
      <div className="chip-row pessoal-filtros">
        <button type="button" className={'chip-f' + (c.filtro === 'tudo' ? ' on' : '')} onClick={() => c.setFiltro('tudo')}>Tudo <span className="gh-counter">{c.total}</span></button>
        <button type="button" className={'chip-f' + (c.filtro === 'acao' ? ' on' : '')} onClick={() => c.setFiltro('acao')}>Pede ação <span className="gh-counter">{c.pedemAcao}</span></button>
      </div>
      {c.carregando ? <Esqueleto linhas={4} /> : !c.itens.length ? (
        <div className="card gh-blank">
          <Icone nome="caixaEntrada" />
          <h4>{c.filtro === 'acao' ? 'Nada pedindo ação' : 'Caixa de entrada vazia'}</h4>
          <p>Aqui aparecem as etapas que você parou, os arquivos que mandou ao Claudio Secretário{vm.conta.admin ? ' e os pedidos de liberação de computador' : ''}.</p>
        </div>
      ) : (
        <ul className="card pessoal-caixa">
          {c.itens.map(i => (
            <li key={i.id} className={'pessoal-item tom-' + i.tom}>
              <span className="pessoal-item-icone" aria-hidden="true"><Icone nome={i.icone} /></span>
              <div className="pessoal-item-texto">
                <b>{i.titulo}</b>
                <span className="fraco">{i.texto}</span>
              </div>
              <span className="pessoal-item-quando fraco">{i.quando}</span>
              {i.acoes.length > 0 && (
                <span className="pessoal-item-acoes">
                  {i.acoes.map(a => <button key={a.rotulo} type="button" className={'btn ' + (a.principal ? 'btn-primary' : 'btn-outline')} onClick={a.onClick}>{a.rotulo}</button>)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function MinhaConta({ vm }: { vm: VmPessoal }) {
  const c = vm.conta;
  return (
    <>
      <section className="card pessoal-perfil">
        {c.foto ? <img className="pessoal-foto" src={c.foto} alt="" /> : <span className="pessoal-foto pessoal-iniciais" aria-hidden="true">{c.iniciais}</span>}
        <div>
          <h2>{c.nome}</h2>
          <p className="fraco">{c.cargo}{c.admin ? ' · administrador' : ''}</p>
        </div>
      </section>
      <Cartao titulo="Conta">
        <Linha rotulo="Nome" dica="Como aparece nas tarefas e nos pedidos ao robô.">{c.nome}</Linha>
        <Linha rotulo="E-mail" dica="O login do Entregas (a mesma conta em todo o nads).">{c.email || '—'}</Linha>
        <Linha rotulo="Setor e cargo" dica="Quem muda é um administrador, em Cadastro › Usuários.">{c.cargo}</Linha>
        {c.papeis.length > 0 && <Linha rotulo="Papéis" dica="O que a conta pode fazer.">{c.papeis.join(', ')}</Linha>}
        <Linha rotulo="Foto, nome e senha" dica="Mudam nas Configurações do Entregas (a mesma conta).">
          <a className="btn btn-outline" href={c.linkDoEntregas} target="_blank" rel="noreferrer">Abrir no Entregas</a>
        </Linha>
      </Cartao>
      <Cartao titulo="Sessão">
        <Linha rotulo={c.sair} dica="Sai deste navegador; para entrar de novo, o login do Entregas.">
          <button type="button" className="btn btn-outline btn-danger" onClick={c.fazerSair}><Icone nome="logOut" />{c.sair}</button>
        </Linha>
      </Cartao>
    </>
  );
}

function EsteComputador({ vm }: { vm: VmPessoal }) {
  const c = vm.computador;
  if (c.carregando) return <Esqueleto linhas={3} />;
  return (
    <Cartao titulo="Liberação">
      <Linha rotulo="Proteção do login" dica="Com ela ligada, cada computador novo precisa do código de um administrador.">{c.protecao ? 'Ligada' : 'Desligada'}</Linha>
      <Linha rotulo="Este computador" dica={c.admin ? 'Administrador não precisa de liberação.' : c.protecao ? 'Este login, neste navegador.' : 'Sem a proteção, todo login entra.'}>
        <span className={'badge ' + (c.liberado ? 'badge-ok' : 'badge-pendente')}>{c.liberado ? 'Liberado' : 'Não liberado'}</span>
      </Linha>
      {c.pedido && <Linha rotulo="Último pedido" dica={c.pedido.computador + ' · ' + c.pedido.quando}>{c.pedido.situacao}</Linha>}
      {c.admin && (
        <Linha rotulo="Computadores da equipe" dica="Os computadores liberados de cada pessoa e revogar.">
          <button type="button" className="btn btn-outline" onClick={c.irParaUsuarios}>Abrir Usuários</button>
        </Linha>
      )}
    </Cartao>
  );
}

function Preferencias({ vm }: { vm: VmPessoal }) {
  const p = vm.preferencias;
  return (
    <>
      <Cartao titulo="Aparência">
        <Linha rotulo="Tema" dica="Claro, escuro ou o do computador. Vale para todo o nads neste navegador."><SeletorTema /></Linha>
      </Cartao>
      <Cartao titulo="Telas">
        <Linha rotulo="Onde a Tarefas abre" dica="A primeira tela ao entrar (neste navegador).">
          <select className="pessoal-select" value={p.inicio} onChange={ev => p.mudarInicio(ev.target.value)} aria-label="Onde a Tarefas abre">
            {p.inicios.map(i => <option key={i.valor} value={i.valor}>{i.rotulo}</option>)}
          </select>
        </Linha>
      </Cartao>
    </>
  );
}

function Aplicativo({ vm }: { vm: VmPessoal }) {
  const a = vm.aplicativo;
  return (
    <Cartao titulo="Atualização">
      <Linha rotulo="Versão" dica="Uma versão só para o nads inteiro.">{a.versao}</Linha>
      <Linha rotulo="Versão nova" dica={a.versaoNova ? 'Saiu a ' + a.versaoNova + '. Atualizar não perde o que está na tela.' : 'Você está na mais nova.'}>
        {a.versaoNova ? <button type="button" className="btn btn-primary" onClick={a.atualizar}><Icone nome="repeat" />Atualizar</button> : <span className="badge badge-ok">Em dia</span>}
      </Linha>
    </Cartao>
  );
}

export function PaginaPessoal({ pagina }: { pagina: string }) {
  const vm = usePaginaPessoal();
  return (
    <div className="pessoal">
      {pagina === 'conta' ? <MinhaConta vm={vm} />
        : pagina === 'computador' ? <EsteComputador vm={vm} />
          : pagina === 'preferencias' ? <Preferencias vm={vm} />
            : pagina === 'aplicativo' ? <Aplicativo vm={vm} />
              : <CaixaDeEntrada vm={vm} />}
    </div>
  );
}
