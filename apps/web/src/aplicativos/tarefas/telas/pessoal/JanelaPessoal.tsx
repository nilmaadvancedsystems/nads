// View da Minha página: uma janela grande por cima da tela, no desenho das Configurações do Notion (e do Entregas,
// que segue o Notion) — à esquerda a pessoa, a busca e os tópicos em grupos; à direita o tópico aberto, em seções
// com cabeçalho e uma opção por linha (o rótulo e a explicação à esquerda, o controle à direita). Fecha no ×, no Esc e
// clicando fora.
import { animacoesPedidas, BotaoFechar, CampoArquivo, ConfigLinha, ConfigSecao, definirNivelDeAnimacao, Icone, MenuSuspenso, NIVEIS_DE_ANIMACAO, nivelDeAnimacao, SeletorTema, useIndicador, useJanela, type NivelDeAnimacao, type NomeIcone } from '@nads/ui';
import { animate, cleanInlineStyles, spring, stagger, type JSAnimation } from 'animejs';
import { useLayoutEffect, useRef, useState } from 'react';

// As animações (14/10/2026: "faça do clique ao perfil as configurações pessoais", com o animejs): a janela chega com mola e
// a lateral em cascata; trocar de tópico desliza o conteúdo e as linhas chegam em cascata (os ícones de perfil saltam);
// o fundo da lateral desliza até o tópico; fechar encolhe a janela. As Animações › Nenhuma (aqui, em Preferências) tiram, e
// quem pediu menos movimento no computador não vê.
const menosMovimento = () => !animacoesPedidas();
// terminou: tira o estilo que ficou (um transform parado em cada linha punha as de baixo por cima do menu suspenso)
const limpar = { onComplete: (a: JSAnimation) => { cleanInlineStyles(a); } };

/** Quanto o nads anima (14/10/2026: "um botão para tirar/reduzir animações para o normal"): vale na hora, neste navegador. */
function NivelDasAnimacoes() {
  const [nivel, setNivel] = useState<NivelDeAnimacao>(nivelDeAnimacao());
  const atual = NIVEIS_DE_ANIMACAO.find(n => n.id === nivel) || NIVEIS_DE_ANIMACAO[1];
  return (
    <ConfigLinha titulo="Animações" descricao={atual.dica}>
      {/* num menu suspenso (14/10/2026: "coloque um dropdown"): o nome mais longo não cabia nos botões lado a lado */}
      <MenuSuspenso rotulo={atual.nome} className="btn btn-ghost" titulo="Animações" direita largura={340}
        itens={NIVEIS_DE_ANIMACAO.map(n => ({ rotulo: n.nome, marcado: n.id === nivel, onClick: () => { definirNivelDeAnimacao(n.id); setNivel(n.id); } }))} />
    </ConfigLinha>
  );
}
import type { TopicoPessoal } from './contexto';
import { usePaginaPessoal, type VmPessoal } from './usePaginaPessoal';
import { EmpresasDaPessoa } from '../cadastro/responsaveis/EmpresasDaPessoa';
import { FeedbacksDoAdmin } from '../../../admin/telas/feedbacks/FeedbacksDoAdmin';

