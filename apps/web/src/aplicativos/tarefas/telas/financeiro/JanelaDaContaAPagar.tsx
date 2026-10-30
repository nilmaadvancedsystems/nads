// A janela da conta a pagar (28/10/2026: "o Contas a Pagar do Toriba, no nads"), em painéis laterais como a do Usuário: à
// esquerda o ID, o fornecedor, o valor e a situação, e os tópicos do formulário do Toriba (Conta, Pagamento, Observações,
// Anexos e Auditor); à direita o tópico, em cartões com uma opção por linha. No pé, Excluir, Cancelar e Gravar (a barra do
// Toriba: o Incluir é o "Nova conta" da lista; o Atualizar não faz falta, a lista é ao vivo).
import { financeiro, formatos } from '@nads/core';
import { BotaoAcao, CampoArquivos, CampoData, Icone, Interruptor } from '@nads/ui';
import { Cartao, JanelaLateral, Linha, type TopicoDaJanela } from '../janela/JanelaLateral';
import { dataBr } from './formatosDaNota';
import { ACEITA_NO_ANEXO, useJanelaDaContaAPagar, type TopicoDaContaAPagar, type VmJanelaDaContaAPagar } from './useJanelaDaContaAPagar';

const TOM: Record<financeiro.SituacaoDaConta, string> = { aberta: 'badge-warn', vencida: 'badge-bad', paga: 'badge-ok' };

function SeloDaSituacao({ s }: { s: financeiro.SituacaoDaConta | null }) {
  return s ? <span className={'badge ' + TOM[s]}>{financeiro.rotuloDaSituacao(s)}</span> : <span className="badge badge-neutral">Nova</span>;
}

