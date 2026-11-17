// O Contatudo (Vitor, 17/11/2026): a primeira tela escolhe a empresa; depois, o período e as ferramentas do Contábil, as
// mesmas telas da Tarefa, abertas soltas. Nada vai para o banco (useContatudo.ts). O Voltar no canto superior esquerdo.
import { Icone } from '@nads/ui';
import { useState } from 'react';
import { EtapaProvider } from '../executor/etapas/contexto';
import { PonteDaEtapaProvider } from '../executor/etapas/ponte';
import { TelaDaEtapa } from '../executor/etapas/TelaDaEtapa';
import { FERRAMENTAS, useContatudo } from './useContatudo';

const nada = () => {};
const PONTE = { porMes: {}, periodo: null, etapaConcluida: false, marcarSemMovimento: nada, trocarCompetencia: nada, encerrarPeriodo: nada, assinarDestaque: () => nada };

export function Contatudo() {
  const vm = useContatudo();
  const [alvoDosAvisos, setAlvo] = useState<HTMLElement | null>(null);

  if (!vm.empresa || !vm.etapa) {
    return (
      <main className="contatudo">
        <header className="contatudo-topo">
          <h1 className="page-title">Contatudo</h1>
          <p className="hint">As ferramentas do Contábil para usar em urgência. Só consulta o nads: nada do que você fizer aqui vai para o banco.</p>
        </header>
        <section className="card contatudo-empresas">
          <label className="field">
            <span>Empresa</span>
            <input className="input" type="search" autoFocus placeholder="Nome ou código" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
          </label>
          <ul className="contatudo-lista">
            {vm.lista.map(e => (
              <li key={e.codigo}>
                <button type="button" className="contatudo-empresa" onClick={() => vm.entrar(e.codigo)}>
                  <span className="contatudo-cod">{e.codigo}</span><span>{e.nome}</span>
                </button>
              </li>
            ))}
            {!vm.lista.length && <li className="hint">Nenhuma empresa com esse nome ou código.</li>}
          </ul>
        </section>
      </main>
    );
  }

  return (
    <main className="contatudo">
      <header className="contatudo-topo contatudo-topo-empresa">
        <button type="button" className="btn btn-ghost" onClick={vm.sair}><Icone nome="chevronLeft" />Empresas</button>
        <div className="contatudo-titulo">
          <h1 className="page-title">{vm.empresa.codigo} · {vm.empresa.nome}</h1>
          <span className="hint">Contatudo · só consulta, nada vai para o banco</span>
        </div>
        <div className="contatudo-periodo">
          <label className="field"><span>De</span><input className="input" type="month" value={vm.de} onChange={e => vm.setDe(e.target.value)} /></label>
          <label className="field"><span>Até</span><input className="input" type="month" value={vm.ate} min={vm.de} onChange={e => vm.setAte(e.target.value)} /></label>
        </div>
      </header>
      <nav className="menu imp-abas" aria-label="Ferramentas">
        {FERRAMENTAS.map(f => (
          <button key={f.id} type="button" className={'menu-item' + (vm.ferramenta === f.id ? ' active' : '')} aria-current={vm.ferramenta === f.id ? 'page' : undefined} onClick={() => vm.abrir(f.id)}>
            <span>{f.rotulo}</span>
          </button>
        ))}
      </nav>
      {vm.abas && vm.abas.paginas.length > 1 && (
        <nav className="menu imp-abas contatudo-subabas" aria-label="Telas da ferramenta">
          {vm.abas.paginas.map(p => (
            <button key={p.id} type="button" className={'menu-item' + (p.ativa ? ' active' : '')} onClick={() => vm.abas?.abrir(p.id)}><span>{p.rotulo}</span></button>
          ))}
        </nav>
      )}
      <div ref={setAlvo} className="contatudo-avisos" />
      <div className="executor-ferramenta contatudo-ferramenta">
        <EtapaProvider key={vm.chave} etapa={vm.etapa} onRequisitos={nada} onTeste={nada} onAbas={vm.setAbas} onBalancete={nada} alvoDosAvisos={alvoDosAvisos}>
          <PonteDaEtapaProvider valor={PONTE}>
            <TelaDaEtapa id={vm.ferramenta} />
          </PonteDaEtapaProvider>
        </EtapaProvider>
      </div>
    </main>
  );
}
