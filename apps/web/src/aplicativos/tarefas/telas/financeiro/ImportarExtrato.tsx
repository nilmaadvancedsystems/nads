// Financeiro › Importar extrato (23/10/2026: "a parte de conciliação não vai existir, ela vai se tornar um importador de
// extrato que vai trazer os dados e informações para o dashboard inicial"): o arquivo na barra; a conta do extrato (o
// logo do banco e o número, conferida com as contas da Nilma no Cadastro; de outro titular ou fora do Cadastro, não
// importa); a prévia (os números, as linhas, as que já estavam) e Importar; embaixo, as importações feitas (o logo, o
// período e os totais), cada uma abrindo o extrato numa janela, com o Desfazer. O que se importa vai para o Painel, à
// parte do Caixa. Só as peças do catálogo (CampoArquivo, LogoBanco, MenuSuspenso, Stat, Cartão, Tabela, janela, Vazio).
import { BotaoFechar, CampoArquivo, Icone, LogoBanco, MenuSuspenso, Stat, useCarregando, useJanela, Vazio } from '@nads/ui';
import { useRef } from 'react';
import { useImportarExtrato } from './useImportarExtrato';

type Vm = ReturnType<typeof useImportarExtrato>;
type LinhaDaTela = { id: string; data: string; historico: string; valor: string; entrada: boolean; ja?: boolean };

