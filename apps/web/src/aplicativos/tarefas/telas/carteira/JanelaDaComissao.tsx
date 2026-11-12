// A janela de registrar (ou mudar) uma comissão (12/11/2026), no desenho das janelas do Financeiro. Pela Carteira, o mês do
// pagamento é sempre o seguinte (travado); o cliente vem do cadastro (o menu com a busca) ou é avulso (o nome e o porte);
// o serviço é um dos comissionados e a comissão sai sozinha, do valor do serviço × a % que o Financeiro definiu. Pelo
// Financeiro (doFinanceiro): a pessoa e qualquer mês (a retroativa), já aprovada. Depois de decidida, só ver.
import { carteira, formatos } from '@nads/core';
import { BotaoFechar, CampoData, Icone, MenuSuspenso, useJanela } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { useJanelaDaComissao, type ClienteDaLista } from './useCarteiraDaPessoa';

const ESCOLHA = 'btn btn-ghost registro-escolha';
const comMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** O cliente: o menu com a busca nos clientes do cadastro e, no alto, o "Cliente avulso" (não está no cadastro). */
function EscolherCliente({ clientes, codigo, avulso, rotulo, travada, onCliente, onAvulso }: {
  clientes: readonly ClienteDaLista[]; codigo: number | null; avulso: boolean; rotulo: string; travada: boolean;
  onCliente: (codigo: number) => void; onAvulso: () => void;
}) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const achados = (q ? clientes.filter(c => (c.codigo + ' ' + c.nome).toLowerCase().includes(q)) : clientes).slice(0, 80);
  if (travada) return <span>{rotulo || '—'}</span>;
  return (
    <MenuSuspenso rotulo={avulso ? 'Cliente avulso' : rotulo || 'Escolher o cliente'} className={ESCOLHA + (avulso || rotulo ? '' : ' vazio')} titulo="O cliente" flutuante largura={380}
      conteudo={fechar => (
        <>
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar pelo nome ou código" aria-label="Buscar o cliente" value={busca} autoFocus onChange={e => setBusca(e.target.value)} />
          </label>
          <button type="button" className="popover-item" role="menuitemcheckbox" aria-checked={avulso} onClick={() => { fechar(); onAvulso(); setBusca(''); }}>
            <span className="popover-texto"><b>Cliente avulso</b><br /><span className="hint">Não está no cadastro: escreva o nome e o porte</span></span>
          </button>
          {achados.map(c => (
            <button key={c.codigo} type="button" className="popover-item" role="menuitemcheckbox" aria-checked={!avulso && c.codigo === codigo} onClick={() => { fechar(); onCliente(c.codigo); setBusca(''); }}>
              <span className="num fraco">{c.codigo}</span><span className="popover-texto">{c.nome}</span>
            </button>
          ))}
          {!achados.length && <p className="hint">Nenhum cliente com essa busca.</p>}
        </>
      )} />
  );
}

