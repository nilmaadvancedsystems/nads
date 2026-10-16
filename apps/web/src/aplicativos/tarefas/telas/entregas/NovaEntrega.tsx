// Entregas › Nova entrega (16/10/2026, a cópia fiel do entregas.html: "só copia o entregas e joga aqui no design n1"): o
// cartão "Registrar entrega" de lá, na mesma ordem (Preparar rota | Pelo link, a região, o cliente com Cliente avulso e
// Banco embaixo, a competência, o vencimento, os documentos com a planilha de "Adicionar documento" e "Puxar guias da
// pasta", repetir o mês passado, o honorário e o PIX, o PDF da guia no link), com as peças do nads (o campo, a seleção, o
// seletor de mês, a data, os documentos com valor, o segmentado). A ação da tela ("Adicionar à rota" / "Publicar no link
// do cliente") mora no canto de cima, como lá.
import { BotaoIcone, CampoArquivos, CampoData, Esqueleto, Icone, Segmentado, SeletorMes, useCarregando } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { AcoesDoTopo } from '../../../../comum/topo';
import { FaixaDasGravacoes } from './FaixaDasGravacoes';
import { JanelasDasEntregas } from './JanelasDasEntregas';
import { useQr } from './useQr';
import { useNovaEntrega, type LinhaDoDocumento } from './useNovaEntrega';

const MODOS: { valor: 'rota' | 'link'; rotulo: string }[] = [{ valor: 'rota', rotulo: 'Preparar rota' }, { valor: 'link', rotulo: 'Pelo link' }];

export function NovaEntrega() {
  return <JanelasDasEntregas><Formulario /></JanelasDasEntregas>;
}

