// A janela Nova nota (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"), no jeito do "Create record"
// do Attio com as propriedades do Notion (o mesmo da Empresa nova): o tomador em destaque no topo (busca o cliente do
// escritório por nome ou código; sem cliente, digita-se o CPF/CNPJ e o nome), as propriedades em linhas (valor, data do
// serviço, descrição, e-mail, telefone) e, no rodapé, Cancelar e Emitir nota (Ctrl+Enter). Com `nota`, é a recusada sendo
// corrigida: abre preenchida e "Corrigir e reenviar" volta para a fila.
import type { nfse } from '@nads/core';
import { CampoData, Icone, type NomeIcone } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { useNovaNota } from './useNovaNota';

/** uma propriedade, como no Notion: o ícone e o nome à esquerda, o valor ocupando o resto */
function Propriedade({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <div className="registro-prop">
      <span className="registro-prop-nome"><Icone nome={icone} />{rotulo}</span>
      <div className="registro-prop-valor">{children}</div>
    </div>
  );
}

export function JanelaNovaNota({ fechar, nota }: { fechar: () => void; nota?: nfse.NotaFiscal }) {
  const vm = useNovaNota(fechar, nota);
  const titulo = vm.corrigindo ? 'Corrigir nota' : 'Nova nota';

  // Esc fecha; Ctrl+Enter emite
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) fechar();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.emitir(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Notas fiscais<Icone nome="chevronRight" /><b>{titulo}</b></span>
          {vm.ambiente === 'homologacao' && <span className="badge badge-warn">Homologação — sem valor fiscal</span>}
          <button type="button" className="icon-btn icon-btn-sm" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>

        <div className="registro-corpo">
          {/* o tomador em destaque: o cliente do escritório preenche o resto com o que o nads já tem */}
          <div className="registro-busca">
            <Icone nome="search" />
            <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Buscar o cliente por nome ou código" autoFocus aria-label="Buscar o cliente" autoComplete="off"
              onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && vm.achados.length) void vm.escolher(vm.achados[0]); }} />
          </div>
          {vm.achados.length > 0 && (
            <ul className="nf-achados" role="listbox" aria-label="Clientes encontrados">
              {vm.achados.map(c => (
                <li key={c.nome + "|" + c.codigo}>
                  <button type="button" className="popover-item" role="option" aria-selected={false} onClick={() => void vm.escolher(c)}>
                    <span className="popover-texto">{c.nome}</span>
                    <span className="popover-dica">{c.codigo ?? '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {vm.escolhido
            ? (
              <div className="registro-receita">
                <div className="registro-receita-topo">
                  <b>{vm.escolhido.nome}</b>
                  <span className="badge badge-neutral">{vm.escolhido.codigo != null ? 'Código ' + vm.escolhido.codigo : 'Sem código'}</span>
                  <button type="button" className="icon-btn icon-btn-sm" onClick={vm.tirarCliente} aria-label="Tirar o cliente" title="Tirar o cliente (digitar à mão)"><Icone nome="x" /></button>
                </div>
                <span className="fraco">{vm.lendoCliente ? 'Lendo o que o nads tem do cliente…' : 'Do cadastro do escritório. Pode ajustar abaixo.'}</span>
              </div>
            )
            : !vm.busca && <p className="registro-dica">Sem cliente na lista, preencha o CPF ou CNPJ e o nome abaixo.</p>}

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
