// A janela "Trocar empresas" (Vitor, 07/10/2026: "realmente uma troca, onde abre uma tela flutuante que você escolhe a
// pessoa, escolhe a empresa que quer transferir e escolhe a outra pessoa e uma empresa dela para transferir ou não"): dois
// lados — a pessoa e as empresas dela, marcando as que vão para o outro lado. Do lado B, marcar é opcional. A troca só
// vale com o aceite dos dois.
import { Icone } from '@nads/ui';
import { useEffect, useState } from 'react';
import type { Dep, VmEmpresasPorResponsavel } from './useEmpresasPorResponsavel';

type Empresa = { chave: string; nome: string; codigo: number | null; dep: Dep };

function Lado({ vm, rotulo, pessoa, setPessoa, outra, marcadas, setMarcadas }: {
  vm: VmEmpresasPorResponsavel; rotulo: string; pessoa: string; setPessoa: (p: string) => void; outra: string;
  marcadas: ReadonlySet<string>; setMarcadas: (s: Set<string>) => void;
}) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const todas: Empresa[] = pessoa ? vm.empresasDe(pessoa).filter(x => !x.linha.transferencias[x.dep] && vm.igual(x.linha.atual[x.dep], pessoa))
    .map(x => ({ chave: x.linha.chave + '|' + x.dep, nome: x.linha.nome, codigo: x.linha.codigo, dep: x.dep })) : [];
  const lista = todas.filter(e => !q || e.nome.toLowerCase().includes(q) || String(e.codigo ?? '').includes(q));
  const alternar = (k: string) => { const s = new Set(marcadas); if (s.has(k)) s.delete(k); else s.add(k); setMarcadas(s); };
  return (
    <section className="troca-lado">
      <label className="troca-pessoa">
        <span className="hint">{rotulo}</span>
        <select className="pessoal-select" value={pessoa} onChange={e => { setPessoa(e.target.value); setMarcadas(new Set()); }} aria-label={rotulo}>
          <option value="">Escolher…</option>
          {vm.pessoasDaTroca.filter(n => !vm.igual(n, outra)).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {pessoa && (
        <>
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" placeholder={'Buscar nas ' + todas.length} aria-label={'Buscar nas empresas de ' + pessoa} value={busca} onChange={e => setBusca(e.target.value)} />
          </label>
          <ul className="troca-lista">
            {lista.map(e => (
              <li key={e.chave}>
                <label>
                  <input type="checkbox" checked={marcadas.has(e.chave)} onChange={() => alternar(e.chave)} />
                  <span className="num fraco">{e.codigo ?? ''}</span>
                  <span className="troca-nome" title={e.nome}>{e.nome}</span>
                  {e.dep === 'contabil' && <span className="badge badge-neutral">Contábil</span>}
                </label>
              </li>
            ))}
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
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const escolhidas = (pessoaDoLado: string, marcadas: ReadonlySet<string>) => vm.empresasDe(pessoaDoLado)
    .filter(x => marcadas.has(x.linha.chave + '|' + x.dep)).map(x => ({ nome: x.linha.nome, codigo: x.linha.codigo, dep: x.dep }));
  const pedir = () => { vm.pedirTroca(a, escolhidas(a, daA), b, b ? escolhidas(b, daB) : []); fechar(); };
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pessoal-janela troca-janela" role="dialog" aria-modal="true" aria-label="Trocar empresas">
        <header className="pessoal-topo">
          <h2>Trocar empresas</h2>
          <button type="button" className="drawer-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" /></button>
        </header>
        <div className="troca-corpo">
          <Lado vm={vm} rotulo="De" pessoa={a} setPessoa={setA} outra={b} marcadas={daA} setMarcadas={setDaA} />
          <span className="troca-meio" aria-hidden="true"><Icone nome="repeat" /></span>
          <Lado vm={vm} rotulo="Para" pessoa={b} setPessoa={setB} outra={a} marcadas={daB} setMarcadas={setDaB} />
        </div>
        <footer className="usuario-pe troca-pe">
          <span className="hint">
            {a && daA.size ? daA.size + (daA.size === 1 ? ' empresa' : ' empresas') + ' de ' + a + (b ? ' → ' + b : '') : ''}
            {b && daB.size ? ' · ' + daB.size + (daB.size === 1 ? ' empresa' : ' empresas') + ' de ' + b + ' → ' + a : ''}
          </span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!a || !b || !daA.size} onClick={pedir}><Icone nome="repeat" />Pedir troca</button>
        </footer>
      </div>
    </div>
  );
}
