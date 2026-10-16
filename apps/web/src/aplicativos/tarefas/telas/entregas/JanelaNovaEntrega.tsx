// A janela Nova entrega (16/10/2026, a entrega de documentos trazida do Entregas: "preciso que fique tudo no visual igual
// para não destoar do app"), no jeito do "Criar registro" do nads (a Nova nota, a Empresa nova): para quem em destaque no
// topo (o cliente buscado por código, nome ou CNPJ; ou o nome avulso; ou o banco), as propriedades em linhas (competência,
// documentos com o valor, vencimento, região, a guia) e, no rodapé, "Adicionar outra", Cancelar e Adicionar à rota
// (Ctrl+Enter). A parada vai para a Rota esperando a assinatura.
import type { entregas } from '@nads/core';
import { formatos } from '@nads/core';
import { BotaoIcone, CampoArquivos, CampoData, Icone, Interruptor, MenuSuspenso, Segmentado, SeletorMes, type NomeIcone } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { DESTINOS, useNovaEntrega } from './useNovaEntrega';

/** uma propriedade, como no Notion: o ícone e o nome à esquerda, o valor ocupando o resto */
function Propriedade({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <div className="registro-prop">
      <span className="registro-prop-nome"><Icone nome={icone} />{rotulo}</span>
      <div className="registro-prop-valor">{children}</div>
    </div>
  );
}

