// A janela "Trocar empresas" (Vitor, 07/10/2026: "realmente uma troca, onde abre uma tela flutuante que você escolhe a
// pessoa, escolhe a empresa que quer transferir e escolhe a outra pessoa e uma empresa dela para transferir ou não"): dois
// lados — a pessoa e as empresas dela, marcando as que vão para o outro lado. Do lado B, marcar é opcional. A troca só
// vale com o aceite dos dois.
// Refeita em 14/10/2026 ("melhora a janela de trocar empresas"): cada lado num painel (a pessoa, a contagem, Marcar todas /
// Limpar, a busca e a lista com as marcadas em destaque); no meio, o que vai e o que volta; embaixo, a troca numa frase.
// Animada com o animejs (14/10/2026: "pode trabalhar em animações para essa página, use o animejs"): a entrada (a janela com
// mola, os painéis chegando dos lados, as empresas em cascata), marcar (a linha dá um pulinho e o contador do meio salta),
// Marcar todas (uma onda pela lista), escolher a pessoa (a lista dela em cascata), Pedir troca (as marcadas deslizam para
// o outro lado) e fechar (a janela encolhe). As Animações › Nenhuma (Minha página) tiram, e quem pediu menos movimento no computador não vê.
import { animacoesPedidas, BotaoFechar, Icone, MenuSuspenso, useJanela } from '@nads/ui';
import { animate, spring, stagger } from 'animejs';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PessoaComFoto } from './FotoDaPessoa';
import type { Dep, VmEmpresasPorResponsavel } from './useEmpresasPorResponsavel';

type Empresa = { chave: string; nome: string; codigo: number | null; dep: Dep };
const n = (q: number, um: string, varios: string) => q + ' ' + (q === 1 ? um : varios);
const menosMovimento = () => !animacoesPedidas();
/** as primeiras linhas da lista (as que aparecem): só elas animam */
const linhasVisiveis = (raiz: Element | null | undefined, quantas = 14) => Array.from(raiz?.querySelectorAll('.troca-lista > li') || []).slice(0, quantas);

function Lado({ vm, rotulo, pessoa, setPessoa, outra, marcadas, setMarcadas, opcional }: {
  vm: VmEmpresasPorResponsavel; rotulo: string; pessoa: string; setPessoa: (p: string) => void; outra: string;
  marcadas: ReadonlySet<string>; setMarcadas: (s: Set<string>) => void; opcional?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const todas: Empresa[] = pessoa ? vm.empresasDe(pessoa).filter(x => !x.linha.transferencias[x.dep] && vm.igual(x.linha.atual[x.dep], pessoa))
    .map(x => ({ chave: x.linha.chave + '|' + x.dep, nome: x.linha.nome, codigo: x.linha.codigo, dep: x.dep })) : [];
  const lista = todas.filter(e => !q || e.nome.toLowerCase().includes(q) || String(e.codigo ?? '').includes(q));
  const painel = useRef<HTMLElement>(null);
  // marcar: a linha dá um pulinho
  const alternar = (k: string, linha?: HTMLElement | null) => {
    const s = new Set(marcadas); if (s.has(k)) s.delete(k); else s.add(k); setMarcadas(s);
    if (linha && !menosMovimento()) animate(linha, { scale: [0.97, 1], ease: spring({ bounce: 0.5, duration: 340 }) });
  };
  // Marcar todas: as que a busca mostra; uma onda passa pela lista
  const todasMarcadas = lista.length > 0 && lista.every(e => marcadas.has(e.chave));
  const marcarTodas = () => {
    const s = new Set(marcadas); lista.forEach(e => (todasMarcadas ? s.delete(e.chave) : s.add(e.chave))); setMarcadas(s);
    if (!menosMovimento()) animate(linhasVisiveis(painel.current, 18), { scale: [0.97, 1], opacity: [0.6, 1], duration: 320, delay: stagger(22), ease: 'outQuad' });
  };
  // outra pessoa: a lista dela chega em cascata (a primeira vez fica com a entrada da janela)
  const primeira = useRef(true);
  useLayoutEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    if (!pessoa || menosMovimento()) return;
    animate(linhasVisiveis(painel.current), { opacity: [0, 1], translateY: [8, 0], duration: 360, delay: stagger(24), ease: 'outQuint' });
  }, [pessoa]);
  // a contagem das marcadas dá um salto quando muda
  const conta = useRef<HTMLElement>(null);
  useEffect(() => {
    if (marcadas.size && conta.current && !menosMovimento()) animate(conta.current, { scale: [1.15, 1], ease: spring({ bounce: 0.45, duration: 320 }) });
  }, [marcadas.size]);
  return (
    <section ref={painel} className={'troca-lado' + (pessoa ? '' : ' vazio')}>
      {/* a pessoa no menu suspenso dos componentes (Vitor, 07/10/2026: "siga as seleções dos componentes") */}
      <header className="troca-lado-topo">
        <span className="troca-rotulo">{rotulo}</span>
        <MenuSuspenso rotulo={pessoa ? <PessoaComFoto nome={pessoa} {...vm.fotoDe(pessoa)} /> : 'Escolher pessoa'} icone={pessoa ? undefined : 'usuario'}
          className="btn btn-outline troca-escolher" titulo={rotulo} largura={260}
          itens={vm.pessoasDaTroca.filter(x => !vm.igual(x, outra)).map(x => ({
            rotulo: <PessoaComFoto nome={x} {...vm.fotoDe(x)} />, marcado: vm.igual(x, pessoa), dica: String(vm.pessoas.find(p => vm.igual(p.nome, x))?.total ?? 0),
            onClick: () => { setPessoa(x); setMarcadas(new Set()); setBusca(''); },
          }))} />
      </header>
      {!pessoa ? (
        <div className="troca-vazio">
          <span className="troca-vazio-icone" aria-hidden="true"><Icone nome="usuario" /></span>
          <b>Escolha com quem trocar</b>
          {opcional && <span className="fraco">Marcar as empresas dela é opcional: sem marcar, só as suas vão.</span>}
        </div>
      ) : (
        <>
          <div className="troca-barra">
            <span className="troca-conta">
              {n(todas.length, 'empresa', 'empresas')}
              {marcadas.size > 0 && <> · <b ref={conta} className="troca-conta-marcadas">{n(marcadas.size, 'marcada', 'marcadas')}</b></>}
            </span>
            {lista.length > 0 && <button type="button" className="btn btn-ghost troca-todas" onClick={marcarTodas}>{todasMarcadas ? 'Limpar' : 'Marcar todas'}</button>}
          </div>
          <label className="busca-curta troca-busca">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar por nome ou código" aria-label={'Buscar nas empresas de ' + pessoa} value={busca} onChange={e => setBusca(e.target.value)} />
          </label>
          <ul className="troca-lista">
            {lista.map(e => (
              <li key={e.chave} className={marcadas.has(e.chave) ? 'on' : undefined}>
                <label>
                  <input type="checkbox" checked={marcadas.has(e.chave)} onChange={ev => alternar(e.chave, ev.currentTarget.closest('label'))} />
                  <span className="num fraco">{e.codigo ?? ''}</span>
                  <span className="troca-nome" title={e.nome}>{e.nome}</span>
                  {e.dep === 'contabil' && <span className="badge badge-neutral">Contábil</span>}
                </label>
              </li>
            ))}
            {!lista.length && <li className="troca-nada fraco">{todas.length ? 'Nada com "' + busca + '"' : 'Sem empresas para trocar'}</li>}
          </ul>
        </>
      )}
    </section>
  );
}

