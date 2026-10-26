// As empresas de uma pessoa (Vitor, 07/10/2026), uma por linha, com o Trocar em cima (a janela da troca). Uma troca em
// andamento mostra para quem vai e o Aceitar / Recusar / Cancelar de quem pode. Usada na janela Empresas por responsável,
// no tópico Empresas do usuário e no Minhas empresas da Minha página.
import { ConfigLinha, Esqueleto, Icone, MenuSuspenso } from '@nads/ui';
import { useState } from 'react';
import { PessoaComFoto } from './FotoDaPessoa';
import { JanelaDeTroca } from './JanelaDeTroca';
import { useEmpresasPorResponsavel, type VmEmpresasPorResponsavel } from './useEmpresasPorResponsavel';

export function EmpresasDaPessoa({ pessoa, vm: vmDeFora }: { pessoa: string; vm?: VmEmpresasPorResponsavel }) {
  const proprio = useEmpresasPorResponsavel();
  const vm = vmDeFora || proprio;
  const [busca, setBusca] = useState('');
  const [trocando, setTrocando] = useState(false);
  if (vm.carregando) return <Esqueleto linhas={6} />;
  const q = busca.trim().toLowerCase();
  const todas = vm.empresasDe(pessoa);
  const lista = todas.filter(x => !q || x.linha.nome.toLowerCase().includes(q) || String(x.linha.codigo ?? '').includes(q));
  const porDep = (d: string) => todas.filter(x => x.dep === d).length;
  return (
    <div className="emp-pessoa">
      {/* no estilo das configurações (14/10/2026: "vamos trabalhar nessas telas"): o título com a contagem, a busca e o Trocar */}
      <div className="cfg-secao-topo emp-pessoa-topo">
        <h3>
          {todas.length} {todas.length === 1 ? 'empresa' : 'empresas'}
          {porDep('contabil') > 0 && porDep('fiscal') > 0 && <span className="fraco"> · {porDep('fiscal')} no Fiscal, {porDep('contabil')} no Contábil</span>}
        </h3>
        {todas.length > 8 && (
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar" aria-label="Buscar empresa" value={busca} onChange={e => setBusca(e.target.value)} />
          </label>
        )}
        <button type="button" className="btn btn-outline" onClick={() => setTrocando(true)}><Icone nome="repeat" />Trocar empresas</button>
      </div>
      {!todas.length && <ConfigLinha titulo="Nenhuma empresa" descricao="Quando você for o responsável de uma empresa no Fiscal ou no Contábil, ela aparece aqui." />}
      {todas.length > 0 && !lista.length && <ConfigLinha titulo={'Nada com "' + busca + '"'} />}
      {lista.length > 0 && (
        <ul className="emp-pessoa-lista">
          {lista.map(({ linha: l, dep }) => {
            const t = l.transferencias[dep];
            const falta = t ? vm.faltam(t) : [];
            const souEu = falta.some(n => vm.igual(n, vm.eu));
            return (
              <li key={l.chave + dep} className={t ? 'emp-pessoa-transf' : undefined}>
                <span className="emp-pessoa-cod num fraco">{l.codigo ?? ''}</span>
                <span className="emp-pessoa-nome" title={l.nome}>{l.nome}</span>
                {dep === 'contabil' && <span className="badge badge-neutral">Contábil</span>}
                {t && <span className="badge badge-warn" title={'Falta o aceite de ' + falta.join(' e ')}><Icone nome="repeat" />{vm.igual(t.de, pessoa) ? '→ ' + t.para : '← ' + t.de}</span>}
                {t && (
                  <span className="emp-pessoa-acoes">
                    {souEu && <button type="button" className="btn btn-primary" onClick={() => vm.responder(l.nome, l.codigo, dep, true)}>Aceitar</button>}
                    {souEu && <button type="button" className="btn" onClick={() => vm.responder(l.nome, l.codigo, dep, false)}>Recusar</button>}
                    {(vm.igual(t.pedidoPor, vm.eu) || vm.admin) && <button type="button" className="btn btn-ghost" onClick={() => vm.cancelar(l.nome, l.codigo, dep)}>Cancelar</button>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {trocando && <JanelaDeTroca vm={vm} pessoa={vm.nomeNaLista(pessoa)} fechar={() => setTrocando(false)} />}
    </div>
  );
}

/** As empresas sem responsável num departamento, para escolher direto quem cuida (a janela Empresas por responsável). */
export function EmpresasSemResponsavel({ vm }: { vm: VmEmpresasPorResponsavel }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  return (
    <div className="emp-pessoa">
      <div className="emp-pessoa-topo">
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar empresa" aria-label="Buscar empresa" value={busca} onChange={e => setBusca(e.target.value)} />
        </label>
      </div>
      {vm.departamentos.map(d => {
        const todas = vm.semResponsavel(d.id);
        const lista = todas.filter(l => !q || l.nome.toLowerCase().includes(q) || String(l.codigo ?? '').includes(q));
        if (!todas.length) return null;
        return (
          <section key={d.id} className="emp-sem">
            <p className="pessoal-grupo">{d.rotulo} ({todas.length})</p>
            <ul className="emp-pessoa-lista">
              {lista.slice(0, 60).map(l => (
                <li key={l.chave}>
                  <span className="emp-pessoa-cod num fraco">{l.codigo ?? ''}</span>
                  <span className="emp-pessoa-nome" title={l.nome}>{l.nome}</span>
                  <MenuSuspenso rotulo="Escolher" icone="usuario" className="btn btn-outline" titulo={'Responsável no ' + d.rotulo} direita largura={220} flutuante
                    itens={vm.opcoes[d.id].map(n => ({ rotulo: <PessoaComFoto nome={n} {...vm.fotoDe(n)} />, onClick: () => vm.definir(l.nome, l.codigo, d.id, n) }))} />
                </li>
              ))}
            </ul>
            {lista.length > 60 && <p className="hint">60 de {lista.length}</p>}
          </section>
        );
      })}
    </div>
  );
}