export function JanelaDaComissao({ comissao, fechar, doFinanceiro = false }: { comissao: carteira.Comissao | null; fechar: () => void; doFinanceiro?: boolean }) {
  const vm = useJanelaDaComissao(comissao, fechar, doFinanceiro);
  const { travada, erros, salvando } = vm;
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const titulo = !comissao ? 'Registrar comissão' : travada ? 'Comissão' : 'Mudar comissão';
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.salvar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  const doServico = vm.servicos.find(s => s.nome === vm.servico);

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />{doFinanceiro ? 'Comissões da equipe' : 'Carteira'}<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          {travada && <p className="registro-dica"><Icone nome="lock" />{comissao!.situacao === 'recusada' ? 'Recusada pelo Financeiro' + (comissao!.motivo ? ': ' + comissao!.motivo : '.') : 'Já ' + carteira.rotuloDaSituacao(comissao!.situacao).toLowerCase() + ' pelo Financeiro: não muda mais.'}</p>}
          {doFinanceiro && <p className="registro-dica"><Icone nome="lampada" />Registrada pelo Financeiro, a comissão já entra aprovada e aparece na Carteira da pessoa.</p>}
          <div className="registro-props">
            {doFinanceiro && (
              <Propriedade icone="usuario" rotulo="Pessoa">
                <MenuSuspenso rotulo={vm.para?.nome || 'Escolher a pessoa'} className={ESCOLHA + (vm.para ? '' : ' vazio')} titulo="De quem é a comissão" flutuante largura={280}
                  itens={vm.pessoas.map(p => ({ rotulo: p.nome, marcado: p.uid === vm.para?.uid, onClick: () => vm.setPara(p) }))} />
              </Propriedade>
            )}
            <Propriedade icone="calendar" rotulo="Pagar em">
              {doFinanceiro ? (
                <MenuSuspenso rotulo={comMaiuscula(carteira.mesPorExtenso(vm.competencia))} className={ESCOLHA} titulo="O mês do pagamento" flutuante largura={240}
                  itens={vm.mesesDoFinanceiro.map(x => ({ rotulo: comMaiuscula(carteira.mesPorExtenso(x)), marcado: x === vm.competencia, onClick: () => vm.setCompetencia(x) }))} />
              ) : <span title="A comissão entra sempre no mês seguinte; a retroativa, só o Financeiro registra"><Icone nome="lock" /> {comMaiuscula(carteira.mesPorExtenso(vm.competencia))}</span>}
            </Propriedade>
            <Propriedade icone="calendar" rotulo="Data">{travada ? <span>{vm.data}</span> : <CampoData valor={vm.data} onMudar={vm.setData} rotulo="Data da venda ou do serviço" />}</Propriedade>
            <Propriedade icone="predio" rotulo="Cliente">
              <EscolherCliente clientes={vm.clientes} codigo={vm.clienteCodigo} avulso={vm.avulso} rotulo={vm.avulso ? '' : vm.cliente} travada={travada}
                onCliente={vm.escolherCliente} onAvulso={vm.marcarAvulso} />
            </Propriedade>
            {vm.avulso && (
              <>
                <Propriedade icone="fileText" rotulo="Nome">
                  <input type="text" autoFocus={!comissao} value={vm.nomeAvulso} disabled={travada} maxLength={150} onChange={e => vm.setNomeAvulso(e.target.value)} placeholder="O nome do cliente" aria-label="Nome do cliente avulso" />
                </Propriedade>
                <Propriedade icone="briefcase" rotulo="Porte">
                  {travada ? <span>{vm.porte || '—'}</span> : (
                    <MenuSuspenso rotulo={vm.porte || 'Escolher o porte'} className={ESCOLHA + (vm.porte ? '' : ' vazio')} titulo="O porte do cliente" flutuante largura={200}
                      itens={carteira.PORTES.map(p => ({ rotulo: p, marcado: p === vm.porte, onClick: () => vm.setPorte(p) }))} />
                  )}
                </Propriedade>
              </>
            )}
            <Propriedade icone="checklist" rotulo="Serviço">
              {travada ? <span>{vm.servico || comissao?.descricao || '—'}</span> : (
                <MenuSuspenso rotulo={vm.servico || 'Escolher o serviço'} className={ESCOLHA + (vm.servico ? '' : ' vazio')} titulo="O serviço comissionado" flutuante largura={320}
                  itens={vm.servicos.map(s => ({ rotulo: s.nome + (s.percentual ? ' · ' + s.percentual.toLocaleString('pt-BR') + '%' : ' · sem %'), marcado: s.nome === vm.servico, onClick: () => vm.setServico(s.nome) }))} />
              )}
            </Propriedade>
            <Propriedade icone="dinheiro" rotulo="Valor do serviço">
              <input type="text" inputMode="decimal" value={vm.valorServico} disabled={travada} onChange={e => vm.setValorServico(e.target.value)} placeholder="Quanto o cliente pagou" aria-label="Valor do serviço" />
            </Propriedade>
            <Propriedade icone="check" rotulo="Comissão">
              <span className="num"><b>{formatos.reais(vm.valor)}</b>{vm.percentual > 0 && <span className="fraco"> · {vm.percentual.toLocaleString('pt-BR')}% do serviço</span>}
                {!travada && vm.servico && doServico && !doServico.percentual && <span className="fraco"> · o Financeiro ainda não definiu a %</span>}</span>
            </Propriedade>
          </div>
          {erros.length > 0 && <ul className="registro-erros">{erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
          {comissao && !travada && <button type="button" className="btn btn-outline btn-danger" onClick={() => void vm.apagar()}><Icone nome="lixeira" />Apagar</button>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>{travada ? 'Fechar' : 'Cancelar'}</button>
          {!travada && <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => void vm.salvar()} title="Gravar (Ctrl+Enter)"><Icone nome="check" />{comissao ? 'Gravar' : 'Registrar'}</button>}
        </footer>
      </div>
    </div>
  );
}