function Formulario() {
  const vm = useNovaEntrega();
  useCarregando(vm.carregando);
  const qrPix = useQr(vm.pixCodigo, 132);
  if (vm.carregando) return <Esqueleto linhas={6} />;
  return (
    <section className="ent-tela">
      <AcoesDoTopo>
        <button type="submit" form="ent-form-nova" className="btn btn-primary" disabled={vm.salvando}>
          {vm.salvando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome={vm.modo === 'link' ? 'link' : 'caminhao'} />}{vm.rotuloDoBotao}
        </button>
      </AcoesDoTopo>
      <FaixaDasGravacoes />
      <form id="ent-form-nova" className="card ent-nova-form" noValidate onSubmit={e => { e.preventDefault(); void vm.gravar(); }}>
        <div className="card-head ent-inteiro"><h3><Icone nome="lapis" width={16} height={16} /> Registrar entrega</h3>{vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}</div>

        {/* "Entregar agora" saiu no Entregas (24/09/2026): entrega se faz pela Rota; o seletor só aparece quando o cliente tem link */}
        {vm.temLink && <div className="ent-inteiro ent-modo"><Segmentado valor={vm.modo} opcoes={MODOS} onMudar={vm.setModo} /></div>}

        {vm.modo === 'rota' && (
          <div className="field">
            <label htmlFor="ent-zona">Região da rota</label>
            <select id="ent-zona" value={vm.zona} onChange={e => vm.setZona(e.target.value)}>
              <option value="">Selecione a região</option>
              {vm.zonas.map(z => <option key={z.valor} value={z.valor}>{z.rotulo}</option>)}
            </select>
          </div>
        )}

        <div className="field ent-cliente">
          <label htmlFor="ent-cliente">{vm.banco ? 'Banco' : 'Cliente'}</label>
          {vm.banco ? (
            <>
              <input id="ent-cliente" type="text" list="ent-bancos" value={vm.bancoNome} onChange={e => vm.setBancoNome(e.target.value)} placeholder="Qual banco? Ex.: Banco do Brasil, Caixa, Sicoob" autoComplete="off" />
              <datalist id="ent-bancos">{vm.bancos.map(b => <option key={b} value={b} />)}</datalist>
            </>
          ) : vm.avulso ? (
            <input id="ent-cliente" type="text" value={vm.avulsoNome} onChange={e => vm.setAvulsoNome(e.target.value)} placeholder="Nome do cliente" autoComplete="off" />
          ) : (
            <BuscaDoCliente vm={vm} />
          )}
          {vm.erros.cliente && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erros.cliente}</p>}
          <div className="ent-marcas">
            <label className="ent-marca"><input type="checkbox" checked={vm.avulso} onChange={e => vm.alternarAvulso(e.target.checked)} />Cliente avulso</label>
            <label className="ent-marca" title="Pagar ou buscar um documento no banco"><input type="checkbox" checked={vm.banco} onChange={e => vm.alternarBanco(e.target.checked)} /><Icone nome="landmark" />Banco</label>
          </div>
        </div>

        <div className="field">
          <label htmlFor="ent-comp">Competência</label>
          <SeletorMes id="ent-comp" valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
          {vm.erros.competencia && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erros.competencia}</p>}
        </div>

        <div className="field">
          <label htmlFor="ent-venc">Vencimento (opcional)</label>
          <CampoData id="ent-venc" valor={vm.vencimento} onMudar={vm.setVencimento} rotulo="Vencimento" />
        </div>

        <div className="field ent-inteiro">
          <label>Documentos entregues</label>
          {!vm.planilha && vm.linhas.length > 0 && (
            <ul className="ent-docs" aria-label="Documentos da entrega">
              {vm.linhas.map(l => <LinhaDoDoc key={l.chave} l={l} vm={vm} />)}
            </ul>
          )}
          <div className="ent-docs-acoes">
            <button type="button" className="btn btn-outline" aria-expanded={vm.planilha} onClick={() => (vm.planilha ? vm.fecharPlanilha() : vm.abrirPlanilha())}>
              <Icone nome="plus" />Adicionar documento
            </button>
            {vm.podePuxarGuias && (
              <button type="button" className="btn btn-outline" disabled={vm.puxandoGuias} onClick={() => void vm.puxarGuiasDaPasta()}>
                {vm.puxandoGuias ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="pastaAberta" />}Puxar guias da pasta
              </button>
            )}
          </div>
          {vm.planilha && <PlanilhaDeDocumentos vm={vm} />}
          {vm.guiasStatus && <p className="hint">{vm.guiasStatus}</p>}
          {vm.erros.itens && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erros.itens}</p>}
        </div>

        {vm.repetir && (
          <div className="field ent-repetir">
            <span>{vm.repetir}</span>
            <button type="button" className="btn btn-outline" onClick={vm.repetirMesPassado}><Icone nome="repeat" />Repetir</button>
          </div>
        )}

        {vm.dicaDoHonorario && <p className="hint ent-inteiro">{vm.dicaDoHonorario}</p>}
        {vm.apenasHonorario && (
          <label className="ent-marca ent-inteiro"><input type="checkbox" checked={vm.pix} onChange={e => vm.setPix(e.target.checked)} />Pagamento via Pix</label>
        )}
        {vm.pix && (
          <div className="ent-inteiro ent-pix">
            <div className="field"><label htmlFor="ent-pix-valor">Valor do honorário</label>
              <input id="ent-pix-valor" type="text" inputMode="decimal" placeholder="0,00" autoComplete="off" value={vm.pixValor} onChange={e => vm.setPixValor(e.target.value)} /></div>
            {vm.pixSemChave ? <p className="hint">Sem chave Pix cadastrada em Escritório.</p> : qrPix && (
              <div className="ent-pix-qr">
                <img src={qrPix} alt="QR do Pix do escritório" width={132} height={132} />
                <div className="ent-pix-lado"><b>Pix do escritório</b><span className="hint">{vm.pixSub}</span>
                  <button type="button" className="btn btn-outline" onClick={() => void vm.copiarPix()}><Icone nome="copiar" />Copiar código</button></div>
              </div>
            )}
          </div>
        )}

        {/* o PDF do documento saiu do formulário no Entregas; volta só no "Pelo link", que precisa dele (é a guia que o cliente vê) */}
        {vm.modo === 'link' && (
          <div className="field">
            <label>PDF do documento (opcional)</label>
            {vm.foto ? (
              <span className="ent-anexo">
                <img className="ent-miniatura" src={vm.foto} alt="A primeira página da guia" width={56} height={56} />
                <span className="fraco">Guia (PDF)</span>
                <BotaoIcone icone="x" titulo="Tirar o PDF" pequeno onClick={vm.tirarFoto} />
              </span>
            ) : <CampoArquivos id="ent-pdf" aceitar="application/pdf" rotulo="Anexar PDF" onEscolher={fs => void vm.anexarPdf(fs)} compacto />}
            {vm.pdfStatus && <p className="hint">{vm.pdfStatus}</p>}
          </div>
        )}
      </form>
    </section>
  );
}

