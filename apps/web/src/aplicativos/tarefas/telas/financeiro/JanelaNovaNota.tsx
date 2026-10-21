// A janela Nova nota (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"), no jeito do "Create record"
// do Attio com as propriedades do Notion (o mesmo da Empresa nova): o tomador em destaque no topo (busca o cliente do
// escritório por nome ou código; sem cliente, digita-se o CPF/CNPJ e o nome), as propriedades em linhas (valor, data do
// serviço, descrição, e-mail, telefone) e, no rodapé, Cancelar e Emitir nota (Ctrl+Enter). Com `nota`, é a recusada sendo
// corrigida: abre preenchida e "Corrigir e reenviar" volta para a fila.
import type { nfse } from '@nads/core';
import { BotaoFechar, BotaoIcone, CampoData, Icone, useJanela, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import { useNovaNota, type NotaInicial } from './useNovaNota';

/** uma propriedade, como no Notion: o ícone e o nome à esquerda, o valor ocupando o resto */
function Propriedade({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <div className="registro-prop">
      <span className="registro-prop-nome"><Icone nome={icone} />{rotulo}</span>
      <div className="registro-prop-valor">{children}</div>
    </div>
  );
}

export function JanelaNovaNota({ fechar, nota, inicial }: { fechar: () => void; nota?: nfse.NotaFiscal; inicial?: NotaInicial }) {
  const vm = useNovaNota(fechar, nota, inicial);
  const titulo = vm.corrigindo ? 'Corrigir nota' : 'Nova nota';

  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela)
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  // Ctrl+Enter emite
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.emitir(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Notas fiscais<Icone nome="chevronRight" /><b>{titulo}</b></span>
          {vm.ambiente === 'homologacao' && <span className="badge badge-warn">Homologação — sem valor fiscal</span>}
          <BotaoFechar onClick={fechar} />
        </header>

        <div className="registro-corpo">
          {/* o tomador em destaque: a busca do cliente do escritório (código do ERP ou parte do nome); ao escolher, o nads
              preenche o nome, o CPF/CNPJ, o e-mail, o telefone e busca o endereço na Receita */}
          {vm.escolhido ? (
            <div className="registro-busca">
              <Icone nome="briefcase" />
              <span className="nf-escolhido"><b>{vm.escolhido.codigo ?? '—'}</b> · {vm.escolhido.nome}</span>
              <BotaoIcone icone="x" pequeno titulo="Trocar o cliente" onClick={vm.tirarCliente} />
            </div>
          ) : (
            <div className="registro-busca">
              <Icone nome="search" />
              <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Cliente: código do ERP ou nome" autoFocus aria-label="Buscar o cliente por código ou nome" autoComplete="off"
                role="combobox" aria-expanded={vm.listaVisivel} aria-controls="nf-clientes"
                onKeyDown={e => {
                  if (!vm.listaVisivel) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); vm.mover(1); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); vm.mover(-1); }
                  else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); vm.escolherDestacado(); }
                  else if (e.key === 'Escape') { e.preventDefault(); vm.fecharLista(); }
                }} />
            </div>
          )}
          {!vm.escolhido && vm.listaVisivel && (
            <ul className="nf-achados" id="nf-clientes" role="listbox" aria-label="Clientes encontrados">
              {vm.achados.map((c, i) => (
                <li key={c.empresa.nome + '|' + c.empresa.codigo}>
                  <button type="button" className={'popover-item' + (i === vm.ativo ? ' nf-ativo' : '')} role="option" aria-selected={i === vm.ativo} tabIndex={-1}
                    onMouseEnter={() => vm.setAtivo(i)} onClick={() => void vm.escolher(c.empresa)}>
                    <span className="nf-achado-codigo">{c.empresa.codigo ?? '—'}</span>
                    <span className="popover-texto">{c.empresa.nome}</span>
                    {c.documento && <span className="popover-dica">{c.documento}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {vm.escolhido
            ? vm.lendoCliente && <p className="registro-dica">Lendo o que o nads tem do cliente…</p>
            : !vm.busca && <p className="registro-dica">Digite o código ou o nome do cliente. Quem não é cliente: preencha o CPF ou CNPJ e o nome abaixo.</p>}

          <div className="registro-props">
            <Propriedade icone="hash" rotulo="CPF ou CNPJ">
              <input type="text" inputMode="numeric" value={vm.documento} onChange={e => vm.setDocumento(e.target.value)} onBlur={() => { vm.formatarDocumento(); vm.aoSairDoDocumento(); }} placeholder="Do tomador" aria-label="CPF ou CNPJ do tomador" />
            </Propriedade>
            <Propriedade icone="usuario" rotulo="Nome">
              <input type="text" value={vm.nome} onChange={e => vm.setNome(e.target.value)} placeholder="Nome ou razão social" autoComplete="off" aria-label="Nome do tomador" />
            </Propriedade>
            {vm.endereco.visivel ? (
              <>
                <Propriedade icone="landmark" rotulo="CEP">
                  <input type="text" inputMode="numeric" value={vm.endereco.cep} onChange={e => vm.endereco.setCep(e.target.value)} placeholder={vm.endereco.obrigatorio ? 'Obrigatório para CNPJ' : 'Opcional'} aria-label="CEP do tomador" />
                  {vm.endereco.buscando && <span className="fraco registro-origem">Buscando o endereço na Receita…</span>}
                </Propriedade>
                <Propriedade icone="landmark" rotulo="Rua">
                  <input type="text" value={vm.endereco.rua} onChange={e => vm.endereco.setRua(e.target.value)} placeholder="Logradouro" aria-label="Rua do tomador" />
                </Propriedade>
                <Propriedade icone="hash" rotulo="Número">
                  <input type="text" value={vm.endereco.numero} onChange={e => vm.endereco.setNumero(e.target.value)} placeholder="S/N se não tiver" aria-label="Número do endereço do tomador" />
                </Propriedade>
                <Propriedade icone="landmark" rotulo="Bairro">
                  <input type="text" value={vm.endereco.bairro} onChange={e => vm.endereco.setBairro(e.target.value)} placeholder="Bairro" aria-label="Bairro do tomador" />
                </Propriedade>
                <Propriedade icone="landmark" rotulo="Município">
                  <input type="text" inputMode="numeric" value={vm.endereco.cMun} onChange={e => vm.endereco.setCMun(e.target.value)} placeholder="Código do IBGE (7 dígitos)" aria-label="Código IBGE do município do tomador" />
                  {vm.endereco.municipio && <span className="fraco registro-origem">{vm.endereco.municipio}</span>}
                </Propriedade>
                {vm.endereco.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.endereco.erro}</p>}
              </>
            ) : (
              <div className="registro-prop"><button type="button" className="btn btn-ghost" onClick={vm.endereco.adicionar}><Icone nome="plus" />Adicionar endereço</button></div>
            )}
            <Propriedade icone="dinheiro" rotulo="Valor">
              <input type="text" inputMode="decimal" value={vm.valor} onChange={e => vm.setValor(e.target.value)} onBlur={vm.formatarValor} placeholder="420,00" aria-label="Valor em reais" />
            </Propriedade>
            <Propriedade icone="calendar" rotulo="Data do serviço">
              <CampoData valor={vm.data} onMudar={vm.setData} rotulo="Data do serviço" />
            </Propriedade>
            <Propriedade icone="fileText" rotulo="Descrição">
              <textarea className="nf-texto" rows={2} value={vm.descricao} onChange={e => vm.setDescricao(e.target.value)} placeholder="O que foi prestado" aria-label="Descrição do serviço" />
            </Propriedade>
            <Propriedade icone="envelope" rotulo="E-mail">
              <input type="email" value={vm.email} onChange={e => vm.setEmail(e.target.value)} placeholder="Vazio (opcional)" aria-label="E-mail do tomador" />
            </Propriedade>
            <Propriedade icone="mensagem" rotulo="Telefone">
              <input type="tel" inputMode="numeric" value={vm.fone} onChange={e => vm.setFone(e.target.value)} placeholder="Com o DDD (opcional)" aria-label="Telefone do tomador" />
            </Propriedade>
          </div>

          {vm.previa && <p className="registro-dica"><Icone nome="recibo" />{vm.previa}</p>}
          {vm.faltas.length > 0 && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />Para emitir, falta: {vm.faltas.join(', ')}. Veja Financeiro › Configurações.</p>}
          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>

        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando || vm.faltas.length > 0} onClick={() => void vm.emitir()}
            title={vm.faltas.length ? 'Falta configurar o emissor' : (vm.corrigindo ? 'Corrigir e reenviar' : 'Emitir nota') + ' (Ctrl+Enter)'}>
            {vm.salvando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="check" />}{vm.corrigindo ? 'Corrigir e reenviar' : 'Emitir nota'}
          </button>
        </footer>
      </div>
    </div>
  );
}