function TopicoConta({ vm }: { vm: VmJanelaDaContaAPagar }) {
  const travada = vm.paga;
  return (
    <>
      <Cartao titulo="Conta">
        {travada && <p className="hint cp-dica">A conta está paga: para mudar os dados, desfaça o pagamento primeiro.</p>}
        <Linha rotulo="ID">{vm.existente ? <span className="num">{vm.existente.numero}</span> : <span className="fraco">Sai ao gravar</span>}</Linha>
        <Linha rotulo="Status" dica={vm.parcela || undefined}><SeloDaSituacao s={vm.situacao} /></Linha>
        <Linha rotulo="Fornecedor">
          <select className="pessoal-select cp-campo" value={vm.fornecedorId} disabled={travada} onChange={e => vm.escolherFornecedor(e.target.value)} aria-label="Fornecedor">
            <option value="">Escolha…</option>
            {vm.fornecedores.filter(f => f.ativo || f.id === vm.fornecedorId).map(f => <option key={f.id} value={f.id}>{financeiro.nomeDoFornecedor(f)}</option>)}
          </select>
          {!travada && !vm.cadastrando && <button type="button" className="btn btn-outline" onClick={() => vm.setCadastrando(true)} title="Cadastrar um fornecedor novo"><Icone nome="plus" />Novo</button>}
        </Linha>
        {vm.cadastrando && (
          <div className="cp-novo-fornecedor">
            <Linha rotulo="Razão social"><input className="usuario-campo cp-campo" type="text" value={vm.novoRazao} onChange={e => vm.setNovoRazao(e.target.value)} aria-label="Razão social do fornecedor novo" autoFocus /></Linha>
            <Linha rotulo="Nome fantasia"><input className="usuario-campo cp-campo" type="text" value={vm.novoFantasia} onChange={e => vm.setNovoFantasia(e.target.value)} aria-label="Nome fantasia do fornecedor novo" /></Linha>
            <Linha rotulo="CNPJ ou CPF"><input className="usuario-campo cp-campo" type="text" inputMode="numeric" value={vm.novoDocumento} onChange={e => vm.setNovoDocumento(e.target.value)} placeholder="Opcional" aria-label="CNPJ ou CPF do fornecedor novo" /></Linha>
            <Linha rotulo="">
              <button type="button" className="btn btn-outline" onClick={() => vm.setCadastrando(false)}>Cancelar</button>
              <BotaoAcao className="btn btn-primary" carregando={vm.fazendo === 'fornecedor'} textoCarregando="Cadastrando…" onClick={() => void vm.cadastrarFornecedor()}><Icone nome="check" />Cadastrar</BotaoAcao>
            </Linha>
          </div>
        )}
        <Linha rotulo="Conta contábil">
          <select className="pessoal-select cp-campo" value={vm.conta} disabled={travada} onChange={e => vm.setConta(e.target.value)} aria-label="Conta contábil">
            <option value="">Sem conta</option>
            {vm.contas.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.descricao}</option>)}
          </select>
        </Linha>
        <Linha rotulo="Documento"><input className="usuario-campo cp-campo" type="text" value={vm.documento} disabled={travada} onChange={e => vm.setDocumento(e.target.value)} placeholder="Nº da nota ou do boleto" aria-label="Documento" /></Linha>
        <Linha rotulo="Emissão">{travada ? <span>{vm.emissao || '—'}</span> : <CampoData valor={vm.emissao} onMudar={vm.setEmissao} rotulo="Data de emissão" />}</Linha>
        <Linha rotulo="Vencimento">{travada ? <span>{vm.vencimento}</span> : <CampoData valor={vm.vencimento} onMudar={vm.setVencimento} rotulo="Vencimento" />}</Linha>
        <Linha rotulo="Valor"><input className="usuario-campo cp-campo-curto" type="text" inputMode="decimal" value={vm.valor} disabled={travada} onChange={e => vm.setValor(e.target.value)} placeholder="0,00" aria-label="Valor" /></Linha>
        <Linha rotulo="Linha digitável">
          <input className="usuario-campo cp-campo-linha" type="text" inputMode="numeric" value={vm.linha} disabled={travada} onChange={e => vm.setLinha(e.target.value)} onBlur={vm.lerLinhaDigitada} placeholder="Opcional" aria-label="Linha digitável" />
        </Linha>
        {!travada && (
          <Linha rotulo="Boleto">
            {vm.lendo ? <span className="fraco"><span className="btn-spinner" aria-hidden="true" />Lendo o boleto…</span>
              : <CampoArquivos id="cp-boleto" aceitar={ACEITA_NO_ANEXO} rotulo="Escolher o boleto" onEscolher={fs => void vm.escolherBoleto(fs[0])} />}
          </Linha>
        )}
        {vm.boleto && <p className="hint cp-dica"><Icone nome="clipe" />{vm.boleto.nome} · sobe ao gravar <button type="button" className="link-btn" onClick={() => void vm.escolherBoleto(null)}>Tirar</button></p>}
        {vm.leitura && <p className="hint cp-dica"><Icone nome="codigoBarras" />{vm.leitura}</p>}
      </Cartao>
      {vm.novo && (
        <Cartao titulo="Recorrência">
          <Linha rotulo="Despesa recorrente">
            <Interruptor ligado={vm.recorrente} onMudar={() => vm.setRecorrente(!vm.recorrente)} rotulo="Despesa recorrente" />
          </Linha>
          {vm.recorrente && (
            <Linha rotulo="Quantidade de recorrência" dica={vm.previaDaRecorrencia() || 'De 2 a ' + financeiro.MAX_PARCELAS + '.'}>
              <input className="usuario-campo cp-campo-curto" type="number" min={2} max={financeiro.MAX_PARCELAS} value={vm.quantidade} onChange={e => vm.setQuantidade(e.target.value)} aria-label="Quantidade de recorrência" />
            </Linha>
          )}
        </Cartao>
      )}
    </>
  );
}