function TabelaDoExtrato({ linhas, marcarJa }: { linhas: LinhaDaTela[]; marcarJa?: boolean }) {
  return (
    <div className="table-wrap fin-extrato-linhas">
      <table className="table-compact">
        <thead><tr><th>Data</th><th>Histórico</th><th className="num">Valor</th>{marcarJa && <th />}</tr></thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.id} className={marcarJa && l.ja ? 'fraco' : undefined}>
              <td className="num">{l.data}</td>
              <td><span className="fin-corta" title={l.historico}>{l.historico}</span></td>
              <td className={'num ' + (l.entrada ? 'fin-valor-entrada' : 'fin-valor-saida')}>{l.entrada ? '+' : '−'}{l.valor}</td>
              {marcarJa && <td>{l.ja && <span className="badge badge-neutral">já importada</span>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** o extrato importado numa janela flutuante (23/10/2026: "quando eu clicar no extrato do mês ele abra em uma janela flutuante") */
function JanelaDoExtrato({ vm }: { vm: Vm }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fecharJanela, !!vm.aberta);
  const a = vm.aberta;
  if (!a) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) vm.fecharJanela(); }}>
      <div ref={janela} className="modal registro-novo fin-extrato-janela" role="dialog" aria-modal="true" aria-label={'Extrato ' + a.banco + ' ' + a.periodo}>
        <header className="registro-topo">
          <span className="registro-caminho"><span className="fin-logo" aria-hidden="true"><LogoBanco banco={a.marca} cor /></span><b>{a.banco}</b>{a.conta && <span className="fraco">{a.conta}</span>}</span>
          <BotaoFechar onClick={vm.fecharJanela} />
        </header>
        <div className="registro-corpo">
          <p className="hint">{a.periodo} · {a.arquivo} · importado em {a.quando}{a.quem ? ' por ' + a.quem : ''}</p>
          <div className="stat-grid fin-numeros fin-extrato-numeros">
            <Stat rotulo="Lançamentos" valor={String(a.quantos)} grande={false} />
            <Stat rotulo="Entradas" valor={a.entradas} cor="entrada" grande={false} />
            <Stat rotulo="Saídas" valor={a.saidas} cor="saida" grande={false} />
            <Stat rotulo="Saldo no fim" valor={a.saldoFinal ?? '—'} grande={false} />
          </div>
          {a.linhas.length ? <TabelaDoExtrato linhas={a.linhas} /> : <p className="fraco">Nenhum lançamento novo nesta importação (todos já estavam importados antes).</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className={'btn ' + (vm.desfazendo === a.id ? 'btn-primary' : 'btn-outline')} onClick={() => void vm.desfazer(a.id)}>
            {vm.desfazendo === a.id ? 'Confirmar: desfazer a importação' : 'Desfazer a importação'}
          </button>
          <button type="button" className="btn btn-primary" onClick={vm.fecharJanela}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export function ImportarExtrato() {
  const vm = useImportarExtrato();
  useCarregando(vm.carregando || vm.lendo);
  const p = vm.previa;
  return (
    <section className="fin-painel">
      <JanelaDoExtrato vm={vm} />
      <div className="tarefas-barra-topo fin-barra">
        <span className="fin-conc-arquivo"><CampoArquivo arquivo={vm.arquivo} onEscolher={f => void vm.escolher(f)} aceitar=".pdf,.ofx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png" /></span>
        {vm.conta && (
          <span className="fin-conta" title={vm.conta.identificada ? 'Identificada no extrato e conferida com o Cadastro' : 'Escolhida'}>
            <span className="fin-logo" aria-hidden="true"><LogoBanco banco={vm.conta.marca} cor /></span>
            <b>{vm.conta.nome}</b><span className="fraco">{vm.conta.rotulo}</span>
            {vm.conta.identificada && <Icone nome="checkCircle" width={16} height={16} className="fin-conta-ok" />}
          </span>
        )}
        {vm.semTexto && vm.contas.length > 0 && (
          <MenuSuspenso rotulo={vm.conta ? 'Trocar a conta' : 'Escolher a conta'} icone="landmark" titulo="De qual conta da Nilma é este arquivo" largura={300}
            itens={vm.contas.map(c => ({ rotulo: c.nome + (c.rotulo ? ' · ' + c.rotulo : ''), marcado: c.id === vm.escolhida, onClick: () => vm.escolherConta(c.id) }))} />
        )}
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-outline" onClick={vm.abrirContas}><Icone nome="landmark" />Contas bancárias</button>
        <button type="button" className="btn btn-outline" onClick={vm.verNoPainel}><Icone nome="barChart" />Ver no Painel</button>
      </div>
      {vm.erroDoBanco && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erroDoBanco}</p>}
      {vm.lendo && <p className="registro-dica"><span className="btn-spinner" aria-hidden="true" />Lendo o extrato…</p>}
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {vm.bloqueio && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.bloqueio}</p>}

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
            <TabelaDoExtrato linhas={p.linhas} marcarJa />
            {p.mais > 0 && <p className="hint">e mais {p.mais} linhas…</p>}
            <div className="modal-actions fin-extrato-acoes">
              <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={vm.gravando || !p.novas} onClick={() => void vm.importar()}>
                <Icone nome="download" />{vm.gravando ? 'Importando…' : p.novas ? 'Importar ' + p.novas + (p.novas === 1 ? ' lançamento' : ' lançamentos') : 'Nada novo'}
              </button>
            </div>
          </div>
        </>
      ) : !vm.lendo && !vm.erro && !vm.bloqueio && (
        <Vazio icone="fileUp" titulo="Escolha o extrato do banco" texto="PDF, OFX, planilha ou foto. O nads confere de quem é a conta (só as da Nilma, cadastradas em Contas bancárias) e leva as entradas, as saídas e o saldo do banco para o Painel, à parte do Caixa. Importar o mesmo extrato de novo não duplica. O arquivo não fica guardado." />
      )}

      <div className="card">
        <h3>Extratos importados</h3>
        {vm.importacoes.length ? (
          <div className="table-wrap">
            <table className="table-compact fin-importacoes-tabela">
              <thead><tr><th>Banco</th><th>Período</th><th className="num">Lançamentos</th><th className="num">Entradas</th><th className="num">Saídas</th></tr></thead>
              <tbody>
                {vm.importacoes.map(i => (
                  <tr key={i.id} className="linha-abre" tabIndex={0} title="Abrir o extrato" onClick={() => vm.abrir(i.id)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(i.id); }}>
                    <td>
                      <span className="fin-conta">
                        <span className="fin-logo" aria-hidden="true"><LogoBanco banco={i.marca} cor /></span>
                        <span className="sr-only">{i.banco}</span>
                        {i.conta && <span className="fraco">{i.conta}</span>}
                      </span>
                    </td>
                    <td className="num">{i.periodo}</td>
                    <td className="num">{i.quantos}</td>
                    <td className="num fin-valor-entrada">{i.entradas}</td>
                    <td className="num fin-valor-saida">{i.saidas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="fraco">Nenhum extrato importado ainda.</p>}
      </div>
    </section>
  );
}
