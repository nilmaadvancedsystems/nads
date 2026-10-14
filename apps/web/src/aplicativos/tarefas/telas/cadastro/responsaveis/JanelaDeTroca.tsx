// A janela "Trocar empresas" (Vitor, 07/10/2026: "realmente uma troca, onde abre uma tela flutuante que você escolhe a
// pessoa, escolhe a empresa que quer transferir e escolhe a outra pessoa e uma empresa dela para transferir ou não"): dois
// lados — a pessoa e as empresas dela, marcando as que vão para o outro lado. Do lado B, marcar é opcional. A troca só
// vale com o aceite dos dois.
// Refeita em 14/10/2026 ("melhora a janela de trocar empresas"): cada lado num painel (a pessoa, a contagem, Marcar todas /
// Limpar, a busca e a lista com as marcadas em destaque); no meio, o que vai e o que volta; embaixo, a troca numa frase.
import { Icone, MenuSuspenso } from '@nads/ui';
import { useEffect, useState } from 'react';
import { PessoaComFoto } from './FotoDaPessoa';
import type { Dep, VmEmpresasPorResponsavel } from './useEmpresasPorResponsavel';

type Empresa = { chave: string; nome: string; codigo: number | null; dep: Dep };
const n = (q: number, um: string, varios: string) => q + ' ' + (q === 1 ? um : varios);

function Lado({ vm, rotulo, pessoa, setPessoa, outra, marcadas, setMarcadas, opcional }: {
  vm: VmEmpresasPorResponsavel; rotulo: string; pessoa: string; setPessoa: (p: string) => void; outra: string;
  marcadas: ReadonlySet<string>; setMarcadas: (s: Set<string>) => void; opcional?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const todas: Empresa[] = pessoa ? vm.empresasDe(pessoa).filter(x => !x.linha.transferencias[x.dep] && vm.igual(x.linha.atual[x.dep], pessoa))
    .map(x => ({ chave: x.linha.chave + '|' + x.dep, nome: x.linha.nome, codigo: x.linha.codigo, dep: x.dep })) : [];
  const lista = todas.filter(e => !q || e.nome.toLowerCase().includes(q) || String(e.codigo ?? '').includes(q));
  const alternar = (k: string) => { const s = new Set(marcadas); if (s.has(k)) s.delete(k); else s.add(k); setMarcadas(s); };
  // Marcar todas: as que a busca mostra
  const todasMarcadas = lista.length > 0 && lista.every(e => marcadas.has(e.chave));
  const marcarTodas = () => { const s = new Set(marcadas); lista.forEach(e => (todasMarcadas ? s.delete(e.chave) : s.add(e.chave))); setMarcadas(s); };
  return (
    <section className={'troca-lado' + (pessoa ? '' : ' vazio')}>
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
          <span className="fraco">{opcional ? 'Marcar as empresas dela é opcional: sem marcar, só as suas vão.' : 'Escolha a pessoa para ver as empresas dela.'}</span>
        </div>
      ) : (
        <>
          <div className="troca-barra">
            <span className="troca-conta">
              {n(todas.length, 'empresa', 'empresas')}
              {marcadas.size > 0 && <b> · {n(marcadas.size, 'marcada', 'marcadas')}</b>}
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
                  <input type="checkbox" checked={marcadas.has(e.chave)} onChange={() => alternar(e.chave)} />
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
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.troca-janela .popover')) fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const escolhidas = (pessoaDoLado: string, marcadas: ReadonlySet<string>) => vm.empresasDe(pessoaDoLado)
    .filter(x => marcadas.has(x.linha.chave + '|' + x.dep)).map(x => ({ nome: x.linha.nome, codigo: x.linha.codigo, dep: x.dep }));
  const pedir = () => { vm.pedirTroca(a, escolhidas(a, daA), b, b ? escolhidas(b, daB) : []); fechar(); };
  // a troca numa frase
  const frase = !a ? 'Escolha de quem saem as empresas.'
    : !daA.size ? 'Marque as empresas de ' + a + ' que vão para o outro lado.'
    : !b ? n(daA.size, 'empresa', 'empresas') + ' de ' + a + '. Agora escolha para quem vão.'
    : n(daA.size, 'empresa', 'empresas') + ' de ' + a + (daA.size === 1 ? ' vai' : ' vão') + ' para ' + b + (daB.size ? ', e ' + n(daB.size, 'empresa', 'empresas') + ' de ' + b + (daB.size === 1 ? ' vem' : ' vêm') + ' para ' + a : '') + '.';
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pessoal-janela troca-janela" role="dialog" aria-modal="true" aria-label="Trocar empresas">
        <header className="pessoal-topo troca-topo">
          <div>
            <h2>Trocar empresas</h2>
            <p className="fraco">Marque o que vai para o outro lado. Cada empresa só muda com o aceite das duas pessoas.</p>
          </div>
          <button type="button" className="drawer-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" /></button>
        </header>
        <div className="troca-corpo">
          <Lado vm={vm} rotulo="De" pessoa={a} setPessoa={setA} outra={b} marcadas={daA} setMarcadas={setDaA} />
          {/* no meio, o que vai (de A para B) e o que volta (de B para A) */}
          <div className="troca-meio" aria-hidden="true">
            <span className={'troca-fluxo' + (daA.size ? ' on' : '')}>{daA.size}<Icone nome="chevronRight" /></span>
            <span className="troca-meio-icone"><Icone nome="repeat" /></span>
            <span className={'troca-fluxo' + (daB.size ? ' on' : '')}><Icone nome="chevronLeft" />{daB.size}</span>
          </div>
          <Lado vm={vm} rotulo="Para" pessoa={b} setPessoa={setB} outra={a} marcadas={daB} setMarcadas={setDaB} opcional />
        </div>
        <footer className="usuario-pe troca-pe">
          <span className="troca-frase">{frase}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!a || !b || !daA.size} onClick={pedir}><Icone nome="repeat" />Pedir troca</button>
        </footer>
      </div>
    </div>
  );
}