const TOPICOS: { id: TopicoPessoal; rotulo: string; icone: NomeIcone; grupo: string; busca: string; soAdmin?: boolean }[] = [
  { id: 'conta', rotulo: 'Minha conta', icone: 'usuario', grupo: 'Conta', busca: 'foto perfil ícone icone nome e-mail email setor sair senha tema claro escuro aparência animações animacoes movimento' },
  // as próprias empresas, com o Transferir (Vitor, 07/10/2026: "dentro do usuário/configurações vai ter as próprias empresas")
  { id: 'empresas', rotulo: 'Minhas empresas', icone: 'briefcase', grupo: 'Conta', busca: 'empresas responsável transferir transferência' },
  { id: 'aplicativo', rotulo: 'Versão do sistema', icone: 'download', grupo: 'Aplicativo', busca: 'versão atualizar nova' },
  // os Feedbacks da equipe, os mesmos do site do admin, no usuário do Vitor (26/10/2026): só para o admin
  { id: 'feedbacks', rotulo: 'Feedbacks', icone: 'mensagem', grupo: 'Aplicativo', busca: 'feedbacks bugs reports sugestões equipe', soAdmin: true },
];

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
      <ConfigLinha titulo="Senha" descricao="A mesma do Entregas.">
        <button type="button" className="btn btn-outline" onClick={() => setAberto(true)}><Icone nome="lock" />Trocar senha</button>
      </ConfigLinha>
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
      {/* no estilo das configurações do Notion (14/10/2026: "vamos trabalhar nessas telas"): seções com a linha fina, uma
          opção por linha; a foto em cima com os botões, os ícones numa grade menor logo abaixo */}
      <ConfigSecao titulo="Foto de perfil">
        <div className="cfg-linha pessoal-foto-linha">
          <Foto foto={c.foto} iniciais={c.iniciais} grande />
          <div className="cfg-linha-texto">
            <span className="cfg-linha-titulo">{c.nome}</span>
            <span className="cfg-linha-desc">Aparece no seu ícone, no canto do cabeçalho, e no Entregas (é a mesma conta).</span>
          </div>
          <div className="cfg-linha-controle">
            <CampoArquivo semCaixa semFoco ref={arquivo} aceitar="image/*" onEscolher={f => { if (f) c.trocarFoto(f); }} />
            <button type="button" className="btn btn-outline" disabled={c.salvandoFoto} onClick={() => arquivo.current?.click()}>
              {c.salvandoFoto ? <span className="btn-spinner" /> : <Icone nome="upload" />}{c.foto ? 'Trocar foto' : 'Escolher foto'}
            </button>
            {c.foto && <button type="button" className="btn btn-ghost" disabled={c.salvandoFoto} onClick={c.tirarFoto}>Tirar a foto</button>}
          </div>
        </div>
        <p className="cfg-linha-desc pessoal-icones-rotulo">Ou um ícone (os mesmos do Entregas)</p>
        <div className="pessoal-icones" role="list">
          {c.icones.map(i => (
            <button key={i.nome} type="button" role="listitem" className={'pessoal-icone' + (c.foto === i.url ? ' on' : '')} title={i.nome}
              aria-label={'Usar o ícone ' + i.nome} disabled={c.salvandoFoto} onClick={() => c.escolherIcone(i.url)}>
              <img src={i.url} alt="" />
            </button>
          ))}
        </div>
      </ConfigSecao>
      <ConfigSecao titulo="Conta">
        <ConfigLinha titulo="Nome" descricao="Como aparece nas tarefas e nos pedidos ao robô (e no Entregas).">
          {c.comLogin ? <EditarNome atual={c.nome} salvar={c.trocarNome} /> : <span className="cfg-valor">{c.nome}</span>}
        </ConfigLinha>
        <ConfigLinha titulo="E-mail" descricao="O login do Entregas, a mesma conta em todo o nads."><span className="cfg-valor">{c.email || '—'}</span></ConfigLinha>
        <ConfigLinha titulo="Setor" descricao="Quem muda é um administrador."><span className="cfg-valor">{c.setor}</span></ConfigLinha>
        {c.comLogin && <TrocarSenha salvar={c.trocarSenha} />}
      </ConfigSecao>
      <ConfigSecao titulo="Preferências">
        <ConfigLinha titulo="Tema" descricao="Claro, escuro ou o mesmo do computador. Fica guardado neste navegador."><SeletorTema /></ConfigLinha>
        <NivelDasAnimacoes />
      </ConfigSecao>
      <ConfigSecao titulo="Sessão">
        <ConfigLinha titulo={c.sair} descricao="Sai deste navegador; para entrar de novo, o login do Entregas.">
          <button type="button" className="btn btn-outline btn-danger" onClick={c.fazerSair}><Icone nome="logOut" />{c.sair}</button>
        </ConfigLinha>
      </ConfigSecao>
    </>
  );
}

function Aplicativo({ vm }: { vm: VmPessoal }) {
  const a = vm.aplicativo;
  return (
    <ConfigSecao titulo="Atualização">
      <ConfigLinha titulo="Versão" descricao="Uma versão só para o nads inteiro."><span className="cfg-valor num">{a.versao}</span></ConfigLinha>
      <ConfigLinha titulo="Versão nova" descricao={a.versaoNova ? 'Saiu a ' + a.versaoNova + '. Atualizar não perde o que está na tela.' : 'Você está na mais nova.'}>
        {a.versaoNova ? <button type="button" className="btn btn-primary" onClick={a.atualizar}><Icone nome="repeat" />Atualizar</button> : <span className="badge badge-ok">Em dia</span>}
      </ConfigLinha>
    </ConfigSecao>
  );
}