export function JanelaNovaEntrega({ fechar, cliente }: { fechar: () => void; cliente?: entregas.ClienteDaRota | null }) {
  const vm = useNovaEntrega(fechar, cliente);

  // Esc fecha; Ctrl+Enter põe na rota
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.ent-nova .popover')) fechar();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.adicionarNaRota(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="modal registro-novo ent-nova" role="dialog" aria-modal="true" aria-label="Nova entrega">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="caminhao" />Entregas<Icone nome="chevronRight" /><b>Nova entrega</b></span>
          {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
          <button type="button" className="icon-btn icon-btn-sm" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>

        <div className="registro-corpo">
          <Segmentado valor={vm.destino} opcoes={DESTINOS} onMudar={vm.setDestino} />

          {/* para quem, em destaque: o cliente do cadastro (a lista logo abaixo, ↑↓ e Enter), ou o nome livre */}
          {vm.destino !== 'cliente' ? (
            <div className="registro-busca">
              <Icone nome={vm.destino === 'banco' ? 'landmark' : 'usuario'} />
              <input type="text" value={vm.nomeLivre} onChange={e => vm.setNomeLivre(e.target.value)} autoFocus autoComplete="off"
                placeholder={vm.destino === 'banco' ? 'Qual banco? Ex.: Banco do Brasil, Caixa, Sicoob' : 'Nome do cliente avulso'}
                aria-label={vm.destino === 'banco' ? 'O banco onde pagar ou buscar o documento' : 'O nome do cliente avulso'} />
            </div>
          ) : vm.escolhido ? (
            <div className="registro-busca">
              <Icone nome="briefcase" />
              <span className="nf-escolhido"><b>{vm.escolhido.codigoOrigem || '—'}</b> · {vm.escolhido.nome}</span>
              <button type="button" className="icon-btn icon-btn-sm" onClick={vm.tirarCliente} aria-label="Trocar o cliente" title="Trocar o cliente"><Icone nome="x" /></button>
            </div>
          ) : (
            <div className="registro-busca">
              <Icone nome="search" />
              <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Cliente: código, nome ou CNPJ" autoFocus autoComplete="off"
                aria-label="Buscar o cliente por código, nome ou CNPJ" role="combobox" aria-expanded={vm.listaVisivel} aria-controls="ent-clientes"
                onKeyDown={e => {
                  if (!vm.listaVisivel) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); vm.mover(1); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); vm.mover(-1); }
                  else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); vm.escolherDestacado(); }
                  else if (e.key === 'Escape') { e.preventDefault(); vm.fecharLista(); }
                }} />
            </div>
          )}
          {vm.listaVisivel && (
            <ul className="nf-achados" id="ent-clientes" role="listbox" aria-label="Clientes encontrados">
              {vm.achados.map((c, i) => (
                <li key={c.id}>
                  <button type="button" className={'popover-item' + (i === vm.ativo ? ' nf-ativo' : '')} role="option" aria-selected={i === vm.ativo} tabIndex={-1}
                    onMouseEnter={() => vm.setAtivo(i)} onClick={() => vm.escolher(c)}>
                    <span className="nf-achado-codigo">{c.codigoOrigem || '—'}</span>
                    <span className="popover-texto">{c.nome}</span>
                    {c.documento && <span className="popover-dica">{c.documento}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {vm.destino === 'cliente' && !vm.escolhido && !vm.busca && (
            <p className="registro-dica">{vm.carregando ? 'Lendo os clientes do Entregas…' : 'Digite o código, o nome ou parte do CNPJ. Quem não está no cadastro: Avulso.'}</p>
          )}
          {vm.destino === 'banco' && <p className="registro-dica"><Icone nome="landmark" />Pagar ou buscar um documento no banco: vira uma parada na rota.</p>}

          <div className="registro-props">
            <Propriedade icone="calendar" rotulo="Competência">
              <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
            </Propriedade>
            <Propriedade icone="fileText" rotulo="Documentos">
              <MenuSuspenso rotulo="Adicionar documento" icone="plus" className="btn btn-ghost" titulo="Documento" largura={240}
                itens={[...vm.tipos.map(t => ({ rotulo: t.rotulo, onClick: () => vm.adicionar(t) })), { rotulo: 'Outro documento', icone: 'lapis' as const, onClick: () => vm.adicionar(null) }]} />
              {vm.total > 0 && <span className="fraco num">Total {formatos.reais(vm.total)}</span>}
            </Propriedade>
            {vm.documentos.length > 0 && (
              <ul className="ent-docs" aria-label="Documentos da entrega">
                {vm.documentos.map(d => (
                  <li key={d.id} className="ent-doc">
                    {d.livre
                      ? <input type="text" className="ent-doc-tipo" value={d.tipo} onChange={e => vm.mudarDocumento(d.id, 'tipo', e.target.value)} placeholder="Ex.: Contrato social, procuração" aria-label="Nome do documento" autoFocus />
                      : <span className="ent-doc-tipo">{d.tipo}</span>}
                    {d.funcionario !== null && (
                      <input type="text" className="ent-doc-func" value={d.funcionario} onChange={e => vm.mudarDocumento(d.id, 'funcionario', e.target.value)} placeholder="Funcionário" aria-label={'Funcionário da ' + d.tipo} />
                    )}
                    {d.semValor
                      ? <span className="fraco ent-doc-valor">sem valor</span>
                      : <input type="text" inputMode="decimal" className="ent-doc-valor num" value={d.valor} onChange={e => vm.mudarDocumento(d.id, 'valor', e.target.value)} onBlur={() => vm.formatarValor(d.id)} placeholder="0,00" aria-label={'Valor de ' + (d.tipo || 'documento')} />}
                    <BotaoIcone icone="x" titulo="Tirar o documento" pequeno onClick={() => vm.tirarDocumento(d.id)} />
                  </li>
                ))}
              </ul>
            )}
            <Propriedade icone="clock" rotulo="Vencimento">
              <CampoData valor={vm.vencimento} onMudar={vm.setVencimento} rotulo="Vencimento" />
              {vm.vencimentoAutomatico && <span className="fraco registro-origem">pela regra da guia; confira os feriados</span>}
            </Propriedade>
            <Propriedade icone="home" rotulo="Região da rota">
              <MenuSuspenso rotulo={vm.rotuloDaZona || 'Sem região'} className={'btn btn-ghost registro-escolha' + (vm.zona ? '' : ' vazio')} titulo="Região" largura={200}
                itens={[{ rotulo: 'Sem região', marcado: !vm.zona, onClick: () => vm.setZona('') }, ...vm.zonas.map(z => ({ rotulo: z.rotulo, marcado: z.valor === vm.zona, onClick: () => vm.setZona(z.valor) }))]} />
            </Propriedade>
            <Propriedade icone="imagem" rotulo="Guia ou foto">
              {vm.imagem ? (
                <span className="ent-anexo">
                  <img className="ent-miniatura" src={vm.imagem.url} alt={vm.imagem.ehGuia ? 'A primeira página da guia' : 'A foto anexada'} />
                  <span className="fraco">{vm.imagem.ehGuia ? 'Guia (PDF)' : 'Foto'} · {vm.imagem.nome}</span>
                  <BotaoIcone icone="x" titulo="Tirar o arquivo" pequeno onClick={vm.tirarImagem} />
                </span>
              ) : vm.lendoArquivo ? (
                <span className="fraco"><span className="btn-spinner" aria-hidden="true" /> Lendo o arquivo…</span>
              ) : (
                <CampoArquivos id="ent-nova-arquivo" aceitar="image/*,application/pdf" rotulo="Escolher a foto ou o PDF da guia" onEscolher={fs => void vm.anexar(fs)} />
              )}
            </Propriedade>
          </div>

          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>

        <footer className="registro-pe">
          <Interruptor ligado={vm.outra} rotulo="Adicionar outra" onMudar={() => vm.setOutra(!vm.outra)} />
          <span className="registro-pe-rotulo">{vm.feitas ? <><Icone nome="checkCircle" />{vm.feitas} na rota</> : 'Adicionar outra'}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando || vm.lendoArquivo} onClick={() => void vm.adicionarNaRota()} title="Adicionar à rota (Ctrl+Enter)">
            {vm.salvando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="caminhao" />}Adicionar à rota
          </button>
        </footer>
      </div>
    </div>
  );
}