export function JanelaDeTroca({ vm, pessoa, fechar }: { vm: VmEmpresasPorResponsavel; pessoa: string; fechar: () => void }) {
  const [a, setA] = useState(pessoa);
  const [b, setB] = useState('');
  const [daA, setDaA] = useState<Set<string>>(new Set());
  const [daB, setDaB] = useState<Set<string>>(new Set());
  const janela = useRef<HTMLDivElement>(null);
  const [saindo, setSaindo] = useState(false);
  // fechar: a janela encolhe e some, depois fecha de verdade
  const sair = (depois: () => void = fechar) => {
    const el = janela.current;
    if (!el || menosMovimento()) { depois(); return; }
    setSaindo(true);
    animate(el, { opacity: 0, scale: 0.96, translateY: 8, duration: 180, ease: 'inQuad', onComplete: () => depois() });
    const fundo = el.parentElement;
    if (fundo) animate(fundo, { opacity: 0, duration: 200, ease: 'linear' });
  };
  const sairRef = useRef(sair);
  sairRef.current = sair;
  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela)
  useJanela(janela, () => sairRef.current());
  // a entrada: a janela cresce com mola, os painéis chegam dos lados, o meio aparece e as empresas descem em cascata
  useLayoutEffect(() => {
    const el = janela.current;
    if (!el || menosMovimento()) return;
    animate(el, { opacity: [0, 1], scale: [0.94, 1], translateY: [14, 0], ease: spring({ bounce: 0.25, duration: 520 }) });
    const [esq, dir] = Array.from(el.querySelectorAll('.troca-lado'));
    if (esq) animate(esq, { opacity: [0, 1], translateX: [-24, 0], duration: 460, delay: 80, ease: 'outQuint' });
    if (dir) animate(dir, { opacity: [0, 1], translateX: [24, 0], duration: 460, delay: 140, ease: 'outQuint' });
    animate(el.querySelectorAll('.troca-meio > *'), { opacity: [0, 1], scale: [0.4, 1], delay: stagger(70, { start: 220 }), ease: spring({ bounce: 0.5, duration: 420 }) });
    animate(linhasVisiveis(esq), { opacity: [0, 1], translateY: [8, 0], duration: 380, delay: stagger(22, { start: 200 }), ease: 'outQuint' });
  }, []);
  // o contador do meio salta quando muda, com a seta empurrando para o lado da troca
  const vai = useRef<HTMLSpanElement>(null);
  const volta = useRef<HTMLSpanElement>(null);
  const pular = (el: HTMLElement | null, lado: 1 | -1) => {
    if (!el || menosMovimento()) return;
    animate(el, { scale: [1.22, 1], ease: spring({ bounce: 0.5, duration: 380 }) });
    const seta = el.querySelector('svg');
    if (seta) animate(seta, { translateX: [lado * 5, 0], duration: 360, ease: 'outBack' });
  };
  const primeiraConta = useRef(true);
  useEffect(() => { if (!primeiraConta.current) pular(vai.current, 1); }, [daA.size]);
  useEffect(() => { if (primeiraConta.current) { primeiraConta.current = false; return; } pular(volta.current, -1); }, [daB.size]);
  const escolhidas = (pessoaDoLado: string, marcadas: ReadonlySet<string>) => vm.empresasDe(pessoaDoLado)
    .filter(x => marcadas.has(x.linha.chave + '|' + x.dep)).map(x => ({ nome: x.linha.nome, codigo: x.linha.codigo, dep: x.dep }));
  // Pedir troca: as marcadas deslizam para o outro lado (as de A para a direita, as de B para a esquerda), depois fecha
  const pedir = () => {
    const daAEsc = escolhidas(a, daA);
    const daBEsc = b ? escolhidas(b, daB) : [];
    const el = janela.current;
    if (!el || menosMovimento()) { vm.pedirTroca(a, daAEsc, b, daBEsc); fechar(); return; }
    setSaindo(true);
    const [esq, dir] = Array.from(el.querySelectorAll('.troca-lado'));
    animate(Array.from(esq?.querySelectorAll('.troca-lista > li.on') || []).slice(0, 14), { translateX: [0, 60], opacity: [1, 0], duration: 360, delay: stagger(30), ease: 'inQuad' });
    animate(Array.from(dir?.querySelectorAll('.troca-lista > li.on') || []).slice(0, 14), { translateX: [0, -60], opacity: [1, 0], duration: 360, delay: stagger(30), ease: 'inQuad' });
    animate(el.querySelectorAll('.troca-meio-icone'), { rotate: [0, 180], duration: 420, ease: 'inOutQuad' });
    setTimeout(() => sair(() => { vm.pedirTroca(a, daAEsc, b, daBEsc); fechar(); }), 380);
  };
  // a troca numa frase
  const frase = !a ? 'Escolha de quem saem as empresas.'
    : !daA.size ? 'Marque as empresas de ' + a + ' que vão para o outro lado.'
    : !b ? n(daA.size, 'empresa', 'empresas') + ' de ' + a + '. Agora escolha para quem vão.'
    : n(daA.size, 'empresa', 'empresas') + ' de ' + a + (daA.size === 1 ? ' vai' : ' vão') + ' para ' + b + (daB.size ? ', e ' + n(daB.size, 'empresa', 'empresas') + ' de ' + b + (daB.size === 1 ? ' vem' : ' vêm') + ' para ' + a : '') + '.';
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget && !saindo) sair(); }}>
      <div ref={janela} className="pessoal-janela troca-janela" role="dialog" aria-modal="true" aria-label="Trocar empresas">
        <header className="pessoal-topo troca-topo">
          <div>
            <h2>Trocar empresas</h2>
            <p className="fraco">Cada empresa só muda com o aceite das duas pessoas.</p>
          </div>
          <BotaoFechar onClick={() => sair()} />
        </header>
        <div className="troca-corpo">
          <Lado vm={vm} rotulo="De" pessoa={a} setPessoa={setA} outra={b} marcadas={daA} setMarcadas={setDaA} />
          {/* no meio, o que vai (de A para B) e o que volta (de B para A) */}
          <div className="troca-meio" aria-hidden="true">
            <span ref={vai} className={'troca-fluxo' + (daA.size ? ' on' : '')}>{daA.size}<Icone nome="chevronRight" /></span>
            <span className="troca-meio-icone"><Icone nome="repeat" /></span>
            <span ref={volta} className={'troca-fluxo' + (daB.size ? ' on' : '')}><Icone nome="chevronLeft" />{daB.size}</span>
          </div>
          <Lado vm={vm} rotulo="Para" pessoa={b} setPessoa={setB} outra={a} marcadas={daB} setMarcadas={setDaB} opcional />
        </div>
        <footer className="usuario-pe troca-pe">
          <span className="troca-frase">{frase}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" disabled={saindo} onClick={() => sair()}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!a || !b || !daA.size || saindo} onClick={pedir}><Icone nome="repeat" />Pedir troca</button>
        </footer>
      </div>
    </div>
  );
}