export function JanelaPessoal({ topico, mudar, fechar }: { topico: TopicoPessoal; mudar: (t: TopicoPessoal) => void; fechar: () => void }) {
  const vm = usePaginaPessoal();
  const [busca, setBusca] = useState('');
  const janela = useRef<HTMLDivElement>(null);
  const rola = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const saindo = useRef(false);
  // fechar: a janela encolhe e some, depois fecha de verdade
  const sair = () => {
    const el = janela.current;
    if (saindo.current) return;
    if (!el || menosMovimento()) { fechar(); return; }
    saindo.current = true;
    animate(el, { opacity: 0, scale: 0.96, translateY: 8, duration: 180, ease: 'inQuad', onComplete: () => fechar() });
    if (el.parentElement) animate(el.parentElement, { opacity: 0, duration: 200, ease: 'linear' });
  };
  const sairRef = useRef(sair);
  sairRef.current = sair;
  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela) (com a janela de troca por cima, o Esc é dela)
  useJanela(janela, () => sairRef.current());
  // a entrada: a janela cresce com mola e a lateral chega em cascata
  useLayoutEffect(() => {
    const el = janela.current;
    if (!el || menosMovimento()) return;
    animate(el, { opacity: [0, 1], scale: [0.95, 1], translateY: [12, 0], ease: spring({ bounce: 0.25, duration: 520 }), ...limpar });
    animate(el.querySelectorAll('.pessoal-quem, .pessoal-busca, .pessoal-grupo, .pessoal-topico'), { opacity: [0, 1], translateX: [-10, 0], duration: 360, delay: stagger(40, { start: 100 }), ease: 'outQuint', ...limpar });
  }, []);
  // o tópico: o título e o conteúdo deslizam, as linhas chegam em cascata e os ícones de perfil saltam
  useLayoutEffect(() => {
    const r = rola.current;
    if (!r || menosMovimento()) return;
    r.scrollTop = 0;
    if (titulo.current) animate(titulo.current, { opacity: [0, 1], translateY: [6, 0], duration: 300, ease: 'outQuint', ...limpar });
    animate(Array.from(r.querySelectorAll('.cfg-secao-topo, .cfg-linha, .emp-pessoa-lista > li')).slice(0, 18), { opacity: [0, 1], translateY: [8, 0], duration: 360, delay: stagger(28, { start: 60 }), ease: 'outQuint', ...limpar });
    animate(Array.from(r.querySelectorAll('.pessoal-icone')).slice(0, 56), { opacity: [0, 1], scale: [0.5, 1], delay: stagger(10, { start: 180 }), ease: spring({ bounce: 0.45, duration: 420 }), ...limpar });
  }, [topico]);
  // o fundo da lateral desliza até o tópico aberto
  const lateral = useIndicador<HTMLElement>('.pessoal-topico.ativo', [topico, busca], 'fundo');
  const q = busca.trim().toLowerCase();
  const visiveis = TOPICOS.filter(t => (!t.soAdmin || vm.conta.admin) && (!q || (t.rotulo + ' ' + t.busca).toLowerCase().includes(q)));
  const atual = TOPICOS.find(t => t.id === topico) || TOPICOS[0];
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) sair(); }}>
      <div ref={janela} className="pessoal-janela" role="dialog" aria-modal="true" aria-label="Minha página">
        <aside className="pessoal-lado">
          <div className="pessoal-quem">
            <Foto foto={vm.conta.foto} iniciais={vm.conta.iniciais} />
            <div className="pessoal-quem-texto"><b>{vm.conta.nome}</b><span className="fraco">{vm.conta.email || vm.conta.setor}</span></div>
          </div>
          <label className="busca-curta pessoal-busca">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar" aria-label="Buscar nas configurações" value={busca} onChange={e => setBusca(e.target.value)} />
          </label>
          <nav ref={lateral} className="pessoal-nav com-indicador" aria-label="Tópicos">
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
            <h2 ref={titulo}>{atual.rotulo}</h2>
            <BotaoFechar onClick={sair} />
          </header>
          {/* por enquanto só Minha conta, e Versão do sistema (Vitor, 05/10/2026: saíram a Caixa de entrada, as
              Anotações, Aparência e telas, Perguntar à IA e Perguntas frequentes) */}
          <div ref={rola} className="pessoal-rola">
            {topico === 'feedbacks' && vm.conta.admin ? <FeedbacksDoAdmin /> : topico === 'aplicativo' ? <Aplicativo vm={vm} /> : topico === 'empresas' ? <EmpresasDaPessoa pessoa={vm.conta.nome} /> : <MinhaConta vm={vm} />}
          </div>
        </section>
      </div>
    </div>
  );
}
