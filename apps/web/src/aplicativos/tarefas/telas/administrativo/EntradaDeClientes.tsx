// A Entrada de clientes do Administrativo (13/11/2026, protótipo do modo desenvolvedor). A lista das entradas (o cliente, o
// motivo, a nota de cliente ideal, a etapa) e a entrada aberta em quatro passos: 1. a ficha pré-cadastral (a entrevista),
// 2. o orçamento (o PDF e o e-mail; a resposta do cliente), 3. os documentos (cada um vai para a pasta do cliente no Drive, a
// da empresa ou a do sócio no quadro societário), 4. o cadastro (o código e os responsáveis do Fiscal, do Contábil e do DP).
// Só as peças do catálogo; o ⚡ põe uma entrada em cada etapa.
import { administrativo } from '@nads/core';
import { BotaoIcone, Icone, MenuSuspenso, Segmentado, useCarregando, Vazio } from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { useEntradaDeClientes } from './useEntradaDeClientes';

type Vm = ReturnType<typeof useEntradaDeClientes>;
type Aberta = NonNullable<Vm['aberta']>;
const e = administrativo.entrada;
const ESCOLHA = 'btn btn-ghost registro-escolha';
const SELO = { neutral: 'badge-neutral', warn: 'badge-warn', info: 'badge-info', ok: 'badge-ok' } as const;
const DA_NOTA = { ideal: 'badge-ok', bom: 'badge-info', atencao: 'badge-warn' } as const;
const numero = (v: string) => { const n = Number(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
const noCampo = (n: number) => (n ? String(n).replace('.', ',') : '');

function Cartao({ titulo, children, acao }: { titulo: string; children: ReactNode; acao?: ReactNode }) {
  return <section className="card adm-cartao"><div className="card-head"><h3>{titulo}</h3>{acao}</div>{children}</section>;
}

/** um menu de escolha (o motivo, a atividade, o regime) */
function Escolha<T extends string>({ valor, opcoes, mudar, titulo }: { valor: T; opcoes: readonly { valor: T; rotulo: string }[]; mudar: (v: T) => void; titulo: string }) {
  return <MenuSuspenso rotulo={opcoes.find(o => o.valor === valor)?.rotulo || ''} className={ESCOLHA} titulo={titulo} flutuante largura={240}
    itens={opcoes.map(o => ({ rotulo: o.rotulo, marcado: o.valor === valor, onClick: () => mudar(o.valor) }))} />;
}

// ------------------------------------------------------------------------------------------------- 1. a ficha
function Ficha({ vm, x }: { vm: Vm; x: Aberta }) {
  const f = x.ficha;
  const texto = (campo: 'contato' | 'telefone' | 'email' | 'razaoSocial' | 'cnpj' | 'cidade' | 'contabilidadeAtual', rotulo: string, ph = '') =>
    <input type="text" value={f[campo]} placeholder={ph} aria-label={rotulo} onChange={ev => vm.mudarFicha({ [campo]: ev.target.value })} />;
  const conta = (campo: 'faturamento' | 'funcionarios' | 'notasPorMes' | 'bancos', rotulo: string) =>
    <input type="text" inputMode="decimal" value={noCampo(f[campo])} placeholder="0" aria-label={rotulo} onChange={ev => vm.mudarFicha({ [campo]: numero(ev.target.value) })} />;
  return (
    <>
      <Cartao titulo="Quem procurou o escritório">
        <div className="registro-props">
          <Propriedade icone="usuario" rotulo="Nome">{texto('contato', 'Nome de quem procurou', 'Quem veio conversar')}</Propriedade>
          <Propriedade icone="telefone" rotulo="Telefone">{texto('telefone', 'Telefone', '(38) 9 0000-0000')}</Propriedade>
          <Propriedade icone="envelope" rotulo="E-mail">{texto('email', 'E-mail', 'para mandar o orçamento')}</Propriedade>
          <Propriedade icone="lampada" rotulo="O que procura"><Escolha valor={f.motivo} opcoes={e.MOTIVOS} mudar={v => vm.mudarFicha({ motivo: v })} titulo="O que o cliente procura" /></Propriedade>
        </div>
      </Cartao>
      <Cartao titulo="A empresa">
        <div className="registro-props">
          <Propriedade icone="predio" rotulo="Razão social">{texto('razaoSocial', 'Razão social', f.motivo === 'abertura' ? 'O nome que a empresa vai ter' : 'A razão social')}</Propriedade>
          {f.motivo !== 'abertura' && <Propriedade icone="hash" rotulo="CNPJ">{texto('cnpj', 'CNPJ', '00.000.000/0000-00')}</Propriedade>}
          <Propriedade icone="mapaPin" rotulo="Cidade">{texto('cidade', 'Cidade')}</Propriedade>
          <Propriedade icone="briefcase" rotulo="Atividade"><Escolha valor={f.atividade} opcoes={e.ATIVIDADES} mudar={v => vm.mudarFicha({ atividade: v })} titulo="A atividade" /></Propriedade>
          <Propriedade icone="scale" rotulo="Regime"><Escolha valor={f.regime} opcoes={e.REGIMES} mudar={v => vm.mudarFicha({ regime: v })} titulo="O regime" /></Propriedade>
          {f.motivo === 'troca' && <Propriedade icone="repeat" rotulo="Contabilidade de hoje">{texto('contabilidadeAtual', 'Contabilidade de hoje', 'Quem cuida hoje')}</Propriedade>}
        </div>
      </Cartao>
      <Cartao titulo="O tamanho do serviço">
        <div className="registro-props">
          <Propriedade icone="dinheiro" rotulo="Faturamento por mês">{conta('faturamento', 'Faturamento médio por mês (R$)')}</Propriedade>
          <Propriedade icone="usuario" rotulo="Funcionários">{conta('funcionarios', 'Quantos funcionários')}</Propriedade>
          <Propriedade icone="recibo" rotulo="Notas por mês">{conta('notasPorMes', 'Quantas notas por mês (entrada e saída)')}</Propriedade>
          <Propriedade icone="landmark" rotulo="Bancos">{conta('bancos', 'Quantas contas de banco')}</Propriedade>
        </div>
      </Cartao>
      <Cartao titulo="Quadro societário" acao={<button type="button" className="btn btn-ghost" onClick={vm.novoSocio}><Icone nome="plus" />Sócio</button>}>
        {f.socios.length ? (
          <div className="table-wrap">
            <table className="table-compact adm-socios">
              <thead><tr><th>Nome</th><th>CPF</th><th className="num">Participação (%)</th><th>Administrador</th><th aria-label="Tirar" /></tr></thead>
              <tbody>
                {f.socios.map((s, i) => (
                  <tr key={i}>
                    <td><input type="text" value={s.nome} placeholder="O nome do sócio" aria-label={'Nome do sócio ' + (i + 1)} onChange={ev => vm.mudarSocio(i, { nome: ev.target.value })} /></td>
                    <td><input type="text" value={s.cpf} placeholder="000.000.000-00" aria-label={'CPF do sócio ' + (i + 1)} onChange={ev => vm.mudarSocio(i, { cpf: ev.target.value })} /></td>
                    <td className="num"><input type="text" inputMode="decimal" value={noCampo(s.participacao)} aria-label={'Participação do sócio ' + (i + 1)} onChange={ev => vm.mudarSocio(i, { participacao: numero(ev.target.value) })} /></td>
                    <td><input type="checkbox" checked={s.administrador} aria-label={'Sócio ' + (i + 1) + ' é administrador'} onChange={ev => vm.mudarSocio(i, { administrador: ev.target.checked })} /></td>
                    <td><BotaoIcone pequeno icone="x" titulo="Tirar este sócio" onClick={() => vm.tirarSocio(i)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="hint">Os sócios, para pedir os documentos de cada um e montar o quadro societário no Drive.</p>}
      </Cartao>
      <Cartao titulo="Cliente ideal">
        <div className="adm-requisitos">
          {e.REQUISITOS_DO_CLIENTE_IDEAL.map(r => {
            const v = f.requisitos[r.id];
            return (
              <div key={r.id} className="adm-requisito">
                <span>{r.rotulo}</span>
                <Segmentado valor={v === true ? 'sim' : v === false ? 'nao' : 'nada'} onMudar={o => vm.responder(r.id, o === 'sim' ? true : o === 'nao' ? false : null)}
                  opcoes={[{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }, { valor: 'nada', rotulo: 'Não sei' }]} />
              </div>
            );
          })}
        </div>
      </Cartao>
      <Cartao titulo="Observações da conversa">
        <textarea rows={4} value={f.observacoes} placeholder="O que o cliente contou, o que ele espera do escritório" aria-label="Observações" onChange={ev => vm.mudarFicha({ observacoes: ev.target.value })} />
      </Cartao>
      <div className="adm-pe">
        {vm.problemaDaFicha && <span className="hint"><Icone nome="alert" width={14} height={14} /> {vm.problemaDaFicha}</span>}
        <span className="tarefas-barra-espaco" />
        {x.etapa === 'ficha'
          ? <button type="button" className="btn btn-primary" disabled={!!vm.problemaDaFicha} onClick={vm.fecharFicha}>Fechar a ficha e montar o orçamento<Icone nome="chevronRight" /></button>
          : <button type="button" className="btn btn-outline" onClick={() => vm.setPasso('orcamento')}>Ver o orçamento<Icone nome="chevronRight" /></button>}
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------------------- 2. o orçamento
function Orcamento({ vm, x }: { vm: Vm; x: Aberta }) {
  const o = x.orcamento;
  const [obs, setObs] = useState('');
  if (!o) return <Vazio icone="recibo" titulo="Feche a ficha para montar o orçamento" />;
  const travado = x.etapa !== 'orcamento' && x.etapa !== 'aguardando';
  return (
    <>
      <Cartao titulo="Orçamento" acao={!travado && <button type="button" className="btn btn-ghost" onClick={vm.refazerSugestao} title="Volta à sugestão feita pela ficha"><Icone nome="repeat" />Refazer pela ficha</button>}>
        <div className="table-wrap">
          <table className="table-compact adm-itens">
            <thead><tr><th>Serviço</th><th className="num">Por mês (R$)</th><th aria-label="Tirar" /></tr></thead>
            <tbody>
              {o.itens.map((i, n) => (
                <tr key={n}>
                  <td><input type="text" value={i.descricao} disabled={travado} aria-label={'Serviço ' + (n + 1)} onChange={ev => vm.mudarItem(n, { descricao: ev.target.value })} /></td>
                  <td className="num"><input type="text" inputMode="decimal" value={noCampo(i.valor)} disabled={travado} aria-label={'Valor do serviço ' + (n + 1)} onChange={ev => vm.mudarItem(n, { valor: numero(ev.target.value) })} /></td>
                  <td>{!travado && <BotaoIcone pequeno icone="x" titulo="Tirar este serviço" onClick={() => vm.tirarItem(n)} />}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td><b>Total por mês</b></td><td className="num"><b>{vm.total}</b></td><td /></tr></tfoot>
          </table>
        </div>
        {!travado && <button type="button" className="btn btn-ghost adm-mais" onClick={vm.novoItem}><Icone nome="plus" />Serviço</button>}
        <div className="registro-props">
          <Propriedade icone="dinheiro" rotulo="Taxa de entrada"><input type="text" inputMode="decimal" value={noCampo(o.implantacao)} disabled={travado} placeholder="0" aria-label="Taxa de entrada (uma vez)" onChange={ev => vm.mudarOrcamento({ implantacao: numero(ev.target.value) })} /></Propriedade>
          <Propriedade icone="calendar" rotulo="Vale por (dias)"><input type="text" inputMode="numeric" value={noCampo(o.validadeDias)} disabled={travado} aria-label="Validade do orçamento em dias" onChange={ev => vm.mudarOrcamento({ validadeDias: Math.round(numero(ev.target.value)) })} /></Propriedade>
        </div>
        <div className="field">
          <label htmlFor="adm-obs-orcamento">Observações (vão no PDF)</label>
          <textarea id="adm-obs-orcamento" rows={3} value={o.observacoes} disabled={travado} onChange={ev => vm.mudarOrcamento({ observacoes: ev.target.value })} />
        </div>
      </Cartao>
      <div className="adm-pe">
        {vm.problemaDoOrcamento && <span className="hint"><Icone nome="alert" width={14} height={14} /> {vm.problemaDoOrcamento}</span>}
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" disabled={!!vm.problemaDoOrcamento} onClick={() => void vm.baixarPdf()}><Icone nome="fileDown" />Baixar o PDF</button>
        {x.etapa === 'orcamento' && <button type="button" className="btn btn-outline" disabled={!!vm.problemaDoOrcamento} onClick={vm.marcarEnviado} title="Já mandei por outro caminho (WhatsApp, em mãos)"><Icone nome="check" />Já mandei</button>}
        {!travado && <button type="button" className="btn btn-primary" disabled={!!vm.problemaDoOrcamento || !x.ficha.email.trim()} title={x.ficha.email.trim() ? 'Baixa o PDF e abre o e-mail pronto' : 'Ponha o e-mail do cliente na ficha'} onClick={() => void vm.enviarPorEmail()}><Icone nome="envelope" />Enviar por e-mail</button>}
      </div>
      {x.etapa === 'aguardando' && (
        <Cartao titulo="A resposta do cliente">
          <p className="hint">Mandado em {x.enviadoEm ? new Date(x.enviadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}.</p>
          <div className="adm-resposta">
            <input type="text" value={obs} placeholder="Observação (opcional): o que o cliente disse" aria-label="Observação da resposta" onChange={ev => setObs(ev.target.value)} />
            <button type="button" className="btn btn-outline" onClick={() => vm.resposta(false, obs)}><Icone nome="x" />Não fechou</button>
            <button type="button" className="btn btn-primary" onClick={() => vm.resposta(true, obs)}><Icone nome="check" />Aprovou</button>
          </div>
        </Cartao>
      )}
      {x.decisao && (
        <p className={'registro-dica' + (x.decisao.aprovado ? '' : ' registro-dica-erro')}>
          <Icone nome={x.decisao.aprovado ? 'checkCircle' : 'alert'} />{x.decisao.aprovado ? 'O cliente aprovou' : 'O cliente não fechou'}{x.decisao.observacao && ': ' + x.decisao.observacao}
        </p>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------------------- 3. os documentos
function Documentos({ vm, x }: { vm: Vm; x: Aberta }) {
  const grupos = [{ titulo: 'Da empresa', docs: vm.documentos.filter(d => !d.socio) }, ...vm.socios.map(s => ({ titulo: 'Sócio: ' + s, docs: vm.documentos.filter(d => d.socio === s) }))];
  return (
    <>
      <p className="registro-dica"><Icone nome="pasta" />A pasta do cliente no Drive: <b>{vm.pasta}</b>. Cada documento vai para a pasta dele (a da empresa ou a do sócio, no quadro societário). No protótipo, os arquivos ficam só neste navegador.</p>
      {grupos.map(g => (
        <Cartao key={g.titulo} titulo={g.titulo}>
          {g.docs.length ? g.docs.map(d => (
            <div key={d.id} className="adm-doc">
              <div className="adm-doc-nome"><b>{d.rotulo}</b>{d.obrigatorio && <span className="fraco"> · obrigatório</span>}<br /><span className="hint"><Icone nome="pastaAberta" width={12} height={12} /> {d.destino}</span></div>
              {d.recebido ? (
                <span className="adm-doc-recebido">
                  <Icone nome="checkCircle" width={14} height={14} />
                  <button type="button" className="ini-abrir" onClick={() => vm.baixar(d.id)} title="Baixar">{d.recebido.nome}</button>
                  <span className="hint">{d.recebido.detalhe}</span>
                  {x.etapa === 'documentos' && <BotaoIcone pequeno icone="x" titulo="Tirar o arquivo" onClick={() => vm.tirar(d.id)} />}
                </span>
              ) : x.etapa === 'documentos' ? (
                <label className="btn btn-outline" title={'Anexar: ' + d.rotulo}>
                  <Icone nome="clipe" />Anexar
                  <input type="file" className="sr-only" onChange={ev => { const a = ev.target.files?.[0]; ev.target.value = ''; if (a) void vm.guardar(d.id, a); }} />
                </label>
              ) : <span className="hint">Não veio</span>}
            </div>
          )) : <p className="hint">Nenhum documento para pedir aqui.</p>}
        </Cartao>
      ))}
      {!vm.socios.length && <p className="hint">Sem sócios na ficha: ponha o quadro societário no passo 1 para pedir os documentos de cada um.</p>}
      {x.etapa === 'documentos' && (
        <div className="adm-pe">
          {vm.faltam > 0 && <span className="hint"><Icone nome="alert" width={14} height={14} /> Faltam {vm.faltam} {vm.faltam === 1 ? 'documento obrigatório' : 'documentos obrigatórios'}.</span>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-primary" onClick={vm.paraOCadastro}>Ir para o cadastro<Icone nome="chevronRight" /></button>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------------------- 4. o cadastro
function Cadastro({ vm, x }: { vm: Vm; x: Aberta }) {
  const [c, setC] = useState<administrativo.entrada.Cadastro>(() => x.cadastro || {
    codigo: vm.codigoSugerido, razaoSocial: x.ficha.razaoSocial, cnpj: x.ficha.cnpj, regime: x.ficha.regime, fiscal: null, contabil: null, dp: null,
  });
  const feito = x.etapa === 'concluida';
  const problema = feito ? '' : vm.problemaDoCadastro(c);
  const pessoa = (valor: { uid: string; nome: string } | null, lista: { uid: string; nome: string }[], mudar: (p: { uid: string; nome: string }) => void, titulo: string) =>
    feito ? <span>{valor?.nome || '—'}</span> : (
      <MenuSuspenso rotulo={valor?.nome || 'Escolher'} className={ESCOLHA + (valor ? '' : ' vazio')} titulo={titulo} flutuante largura={240}
        itens={lista.length ? lista.map(p => ({ rotulo: p.nome, marcado: p.uid === valor?.uid, onClick: () => mudar(p) })) : [{ rotulo: 'Ninguém neste setor', desabilitado: true, onClick: () => undefined }]} />
    );
  return (
    <>
      <Cartao titulo={feito ? 'Cliente cadastrado' : 'O cadastro do cliente'}>
        <div className="registro-props">
          <Propriedade icone="hash" rotulo="Código">{feito ? <b>{c.codigo}</b> : <input type="text" inputMode="numeric" value={c.codigo || ''} aria-label="O código do cliente" onChange={ev => setC({ ...c, codigo: Math.round(numero(ev.target.value)) })} />}</Propriedade>
          <Propriedade icone="predio" rotulo="Razão social">{feito ? <span>{c.razaoSocial}</span> : <input type="text" value={c.razaoSocial} aria-label="Razão social" onChange={ev => setC({ ...c, razaoSocial: ev.target.value })} />}</Propriedade>
          <Propriedade icone="hash" rotulo="CNPJ">{feito ? <span>{c.cnpj || '—'}</span> : <input type="text" value={c.cnpj} placeholder="Se já tiver" aria-label="CNPJ" onChange={ev => setC({ ...c, cnpj: ev.target.value })} />}</Propriedade>
          <Propriedade icone="scale" rotulo="Regime">{feito ? <span>{e.REGIMES.find(r => r.valor === c.regime)?.rotulo}</span> : <Escolha valor={c.regime} opcoes={vm.regimes} mudar={v => setC({ ...c, regime: v })} titulo="O regime" />}</Propriedade>
          <Propriedade icone="recibo" rotulo="Responsável fiscal">{pessoa(c.fiscal, vm.fiscais, p => setC({ ...c, fiscal: p }), 'O responsável do Fiscal')}</Propriedade>
          <Propriedade icone="relatorio" rotulo="Responsável contábil">{pessoa(c.contabil, vm.contabeis, p => setC({ ...c, contabil: p }), 'O responsável do Contábil')}</Propriedade>
          {x.ficha.funcionarios > 0 && <Propriedade icone="usuario" rotulo="Responsável do DP">{pessoa(c.dp, vm.dps, p => setC({ ...c, dp: p }), 'O responsável do Departamento Pessoal')}</Propriedade>}
        </div>
      </Cartao>
      {!feito && (
        <div className="adm-pe">
          {problema && <span className="hint"><Icone nome="alert" width={14} height={14} /> {problema}</span>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-primary" disabled={!!problema} onClick={() => vm.cadastrar(c)}><Icone nome="check" />Cadastrar o cliente</button>
        </div>
      )}
      {feito && <p className="registro-dica"><Icone nome="checkCircle" />Pronto. No protótipo o cliente não vai para o Cadastro de verdade nem cria a pasta no Drive: isso entra quando o Vitor aprovar.</p>}
    </>
  );
}

// ------------------------------------------------------------------------------------------------- a página
function EntradaAberta({ vm, x }: { vm: Vm; x: Aberta }) {
  const nota = vm.nota!;
  return (
    <section className="adm-entrada">
      <div className="tarefas-barra-topo">
        <button type="button" className="btn btn-ghost" onClick={vm.voltar}><Icone nome="chevronLeft" />Entradas</button>
        <b className="adm-titulo">{String(x.numero).padStart(4, '0')} · {x.ficha.razaoSocial || 'Cliente novo'}</b>
        {vm.etapa && <span className={'badge badge-suave ' + SELO[vm.etapa.tom]}>{vm.etapa.rotulo}</span>}
      </div>
      <Segmentado valor={vm.passo} onMudar={vm.setPasso} opcoes={vm.passos.map(p => ({ valor: p.valor, rotulo: p.rotulo, travada: p.travada }))} />
      <div className="adm-colunas">
        <div className="adm-principal">
          {vm.passo === 'ficha' && <Ficha vm={vm} x={x} />}
          {vm.passo === 'orcamento' && <Orcamento vm={vm} x={x} />}
          {vm.passo === 'documentos' && <Documentos vm={vm} x={x} />}
          {vm.passo === 'cadastro' && <Cadastro key={x.id} vm={vm} x={x} />}
        </div>
        <aside className="adm-lado">
          <Cartao titulo="Cliente ideal">
            <p className="adm-nota"><b className="num">{nota.sim}</b> de {nota.total} <span className={'badge badge-suave ' + DA_NOTA[nota.classificacao]}>{nota.rotulo}</span></p>
            <p className="hint">{nota.respondidos < nota.total ? 'Faltam ' + (nota.total - nota.respondidos) + ' perguntas na ficha.' : 'Todas as perguntas respondidas.'}</p>
          </Cartao>
          <Cartao titulo="Histórico">
            {vm.historico.map((h, i) => <p key={i} className="adm-hist"><span className="hint">{h.quando} · {h.por}</span><br />{h.texto}</p>)}
          </Cartao>
        </aside>
      </div>
    </section>
  );
}

export function EntradaDeClientes() {
  const vm = useEntradaDeClientes();
  const [dev] = useModoDesenvolvedor();
  useCarregando(false);
  if (vm.aberta) return <EntradaAberta vm={vm} x={vm.aberta} />;
  return (
    <section className="adm-lista">
      <div className="tarefas-barra-topo">
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar pelo cliente" aria-label="Buscar pelo cliente ou pelo contato" value={vm.busca} onChange={ev => vm.setBusca(ev.target.value)} />
        </label>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        {dev && (
          <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" direita largura={260} titulo="Modo desenvolvedor · nada vai para o banco"
            itens={[{ rotulo: 'Entradas de exemplo (uma em cada etapa)', icone: 'usuario', marcado: vm.exemplos, onClick: () => vm.ligarExemplos(!vm.exemplos) }]} />
        )}
        <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" />Nova entrada</button>
      </div>
      <p className="registro-dica"><Icone nome="lampada" />Protótipo: a ficha, o orçamento, os documentos e o cadastro ficam só neste navegador (somem ao recarregar).</p>
      {vm.lista.length ? (
        <section className="card adm-tabela">
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Nº</th><th>Cliente</th><th>Contato</th><th>Procura</th><th>Cliente ideal</th><th className="num">Orçamento</th><th>Etapa</th><th>Atualizada</th></tr></thead>
              <tbody>
                {vm.lista.map(l => (
                  <tr key={l.id} className="ini-tr" title="Abrir a entrada" onClick={() => vm.abrir(l.id)}>
                    <td className="num fraco">{String(l.numero).padStart(4, '0')}</td>
                    <td><button type="button" className="ini-abrir" onClick={ev => { ev.stopPropagation(); vm.abrir(l.id); }}>{l.cliente}</button></td>
                    <td>{l.contato}</td>
                    <td>{l.motivo}</td>
                    <td><span className={'badge badge-suave ' + DA_NOTA[l.classificacao]}>{l.nota}</span></td>
                    <td className="num">{l.total}</td>
                    <td><span className={'badge badge-suave ' + SELO[l.tom]}>{l.etapa}</span></td>
                    <td className="fraco">{l.atualizada}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="card">
          <Vazio icone="usuario" titulo={vm.busca ? 'Nenhuma entrada com isso' : 'Nenhuma entrada ainda'} texto={vm.busca ? '' : 'Quando um cliente procurar o escritório, comece pela ficha pré-cadastral.'}>
            {!vm.busca && <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" />Nova entrada</button>}
          </Vazio>
        </section>
      )}
    </section>
  );
}
