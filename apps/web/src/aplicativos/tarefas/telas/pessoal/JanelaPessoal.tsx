// View da Minha página: uma janela grande por cima da tela, no desenho das Configurações do Notion (e do Entregas,
// que segue o Notion) — à esquerda a pessoa, a busca e os tópicos em grupos; à direita o tópico aberto, em cartões
// com cabeçalho e uma opção por linha (o rótulo e a explicação à esquerda, o controle à direita). Fecha no ×, no Esc e
// clicando fora.
import { Esqueleto, Icone, SeletorTema, useCarregando, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TopicoPessoal } from './contexto';
import { usePaginaPessoal, type VmPessoal } from './usePaginaPessoal';

const TOPICOS: { id: TopicoPessoal; rotulo: string; icone: NomeIcone; grupo: string; busca: string }[] = [
  { id: 'caixa', rotulo: 'Caixa de entrada', icone: 'caixaEntrada', grupo: '', busca: 'inbox pendências paradas envios claudio secretário liberação computador' },
  { id: 'conta', rotulo: 'Minha conta', icone: 'usuario', grupo: 'Conta', busca: 'foto perfil nome e-mail email setor sair senha' },
  { id: 'preferencias', rotulo: 'Aparência e telas', icone: 'settings', grupo: 'Preferências', busca: 'tema claro escuro início abrir tela' },
  { id: 'aplicativo', rotulo: 'Versão do sistema', icone: 'download', grupo: 'Aplicativo', busca: 'versão atualizar nova' },
];

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

function Foto({ foto, iniciais, grande }: { foto: string | null; iniciais: string; grande?: boolean }) {
  const classe = 'pessoal-foto' + (grande ? ' grande' : '');
  return foto ? <img className={classe} src={foto} alt="" /> : <span className={classe + ' pessoal-iniciais'} aria-hidden="true">{iniciais}</span>;
}

function CaixaDeEntrada({ vm, fechar }: { vm: VmPessoal; fechar: () => void }) {
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
                  {i.acoes.map(a => (
                    <button key={a.rotulo} type="button" className={'btn ' + (a.principal ? 'btn-primary' : 'btn-outline')}
                      onClick={() => { a.onClick(); if (a.fecha) fechar(); }}>{a.rotulo}</button>
                  ))}
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
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <>
      <Cartao titulo="Foto de perfil">
        <div className="pessoal-linha">
          <Foto foto={c.foto} iniciais={c.iniciais} grande />
          <div className="pessoal-linha-texto">
            <b>{c.nome}</b>
            <span className="fraco">Aparece no seu ícone, no canto do cabeçalho (e no Entregas: é a mesma conta).</span>
          </div>
          <div className="pessoal-linha-controle">
            <input ref={arquivo} type="file" accept="image/*" hidden
              onChange={ev => { const f = ev.target.files?.[0]; if (f) c.trocarFoto(f); ev.target.value = ''; }} />
            <button type="button" className="btn btn-outline" disabled={c.salvandoFoto} onClick={() => arquivo.current?.click()}>
              {c.salvandoFoto ? <span className="btn-spinner" /> : <Icone nome="upload" />}{c.foto ? 'Trocar foto' : 'Escolher foto'}
            </button>
            {c.foto && <button type="button" className="btn btn-outline" disabled={c.salvandoFoto} onClick={c.tirarFoto}>Remover</button>}
          </div>
        </div>
      </Cartao>
      <Cartao titulo="Conta">
        <Linha rotulo="Nome" dica="Como aparece nas tarefas e nos pedidos ao robô.">{c.nome}</Linha>
        <Linha rotulo="E-mail" dica="O login do Entregas (a mesma conta em todo o nads).">{c.email || '—'}</Linha>
        <Linha rotulo="Setor" dica="Quem muda é um administrador.">{c.setor}</Linha>
        <Linha rotulo="Nome e senha" dica="Mudam nas Configurações do Entregas (a mesma conta).">
          <a className="btn btn-outline" href={c.linkDoEntregas} target="_blank" rel="noreferrer">Abrir no Entregas</a>
        </Linha>
        <Linha rotulo={c.sair} dica="Sai deste navegador; para entrar de novo, o login do Entregas.">
          <button type="button" className="btn btn-outline btn-danger" onClick={c.fazerSair}><Icone nome="logOut" />{c.sair}</button>
        </Linha>
      </Cartao>
    </>
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

export function JanelaPessoal({ topico, mudar, fechar }: { topico: TopicoPessoal; mudar: (t: TopicoPessoal) => void; fechar: () => void }) {
  const vm = usePaginaPessoal();
  const [busca, setBusca] = useState('');
  // Esc fecha
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const q = busca.trim().toLowerCase();
  const visiveis = TOPICOS.filter(t => !q || (t.rotulo + ' ' + t.busca).toLowerCase().includes(q));
  const atual = TOPICOS.find(t => t.id === topico) || TOPICOS[0];
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pessoal-janela" role="dialog" aria-modal="true" aria-label="Minha página">
        <aside className="pessoal-lado">
          <div className="pessoal-quem">
            <Foto foto={vm.conta.foto} iniciais={vm.conta.iniciais} />
            <div className="pessoal-quem-texto"><b>{vm.conta.nome}</b><span className="fraco">{vm.conta.email || vm.conta.setor}</span></div>
          </div>
          <label className="busca-curta pessoal-busca">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar" aria-label="Buscar nas configurações" value={busca} onChange={e => setBusca(e.target.value)} />
          </label>
          <nav aria-label="Tópicos">
            {visiveis.map((t, i) => (
              <div key={t.id}>
                {t.grupo && t.grupo !== visiveis[i - 1]?.grupo && <p className="pessoal-grupo">{t.grupo}</p>}
                <button type="button" className={'pessoal-topico' + (t.id === topico ? ' ativo' : '')} aria-current={t.id === topico ? 'page' : undefined}
                  onClick={() => mudar(t.id)}>
                  <Icone nome={t.icone} />{t.rotulo}
                  {t.id === 'caixa' && vm.caixa.pedemAcao > 0 && <span className="gh-counter">{vm.caixa.pedemAcao}</span>}
                </button>
              </div>
            ))}
            {!visiveis.length && <p className="fraco pessoal-nada">Nada com "{busca}".</p>}
          </nav>
        </aside>
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <h2>{atual.rotulo}</h2>
            <button type="button" className="drawer-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" /></button>
          </header>
          <div className="pessoal-rola">
            {topico === 'conta' ? <MinhaConta vm={vm} />
              : topico === 'preferencias' ? <Preferencias vm={vm} />
                : topico === 'aplicativo' ? <Aplicativo vm={vm} />
                  : <CaixaDeEntrada vm={vm} fechar={fechar} />}
          </div>
        </section>
      </div>
    </div>
  );
}