type Vm = ReturnType<typeof useNovaEntrega>;

/** O campo do cliente: a busca e a lista logo abaixo (↑↓ e Enter escolhem; Esc fecha). */
function BuscaDoCliente({ vm }: { vm: Vm }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!vm.listaAberta) return;
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) vm.fecharLista(); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [vm]);
  return (
    <div className="ent-combo" ref={caixa}>
      <input id="ent-cliente" ref={vm.campoCliente} type="text" value={vm.busca} placeholder="Buscar cliente..." autoComplete="off" enterKeyHint="search"
        role="combobox" aria-expanded={vm.listaAberta} aria-controls="ent-clientes" aria-autocomplete="list"
        onChange={e => vm.digitarCliente(e.target.value)} onFocus={vm.abrirLista}
        onKeyDown={e => {
          if (e.key === 'Escape') { vm.fecharLista(); return; }
          if (vm.teclaNaLista(e.key)) e.preventDefault();
        }} />
      {vm.listaAberta && (vm.achados.length > 0 || vm.oferecerNovo) && (
        <ul className="nf-achados ent-achados" id="ent-clientes" role="listbox" aria-label="Clientes encontrados">
          {vm.achados.map((c, i) => (
            <li key={c.id}>
              <button type="button" role="option" aria-selected={i === vm.ativo} className={'popover-item' + (i === vm.ativo ? ' nf-ativo' : '')} onMouseEnter={() => vm.setAtivo(i)} onClick={() => vm.escolher(c)}>
                <span className="nf-achado-codigo">{c.codigoOrigem || '—'}</span><span className="popover-texto">{c.nome}</span>{c.documento && <span className="popover-dica">{c.documento}</span>}
              </button>
            </li>
          ))}
          {vm.oferecerNovo && (
            <li>
              <button type="button" role="option" aria-selected={vm.ativo === vm.achados.length} className={'popover-item' + (vm.ativo === vm.achados.length ? ' nf-ativo' : '')} onClick={() => void vm.adicionarCliente()}>
                <Icone nome="plus" /><span className="popover-texto">Adicionar novo cliente "{vm.busca.trim()}"</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Uma linha dos documentos (fora da planilha): o nome, o valor (ou "sem valor"), repetir e tirar; o funcionário embaixo. */
function LinhaDoDoc({ l, vm }: { l: LinhaDoDocumento; vm: Vm }) {
  return (
    <>
      <li className="ent-doc">
        <span className="ent-doc-tipo">{l.rotulo}</span>
        {l.semValor ? <span className="fraco ent-doc-valor">sem valor</span> : (
          <input type="text" inputMode="decimal" className="ent-doc-valor num" placeholder="R$ 0,00" value={l.valor} aria-label={'Valor de ' + l.rotulo}
            onChange={e => vm.mudarValor(l, e.target.value)} onBlur={() => vm.conferirValor(l)} />
        )}
        {!l.semValor && !l.outro && <BotaoIcone icone="copiar" titulo={'Repetir ' + l.rotulo + ' (outro valor)'} pequeno onClick={() => vm.repetirDocumento(l)} />}
        <BotaoIcone icone="x" titulo={'Tirar ' + l.rotulo} pequeno onClick={() => vm.tirarDocumento(l)} />
      </li>
      {l.pedeFuncionario && (
        <li className="ent-doc"><input type="text" className="ent-doc-tipo" placeholder="Nome do funcionário" aria-label={'Nome do funcionário para ' + l.rotulo} value={l.funcionario} onChange={e => vm.mudarFuncionario(l, e.target.value)} /></li>
      )}
      {vm.divergentes[l.chave] && <li className="ent-divergente"><Icone nome="alert" />{vm.divergentes[l.chave]}</li>}
    </>
  );
}

/**
 * "Adicionar documento" (pedido do escritório no Entregas): a planilha flutuante — uma linha por documento com o valor ao
 * lado; a última fica vazia: escolhe o tipo e o cursor vai para o valor; Enter no valor volta para a próxima; Esc ou
 * "Pronto" fecham.
 */
function PlanilhaDeDocumentos({ vm }: { vm: Vm }) {
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!vm.focar) return;
    const alvo = raiz.current?.querySelector<HTMLElement>(vm.focar === '__nova' ? 'select' : '[data-foco="' + vm.focar + '"]');
    alvo?.focus();
    vm.limparFoco();
  });
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (raiz.current && document.contains(t) && !raiz.current.contains(t) && !t.closest('.ent-docs-acoes')) vm.fecharPlanilha();
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [vm]);
  const proxima = () => raiz.current?.querySelector<HTMLSelectElement>('tr.ent-planilha-nova select')?.focus();
  return (
    <div className="popover ent-planilha" ref={raiz} role="dialog" aria-label="Documentos da entrega" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); vm.fecharPlanilha(); } }}>
      <h4>Documentos da entrega</h4>
      <div className="table-wrap ent-planilha-rolagem">
        <table className="table-compact">
          <thead><tr><th>Documento</th><th>Valor</th><th><span className="sr-only">Tirar</span></th></tr></thead>
          <tbody>
            {vm.linhas.map(l => (
              <tr key={l.chave}>
                <td>{l.outro
                  ? <input type="text" data-foco="outro-nome" placeholder="Nome do documento" aria-label="Nome do outro documento" value={l.rotulo === 'Outro documento' ? '' : l.rotulo} onChange={e => vm.mudarOutro(e.target.value)} />
                  : l.rotulo}</td>
                <td>{l.semValor ? <span className="fraco">sem valor</span> : (
                  <input type="text" inputMode="decimal" className="num" data-foco={l.chave} placeholder="R$ 0,00" aria-label={'Valor de ' + l.rotulo} value={l.valor}
                    onChange={e => vm.mudarValor(l, e.target.value)} onBlur={() => vm.conferirValor(l)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); proxima(); } }} />
                )}</td>
                <td className="ent-planilha-x">
                  {!l.semValor && !l.outro && <BotaoIcone icone="copiar" titulo={'Repetir ' + l.rotulo + ' (outro valor)'} pequeno onClick={() => vm.repetirDocumento(l)} />}
                  <BotaoIcone icone="x" titulo={'Tirar ' + l.rotulo} pequeno onClick={() => vm.tirarDocumento(l)} />
                </td>
              </tr>
            ))}
            <tr className="ent-planilha-nova">
              <td colSpan={3}>
                <select value="" aria-label="Escolher o próximo documento" onChange={e => vm.escolherDocumento(e.target.value)}>
                  <option value="">+ clique pra escolher o documento</option>
                  {vm.livres.map(t => <option key={t.chave} value={t.chave}>{t.rotulo}</option>)}
                  {vm.podeOutro && <option value="__outro">Outro documento…</option>}
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="ent-planilha-pe"><button type="button" className="btn btn-primary" onClick={vm.fecharPlanilha}>Pronto</button></div>
    </div>
  );
}
