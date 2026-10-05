// View da Minha página: uma janela grande por cima da tela, no desenho das Configurações do Notion (e do Entregas,
// que segue o Notion) — à esquerda a pessoa, a busca e os tópicos em grupos; à direita o tópico aberto, em cartões
// com cabeçalho e uma opção por linha (o rótulo e a explicação à esquerda, o controle à direita). Fecha no ×, no Esc e
// clicando fora.
import { Icone, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TopicoPessoal } from './contexto';
import { usePaginaPessoal, type VmPessoal } from './usePaginaPessoal';

const TOPICOS: { id: TopicoPessoal; rotulo: string; icone: NomeIcone; grupo: string; busca: string }[] = [
  { id: 'conta', rotulo: 'Minha conta', icone: 'usuario', grupo: 'Conta', busca: 'foto perfil ícone icone nome e-mail email setor sair senha' },
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

/** O nome: o texto com o Salvar ao lado (Enter salva). */
function EditarNome({ atual, salvar }: { atual: string; salvar: (n: string) => Promise<string | null> }) {
  const [nome, setNome] = useState(atual);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const mudou = nome.trim() !== atual;
  const ir = async () => { setSalvando(true); const e = await salvar(nome); setSalvando(false); setErro(e || ''); };
  return (
    <span className="pessoal-nome">
      <input value={nome} onChange={ev => { setNome(ev.target.value); setErro(''); }} onKeyDown={ev => { if (ev.key === 'Enter' && mudou) void ir(); }} aria-label="Nome" />
      {mudou && <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => void ir()}>{salvando ? <span className="btn-spinner" /> : null}Salvar</button>}
      {erro && <span className="pessoal-erro">{erro}</span>}
    </span>
  );
}

/** A senha: a atual (o Firebase pede de novo) e a nova duas vezes. */
function TrocarSenha({ salvar }: { salvar: (atual: string, nova: string, confirma: string) => Promise<string | null> }) {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  if (!aberto) {
    return (
      <Linha rotulo="Senha" dica="A mesma do Entregas.">
        <button type="button" className="btn btn-outline" onClick={() => setAberto(true)}><Icone nome="lock" />Trocar senha</button>
      </Linha>
    );
  }
  return (
    <form className="pessoal-form" onSubmit={async ev => {
      ev.preventDefault(); setSalvando(true);
      const e = await salvar(atual, nova, confirma);
      setSalvando(false);
      if (e) setErro(e); else { setAberto(false); setAtual(''); setNova(''); setConfirma(''); setErro(''); }
    }}>
      <b>Trocar senha</b>
      <input type="password" autoComplete="current-password" placeholder="Senha atual" value={atual} onChange={ev => setAtual(ev.target.value)} />
      <input type="password" autoComplete="new-password" placeholder="Senha nova (pelo menos 6 caracteres)" value={nova} onChange={ev => setNova(ev.target.value)} />
      <input type="password" autoComplete="new-password" placeholder="Repita a senha nova" value={confirma} onChange={ev => setConfirma(ev.target.value)} />
      {erro && <p className="pessoal-erro">{erro}</p>}
      <span className="pessoal-nome">
        <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? <span className="btn-spinner" /> : null}Trocar</button>
        <button type="button" className="btn btn-outline" onClick={() => { setAberto(false); setErro(''); }}>Cancelar</button>
      </span>
    </form>
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
        <div className="pessoal-linha-texto"><span className="fraco">Ou um ícone (os mesmos do Entregas):</span></div>
        <div className="pessoal-icones" role="list">
          {c.icones.map(i => (
            <button key={i.nome} type="button" role="listitem" className={'pessoal-icone' + (c.foto === i.url ? ' on' : '')} title={i.nome}
              aria-label={'Usar o ícone ' + i.nome} disabled={c.salvandoFoto} onClick={() => c.escolherIcone(i.url)}>
              <img src={i.url} alt="" />
            </button>
          ))}
        </div>
      </Cartao>
      <Cartao titulo="Conta">
        <Linha rotulo="Nome" dica="Como aparece nas tarefas e nos pedidos ao robô (e no Entregas).">
          {c.comLogin ? <EditarNome atual={c.nome} salvar={c.trocarNome} /> : c.nome}
        </Linha>
        <Linha rotulo="E-mail" dica="O login do Entregas (a mesma conta em todo o nads).">{c.email || '—'}</Linha>
        <Linha rotulo="Setor" dica="Quem muda é um administrador.">{c.setor}</Linha>
        {c.comLogin && <TrocarSenha salvar={c.trocarSenha} />}
        <Linha rotulo={c.sair} dica="Sai deste navegador; para entrar de novo, o login do Entregas.">
          <button type="button" className="btn btn-outline btn-danger" onClick={c.fazerSair}><Icone nome="logOut" />{c.sair}</button>
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
          {/* por enquanto só Minha conta, e Versão do sistema (Vitor, 05/10/2026: saíram a Caixa de entrada, as
              Anotações, Aparência e telas, Perguntar à IA e Perguntas frequentes) */}
          <div className="pessoal-rola">
            {topico === 'aplicativo' ? <Aplicativo vm={vm} /> : <MinhaConta vm={vm} />}
          </div>
        </section>
      </div>
    </div>
  );
}