function TopicoPagamento({ vm }: { vm: VmJanelaDaContaAPagar }) {
  const p = vm.existente?.pagamento;
  if (!vm.existente) return <Cartao titulo="Pagamento"><Linha rotulo="Grave a conta primeiro" /></Cartao>;
  if (p) {
    return (
      <Cartao titulo="Pagamento">
        <Linha rotulo="Pago em">{dataBr(p.data)}</Linha>
        <Linha rotulo="Valor pago"><span className="num">{formatos.reais(p.valorPago)}</span></Linha>
        {p.juros > 0 && <Linha rotulo="Juros"><span className="num">{formatos.reais(p.juros)}</span></Linha>}
        {p.desconto > 0 && <Linha rotulo="Desconto"><span className="num">{formatos.reais(p.desconto)}</span></Linha>}
        {p.lancamentoId && <Linha rotulo="No Caixa"><span className="badge badge-ok">Saída lançada</span></Linha>}
        <Linha rotulo="Comprovante">
          <CampoArquivos id="cp-comprovante-pago" aceitar={ACEITA_NO_ANEXO} rotulo="Escolher o comprovante" onEscolher={fs => void vm.escolherComprovante(fs[0])} />
        </Linha>
        <Linha rotulo="Desfazer o pagamento" dica={p.lancamentoId ? 'A conta volta a ficar em aberto e a saída sai do Caixa.' : 'A conta volta a ficar em aberto.'}>
          <BotaoAcao className="btn btn-outline btn-danger" carregando={vm.fazendo === 'desfazer'} textoCarregando="Desfazendo…" onClick={() => void vm.desfazerPagamento()}><Icone nome="repeat" />Desfazer</BotaoAcao>
        </Linha>
      </Cartao>
    );
  }
  return (
    <Cartao titulo="Pagamento">
      <Linha rotulo="Data do pagamento"><CampoData valor={vm.dataPg} onMudar={vm.setDataPg} rotulo="Data do pagamento" /></Linha>
      <Linha rotulo="Valor da conta"><span className="num">{formatos.reais(vm.existente.valor)}</span></Linha>
      <Linha rotulo="Juros"><input className="usuario-campo cp-campo-curto" type="text" inputMode="decimal" value={vm.juros} onChange={e => vm.setJuros(e.target.value)} placeholder="0,00" aria-label="Juros" /></Linha>
      <Linha rotulo="Desconto"><input className="usuario-campo cp-campo-curto" type="text" inputMode="decimal" value={vm.desconto} onChange={e => vm.setDesconto(e.target.value)} placeholder="0,00" aria-label="Desconto" /></Linha>
      <Linha rotulo="Valor pago">
        <input className="usuario-campo cp-campo-curto" type="text" inputMode="decimal" value={vm.valorPago} onChange={e => vm.setValorPago(e.target.value)} placeholder="0,00" aria-label="Valor pago" />
      </Linha>
      <Linha rotulo="Comprovante" dica={vm.comprovante ? vm.comprovante.nome + ' · sobe ao pagar' : undefined}>
        <CampoArquivos id="cp-comprovante" aceitar={ACEITA_NO_ANEXO} rotulo="Escolher o comprovante" onEscolher={fs => void vm.escolherComprovante(fs[0])} />
      </Linha>
      <Linha rotulo="Pagar conta">
        <BotaoAcao carregando={vm.fazendo === 'pagar'} textoCarregando="Pagando…" onClick={() => void vm.pagar()}><Icone nome="check" />Pagar conta</BotaoAcao>
      </Linha>
    </Cartao>
  );
}

function TopicoAnexos({ vm }: { vm: VmJanelaDaContaAPagar }) {
  if (!vm.existente) return <Cartao titulo="Anexos"><Linha rotulo="Grave a conta primeiro" /></Cartao>;
  return (
    <Cartao titulo="Anexos">
      {!vm.anexos.length && <Linha rotulo="Nenhum anexo" />}
      {vm.anexos.map(a => (
        <Linha key={a.id} rotulo={<span className="cp-anexo"><Icone nome="clipe" />{a.nome}</span>}
          dica={(a.tipo === 'boleto' ? 'Boleto' : 'Comprovante') + ' · ' + vm.tamanhoBr(a.tamanho) + ' · ' + a.enviadoPor + ', ' + vm.quando(a.enviadoEm)}>
          <button type="button" className="btn btn-outline" onClick={() => void vm.abrirAnexo(a)}><Icone nome="olho" />Abrir</button>
          <button type="button" className="btn btn-outline" onClick={() => void vm.baixarAnexo(a)}><Icone nome="download" />Baixar</button>
          <button type="button" className="link-btn" onClick={() => void vm.tirarAnexo(a)}>Tirar</button>
        </Linha>
      ))}
      <Linha rotulo="Anexar" dica="PDF ou foto, até 10 MB.">
        <CampoArquivos id="cp-anexar-boleto" aceitar={ACEITA_NO_ANEXO} rotulo="Boleto" desabilitado={vm.fazendo === 'anexo'} onEscolher={fs => void vm.anexarOutro(fs[0], 'boleto')} />
        <CampoArquivos id="cp-anexar-comprovante" aceitar={ACEITA_NO_ANEXO} rotulo="Comprovante" desabilitado={vm.fazendo === 'anexo'} onEscolher={fs => void vm.anexarOutro(fs[0], 'comprovante')} />
      </Linha>
    </Cartao>
  );
}

