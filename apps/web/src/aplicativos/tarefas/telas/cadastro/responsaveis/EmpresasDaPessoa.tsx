// As empresas de uma pessoa (Vitor, 07/10/2026): a lista de que ela cuida no Fiscal e no Contábil, cada uma com o botão
// Transferir (escolhe para quem; vale com o aceite do emitente e do destinatário). Uma transferência em andamento mostra
// de quem para quem, quem falta aceitar e o Aceitar / Recusar / Cancelar de quem pode. Usada na janela Empresas por
// responsável, no tópico Empresas do usuário e no Minhas empresas da Minha página.
import { Esqueleto, Icone, MenuSuspenso } from '@nads/ui';
import { useState } from 'react';
import { useEmpresasPorResponsavel, type VmEmpresasPorResponsavel } from './useEmpresasPorResponsavel';

export function EmpresasDaPessoa({ pessoa, vm: vmDeFora }: { pessoa: string; vm?: VmEmpresasPorResponsavel }) {
  const proprio = useEmpresasPorResponsavel();
  const vm = vmDeFora || proprio;
  const [busca, setBusca] = useState('');
  if (vm.carregando) return <Esqueleto linhas={6} />;
  const q = busca.trim().toLowerCase();
  const lista = vm.empresasDe(pessoa).filter(x => !q || x.linha.nome.toLowerCase().includes(q) || String(x.linha.codigo ?? '').includes(q));
  const total = vm.empresasDe(pessoa).length;
  if (!total) return <p className="hint emp-pessoa-vazio">{pessoa} ainda não é responsável por nenhuma empresa.</p>;
  return (
    <div className="emp-pessoa">
      {total > 8 && (
        <label className="busca-curta emp-pessoa-busca">
          <Icone nome="search" />
          <input type="text" placeholder={'Buscar nas ' + total + ' empresas'} aria-label="Buscar empresa" value={busca} onChange={e => setBusca(e.target.value)} />
        </label>
      )}
      <ul className="emp-pessoa-lista">
        {lista.map(({ linha: l, dep, rotulo }) => {
          const t = l.transferencias[dep];
          const atual = l.atual[dep];
          const falta = t ? vm.faltam(t) : [];
          const souEu = falta.some(n => vm.igual(n, vm.eu));
          const outros = vm.opcoes[dep].filter(n => !vm.igual(n, atual));
          return (
            <li key={l.chave + dep} className={t ? 'emp-pessoa-transf' : undefined}>
              <span className="emp-pessoa-cod num fraco">{l.codigo ?? ''}</span>
              <span className="emp-pessoa-nome">
                <b>{l.nome}</b>
                <span className="hint">
                  {rotulo} · {l.regime}{l.daPlanilha[dep] ? ' · da planilha' : ''}
                  {t && <> · <Icone nome="repeat" className="emp-pessoa-ic" />{t.de} → {t.para}, falta o aceite de {falta.join(' e ')}</>}
                </span>
              </span>
              <span className="emp-pessoa-acoes">
                {t ? (
                  <>
                    {souEu && <button type="button" className="btn btn-primary" onClick={() => vm.responder(l.nome, l.codigo, dep, true)}><Icone nome="check" />Aceitar</button>}
                    {souEu && <button type="button" className="btn" onClick={() => vm.responder(l.nome, l.codigo, dep, false)}>Recusar</button>}
                    {(vm.igual(t.pedidoPor, vm.eu) || vm.admin) && <button type="button" className="btn btn-ghost" onClick={() => vm.cancelar(l.nome, l.codigo, dep)}>Cancelar</button>}
                  </>
                ) : (
                  <MenuSuspenso rotulo="Transferir" icone="repeat" className="btn btn-outline" titulo={'Transferir no ' + rotulo + ' para'} direita
                    itens={outros.length ? outros.map(n => ({ rotulo: n, icone: 'usuario' as const, onClick: () => vm.transferir(l.nome, l.codigo, dep, atual, n) }))
                      : [{ rotulo: 'Ninguém mais no ' + rotulo, icone: 'usuario' as const, desabilitado: true, onClick: () => {} }]} />
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {!lista.length && <p className="hint">Nenhuma com "{busca}".</p>}
    </div>
  );
}

/** As empresas sem responsável num departamento, para escolher direto quem cuida (a janela Empresas por responsável). */
export function EmpresasSemResponsavel({ vm }: { vm: VmEmpresasPorResponsavel }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  return (
    <div className="emp-pessoa">
      <label className="busca-curta emp-pessoa-busca">
        <Icone nome="search" />
        <input type="text" placeholder="Buscar empresa" aria-label="Buscar empresa" value={busca} onChange={e => setBusca(e.target.value)} />
      </label>
      {vm.departamentos.map(d => {
        const lista = vm.semResponsavel(d.id).filter(l => !q || l.nome.toLowerCase().includes(q) || String(l.codigo ?? '').includes(q));
        return (
          <section key={d.id} className="emp-sem">
            <p className="pessoal-grupo">Sem responsável no {d.rotulo} ({vm.semResponsavel(d.id).length})</p>
            <ul className="emp-pessoa-lista">
              {lista.slice(0, 60).map(l => (
                <li key={l.chave}>
                  <span className="emp-pessoa-cod num fraco">{l.codigo ?? ''}</span>
                  <span className="emp-pessoa-nome"><b>{l.nome}</b><span className="hint">{l.regime}</span></span>
                  <span className="emp-pessoa-acoes">
                    <select className="pessoal-select" value="" aria-label={'Responsável ' + d.rotulo + ' de ' + l.nome} onChange={e => vm.definir(l.nome, l.codigo, d.id, e.target.value)}>
                      <option value="">Escolher…</option>
                      {vm.opcoes[d.id].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </span>
                </li>
              ))}
            </ul>
            {lista.length > 60 && <p className="hint">Mostrando 60 de {lista.length}: busque pelo nome.</p>}
          </section>
        );
      })}
    </div>
  );
}
