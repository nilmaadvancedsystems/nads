// Financeiro › Importar extrato (23/10/2026: "a parte de conciliação não vai existir, ela vai se tornar um importador de
// extrato que vai trazer os dados e informações para o dashboard inicial"): o banco (Sicoob ou Efí) e o arquivo na barra; a prévia do
// extrato lido (os números, as linhas, as que já estavam) e Importar; embaixo, as importações feitas, cada uma numa faixa que abre com os lançamentos dela e o Desfazer. O que
// se importa vai para o Painel (as entradas, as saídas e o saldo do banco), à parte do Caixa. Só as peças do catálogo
// (Segmentado, CampoArquivo, Stat, Cartão, Tabela, badge, Vazio).
import { CampoArquivo, Icone, Segmentado, Stat, useCarregando, Vazio } from '@nads/ui';
import { FaixaQueAbre } from '../../../../comum/FaixaQueAbre';
import { useImportarExtrato } from './useImportarExtrato';

export function ImportarExtrato() {
  const vm = useImportarExtrato();
  useCarregando(vm.carregando || vm.lendo);
  const p = vm.previa;
  return (
    <section className="fin-painel">
      <div className="tarefas-barra-topo fin-barra">
        <Segmentado valor={vm.banco} opcoes={vm.bancos} onMudar={vm.setBanco} />
        <span className="fin-conc-arquivo"><CampoArquivo arquivo={vm.arquivo} onEscolher={f => void vm.escolher(f)} aceitar=".pdf,.ofx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png" /></span>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-outline" onClick={vm.verNoPainel}><Icone nome="barChart" />Ver no Painel</button>
      </div>
      {vm.erroDoBanco && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erroDoBanco}</p>}
      {vm.lendo && <p className="registro-dica"><span className="btn-spinner" aria-hidden="true" />Lendo o extrato…</p>}
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {p ? (
        <>
          <div className="stat-grid fin-numeros">
            <Stat rotulo="Lançamentos" valor={String(p.quantas)} />
            <Stat rotulo="Entradas" valor={p.entradas} cor="entrada" />
            <Stat rotulo="Saídas" valor={p.saidas} cor="saida" />
            <Stat rotulo="Saldo no fim" valor={p.saldoFinal ?? '—'} />
          </div>
          <div className="card">
            <h3>
              <span>{p.arquivo} · {p.periodo}</span>
              {p.repetidas > 0 && <span className="badge badge-neutral">{p.repetidas} já {p.repetidas === 1 ? 'estava importada' : 'estavam importadas'}</span>}
            </h3>
            {vm.ocr && <p className="registro-dica"><Icone nome="alert" />Lido pela imagem (OCR): confira os valores antes de importar.</p>}
            <div className="table-wrap fin-extrato-linhas">
              <table className="table-compact">
                <thead><tr><th>Data</th><th>Histórico</th><th className="num">Valor</th><th /></tr></thead>
                <tbody>
                  {p.linhas.map(l => (
                    <tr key={l.id} className={l.ja ? 'fraco' : undefined}>
                      <td className="num">{l.data}</td>
                      <td><span className="fin-corta" title={l.historico}>{l.historico}</span></td>
                      <td className={'num ' + (l.entrada ? 'fin-valor-entrada' : 'fin-valor-saida')}>{l.entrada ? '+' : '−'}{l.valor}</td>
                      <td>{l.ja && <span className="badge badge-neutral">já importada</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {p.mais > 0 && <p className="hint">e mais {p.mais} linhas…</p>}
            <div className="modal-actions fin-extrato-acoes">
              <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={vm.gravando || !p.novas} onClick={() => void vm.importar()}>
                <Icone nome="download" />{vm.gravando ? 'Importando…' : p.novas ? 'Importar ' + p.novas + (p.novas === 1 ? ' lançamento' : ' lançamentos') : 'Nada novo'}
              </button>
            </div>
          </div>
        </>
      ) : !vm.lendo && !vm.erro && (
        <Vazio icone="fileUp" titulo="Escolha o extrato do banco" texto="PDF, OFX, planilha ou foto. O nads lê os lançamentos e leva as entradas, as saídas e o saldo do banco para o Painel, à parte do Caixa. Importar o mesmo extrato de novo não duplica. O arquivo não fica guardado." />
      )}

      <div className="card">
        <h3>Extratos importados</h3>
        {vm.importacoes.length ? (
          // cada extrato numa faixa que abre com os lançamentos dele (23/10/2026: "queria ter os detalhes")
          <div className="fin-importacoes">
            {vm.importacoes.map(i => (
              <FaixaQueAbre key={i.id} titulo={i.banco + ' · ' + i.periodo} qtd={i.quantos}
                acoes={<>
                  <span className="fin-importacao-resumo num"><span className="fin-valor-entrada">+{i.entradas}</span> <span className="fin-valor-saida">−{i.saidas}</span></span>
                  <button type="button" className={'btn btn-sm ' + (vm.desfazendo === i.id ? 'btn-primary' : 'btn-ghost')} onClick={() => void vm.desfazer(i.id)}>
                    {vm.desfazendo === i.id ? 'Confirmar' : 'Desfazer'}
                  </button>
                </>}>
                <p className="hint">{i.arquivo} · importado em {i.quando}{i.quem ? ' por ' + i.quem : ''}{i.saldoFinal ? ' · saldo no fim ' + i.saldoFinal : ''}</p>
                {i.linhas.length ? (
                  <div className="table-wrap fin-extrato-linhas">
                    <table className="table-compact">
                      <thead><tr><th>Data</th><th>Histórico</th><th className="num">Valor</th></tr></thead>
                      <tbody>
                        {i.linhas.map(l => (
                          <tr key={l.id}>
                            <td className="num">{l.data}</td>
                            <td><span className="fin-corta" title={l.historico}>{l.historico}</span></td>
                            <td className={'num ' + (l.entrada ? 'fin-valor-entrada' : 'fin-valor-saida')}>{l.entrada ? '+' : '−'}{l.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="fraco">Nenhum lançamento novo nesta importação (todos já estavam importados antes).</p>}
              </FaixaQueAbre>
            ))}
          </div>
        ) : <p className="fraco">Nenhum extrato importado ainda.</p>}
      </div>
    </section>
  );
}