function TopicoAuditor({ vm }: { vm: VmJanelaDaContaAPagar }) {
  const c = vm.existente;
  if (!c) return <Cartao titulo="Auditor"><Linha rotulo="Lançado por">—</Linha></Cartao>;
  return (
    <Cartao titulo="Auditor">
      <Linha rotulo="Lançado por">{c.lancadoPor || '—'}</Linha>
      <Linha rotulo="Data lançamento">{vm.quando(c.lancadoEm) || '—'}</Linha>
      {c.atualizadoPor && <Linha rotulo="Alterado por" dica={vm.quando(c.atualizadoEm || '')}>{c.atualizadoPor}</Linha>}
      <Linha rotulo="Pago por">{c.pagamento?.por || '—'}</Linha>
      {c.pagamento && <Linha rotulo="Registrado em">{vm.quando(c.pagamento.em)}</Linha>}
    </Cartao>
  );
}

export function JanelaDaContaAPagar({ id, topico, fechar }: { id?: string; topico?: TopicoDaContaAPagar; fechar: () => void }) {
  const vm = useJanelaDaContaAPagar(id, topico, fechar);
  if (id && !vm.existente) return null;
  const c = vm.existente;
  const topicos: TopicoDaJanela<TopicoDaContaAPagar>[] = [
    { id: 'conta', rotulo: 'Conta', icone: 'recibo', alerta: vm.erros.length > 0 && vm.topico !== 'conta' },
    { id: 'pagamento', rotulo: 'Pagamento', icone: 'dinheiro' },
    { id: 'observacoes', rotulo: 'Observações', icone: 'mensagem' },
    { id: 'anexos', rotulo: 'Anexos', icone: 'clipe', contador: vm.anexos.length },
    { id: 'auditor', rotulo: 'Auditor', icone: 'usuario' },
  ];
  return (
    <JanelaLateral rotulo={c ? 'Conta a pagar ' + c.numero : 'Nova conta a pagar'} topicos={topicos} topico={vm.topico} mudar={vm.setTopico} fechar={fechar} classe="cp-janela"
      resumo={(
        <div className="usuario-quem">
          <span className="cp-resumo-icone" aria-hidden="true"><Icone nome="codigoBarras" /></span>
          <b>{c ? 'Conta ' + c.numero : 'Nova conta'}</b>
          <span className="fraco">{financeiro.nomeDoFornecedor(vm.fornecedor) || 'Sem fornecedor'}</span>
          <span className="num">{c ? formatos.reais(c.valor) : vm.valor ? 'R$ ' + vm.valor : '—'}</span>
          <SeloDaSituacao s={vm.situacao} />
          {vm.parcela && <span className="fraco">{vm.parcela}</span>}
          {c && <span className="fraco">vence {dataBr(c.vencimento)}</span>}
        </div>
      )}
      pe={(
        <>
          {vm.erros.length > 0 && <ul className="usuario-erros">{vm.erros.map(e => <li key={e}>{e}</li>)}</ul>}
          {c && <BotaoAcao className="btn btn-outline btn-danger" carregando={vm.fazendo === 'excluir'} textoCarregando="Excluindo…" onClick={() => void vm.excluir()}><Icone nome="lixeira" />Excluir</BotaoAcao>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <BotaoAcao carregando={vm.fazendo === 'salvar'} textoCarregando="Gravando…" onClick={() => void vm.salvar()}><Icone nome="check" />Gravar</BotaoAcao>
        </>
      )}>
      {vm.topico === 'conta' && <TopicoConta vm={vm} />}
      {vm.topico === 'pagamento' && <TopicoPagamento vm={vm} />}
      {vm.topico === 'observacoes' && (
        <Cartao titulo="Observações">
          <textarea className="nf-texto cp-observacoes" rows={8} value={vm.observacoes} onChange={e => vm.setObservacoes(e.target.value)} placeholder="Anotações da conta (opcional)" aria-label="Observações" />
        </Cartao>
      )}
      {vm.topico === 'anexos' && <TopicoAnexos vm={vm} />}
      {vm.topico === 'auditor' && <TopicoAuditor vm={vm} />}
    </JanelaLateral>
  );
}
