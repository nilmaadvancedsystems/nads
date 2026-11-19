// A janela de registrar (ou mudar) uma comissão (12/11/2026), no desenho das janelas do Financeiro. Pela Carteira, o mês do
// pagamento é sempre o seguinte (e não aparece); o cliente vem do cadastro (o menu com a busca) ou é avulso (o nome e o porte);
// o serviço é um dos comissionados e a comissão sai sozinha, do valor do serviço × a % que o Financeiro definiu. Pelo
// Financeiro (doFinanceiro): a pessoa e qualquer mês (a retroativa), já aprovada. Depois de decidida, só ver.
import { carteira, formatos } from '@nads/core';
import { BotaoFechar, CampoData, CampoDataComCalendario, CampoReais, Icone, MenuSuspenso, useJanela } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useJanelaDaComissao, type ClienteDaLista, type ClienteSemCodigo } from './useCarteiraDaPessoa';
import { MeiDaComissao } from './MeiDaComissao';
import { ehServicoDeMei } from './useMeiDaComissao';

const ESCOLHA = 'btn btn-ghost registro-escolha';
const comMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * O cliente: o menu com a busca nos clientes do cadastro e, no alto, o "Cliente avulso" (não está no cadastro). A busca fica
 * parada em cima e só a lista rola, baixa, para o menu caber colado no botão (Vitor, 12/11/2026: "Dropdown tá estranho" —
 * a lista inteira abria para cima, cortada no topo da tela, e a busca sumia junto).
 */
function EscolherCliente({ clientes, semCodigo = [], codigo, avulso, rotulo, travada, onCliente, onAvulso, onSemCodigo }: {
  clientes: readonly ClienteDaLista[]; semCodigo?: readonly ClienteSemCodigo[]; codigo: number | null; avulso: boolean; rotulo: string; travada: boolean;
  onCliente: (codigo: number) => void; onAvulso: () => void; onSemCodigo?: (c: ClienteSemCodigo) => void;
}) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const achados = (q ? clientes.filter(c => (c.codigo + ' ' + c.nome).toLowerCase().includes(q)) : clientes).slice(0, 80);
  // as do Cadastro ainda sem código (o MEI registrado pelo cartão; 19/11/2026)
  const semCodigoAchados = (q ? semCodigo.filter(c => c.nome.toLowerCase().includes(q)) : semCodigo).slice(0, 40);
  if (travada) return <span>{rotulo || '—'}</span>;
  const escolher = (fechar: () => void, f: () => void) => { fechar(); f(); setBusca(''); };
  return (
    <MenuSuspenso rotulo={avulso ? 'Cliente avulso' : rotulo || 'Escolher o cliente'} className={ESCOLHA + (avulso || rotulo ? '' : ' vazio')} titulo="O cliente" flutuante largura={380}
      conteudo={fechar => (
        <>
          <label className="busca-curta larga">
            <Icone nome="search" />
            {/* o foco depois de o menu aparecer (ele nasce escondido, enquanto mede onde cabe, e o autoFocus se perdia) */}
            <input type="text" placeholder="Buscar pelo nome ou código" aria-label="Buscar o cliente" value={busca} onChange={e => setBusca(e.target.value)}
              ref={el => { if (el && document.activeElement !== el) setTimeout(() => el.focus(), 0); }}
              onKeyDown={e => { if (e.key === 'Enter' && achados.length === 1) escolher(fechar, () => onCliente(achados[0].codigo)); }} />
          </label>
          <div className="menu-busca-lista">
            <button type="button" className="popover-item" role="menuitemcheckbox" aria-checked={avulso} onClick={() => escolher(fechar, onAvulso)}>
              <span className="popover-marca">{avulso && <Icone nome="check" />}</span>
              <span className="popover-texto"><b>Cliente avulso</b><br /><span className="hint">Não está no cadastro: escreva o nome e o porte</span></span>
            </button>
            {achados.map(c => (
              <button key={c.codigo} type="button" className="popover-item" role="menuitemcheckbox" aria-checked={!avulso && c.codigo === codigo} onClick={() => escolher(fechar, () => onCliente(c.codigo))}>
                <span className="popover-marca">{!avulso && c.codigo === codigo && <Icone nome="check" />}</span>
                <span className="popover-texto"><b className="num">{c.codigo}</b> {c.nome}</span>
              </button>
            ))}
            {onSemCodigo && semCodigoAchados.map(c => (
              <button key={'sem|' + c.nome} type="button" className="popover-item" role="menuitemcheckbox" aria-checked={avulso && rotulo === c.nome} onClick={() => escolher(fechar, () => onSemCodigo(c))}>
                <span className="popover-marca">{avulso && rotulo === c.nome && <Icone nome="check" />}</span>
                <span className="popover-texto">{c.nome} <span className="hint">· sem código{c.porte ? ' · ' + c.porte : ''}</span></span>
              </button>
            ))}
            {!achados.length && !(onSemCodigo && semCodigoAchados.length) && <p className="hint">Nenhum cliente com essa busca.</p>}
          </div>
        </>
      )} />
  );
}

export function JanelaDaComissao({ comissao, fechar, doFinanceiro = false }: { comissao: carteira.Comissao | null; fechar: () => void; doFinanceiro?: boolean }) {
  const vm = useJanelaDaComissao(comissao, fechar, doFinanceiro);
  // o calendário ao lado da data, a comissão em destaque e o MEI (19/11/2026): na Carteira (que só abre no modo desenvolvedor e,
  // na final, para os diretores); na janela do Financeiro, só no modo desenvolvedor
  const [modoDev] = useModoDesenvolvedor();
  const dev = modoDev || !doFinanceiro;
  const { travada, erros, salvando } = vm;
  const destaque = dev && !vm.oculta && !travada && !doFinanceiro;
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const titulo = !comissao ? 'Registrar comissão' : travada ? 'Comissão' : 'Mudar comissão';
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.salvar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />{doFinanceiro ? 'Comissões da equipe' : 'Carteira'}<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className={'registro-corpo' + (destaque ? ' comissao-com-destaque' : '')}>
          {/* a comissão grande no alto, à direita (Vitor, 19/11/2026: "deixa esse valor grande, na parte superior direita, que ta meio
              vazia") */}
          {destaque && (
            <div className="comissao-destaque">
              <span>Comissão</span><b className="num" aria-live="polite">{formatos.reais(vm.valor)}</b>
              {/* a % da comissão, só para o Diretor e o Dono, num select de 5 em 5 até 50% embaixo do valor (Vitor, 19/11/2026: "coloca so uma
                  box de select abaixo do valor comissao, que aumenta de 5 em 5 e chega ate 50%"); "A do serviço" volta para a % do serviço */}
              {vm.podeDefinirPercentual && (
                <MenuSuspenso rotulo={vm.pctDoDiretor ? vm.pctDoDiretor + '%' : vm.percentualDoServico ? vm.percentualDoServico + '% do serviço' : 'Escolher a %'}
                  className={'btn btn-outline comissao-pct-menu' + (vm.pctDoDiretor || vm.percentualDoServico ? '' : ' vazio')} titulo="A % da comissão (só o Diretor define)" flutuante direita largura={180}
                  itens={[
                    { rotulo: vm.percentualDoServico ? 'A do serviço (' + vm.percentualDoServico + '%)' : 'A do serviço', marcado: !vm.pctDoDiretor, onClick: () => vm.setPctDoDiretor('') },
                    ...[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(n => ({ rotulo: n + '%', marcado: vm.pctDoDiretor === String(n), onClick: () => vm.setPctDoDiretor(String(n)) })),
                  ]} />
              )}
            </div>
          )}
          {/* a escondida (16/11/2026): só "Registrada", sem o valor; para mudar, apaga e registra de novo */}
          {travada && comissao!.oculta && comissao!.situacao === 'lancada' && <p className="registro-dica"><Icone nome="lock" />Registrada. Para mudar, apague e registre de novo.</p>}
          {travada && !(comissao!.oculta && comissao!.situacao === 'lancada') && <p className="registro-dica"><Icone nome="lock" />{comissao!.situacao === 'recusada' ? 'Recusada pelo Financeiro' + (comissao!.motivo ? ': ' + comissao!.motivo : '.') : 'Já ' + carteira.rotuloDaSituacao(comissao!.situacao).toLowerCase() + ' pelo Financeiro: não muda mais.'}</p>}
          {doFinanceiro && <p className="registro-dica"><Icone nome="lampada" />Registrada pelo Financeiro, a comissão já entra aprovada e aparece na Carteira da pessoa.</p>}
          <div className="registro-props">
            {doFinanceiro && (
              <Propriedade icone="usuario" rotulo="Pessoa">
                <MenuSuspenso rotulo={vm.para?.nome || 'Escolher a pessoa'} className={ESCOLHA + (vm.para ? '' : ' vazio')} titulo="De quem é a comissão" flutuante largura={280}
                  itens={vm.pessoas.map(p => ({ rotulo: p.nome, marcado: p.uid === vm.para?.uid, onClick: () => vm.setPara(p) }))} />
              </Propriedade>
            )}
            {/* o mês do pagamento só aparece para o Financeiro (a retroativa); pela Carteira ele é sempre o seguinte, sem a linha
                (Vitor, 12/11/2026: "Não precisa do pagar em") */}
            {doFinanceiro && (
              <Propriedade icone="calendar" rotulo="Pagar em">
                <MenuSuspenso rotulo={comMaiuscula(carteira.mesPorExtenso(vm.competencia))} className={ESCOLHA} titulo="O mês do pagamento" flutuante largura={240}
                  itens={vm.mesesDoFinanceiro.map(x => ({ rotulo: comMaiuscula(carteira.mesPorExtenso(x)), marcado: x === vm.competencia, onClick: () => vm.setCompetencia(x) }))} />
              </Propriedade>
            )}
            <Propriedade icone="calendar" rotulo="Data">{travada ? <span>{vm.data}</span> : (dev ? <CampoDataComCalendario valor={vm.data} onMudar={vm.setData} rotulo="Data da venda ou do serviço" /> : <CampoData valor={vm.data} onMudar={vm.setData} rotulo="Data da venda ou do serviço" />)}</Propriedade>
            {/* o porte antes do cliente (Vitor, 19/11/2026: "Antes de selecionar o cliente, colocar porte, antes de tudo, se for MEI, so carregue
                os meis registrados"): com MEI, a lista de clientes traz só as empresas do regime MEI */}
            <Propriedade icone="briefcase" rotulo="Porte">
              {travada ? <span>{vm.porte || '—'}</span> : (
                <MenuSuspenso rotulo={vm.porte || 'Escolher o porte'} className={ESCOLHA + (vm.porte ? '' : ' vazio')} titulo="O porte do cliente" flutuante largura={200}
                  itens={carteira.PORTES.map(p => ({ rotulo: p, marcado: p === vm.porte, onClick: () => vm.setPorte(p) }))} />
              )}
            </Propriedade>
            <Propriedade icone="predio" rotulo="Cliente">
              <EscolherCliente clientes={vm.porte === 'MEI' ? vm.clientes.filter(c => c.regime === 'MEI') : vm.clientes} semCodigo={vm.porte === 'MEI' ? vm.clientesSemCodigo.filter(c => c.porte === 'MEI') : vm.clientesSemCodigo} codigo={vm.clienteCodigo} avulso={vm.avulso} rotulo={vm.avulso ? vm.nomeAvulso : vm.cliente} travada={travada}
                onCliente={vm.escolherCliente} onAvulso={vm.marcarAvulso} onSemCodigo={c => vm.escolherSemCodigo(c.nome, c.porte)} />
            </Propriedade>
            {vm.avulso && (
              <>
                <Propriedade icone="fileText" rotulo="Nome">
                  <input type="text" autoFocus={!comissao} value={vm.nomeAvulso} disabled={travada} maxLength={150} onChange={e => vm.setNomeAvulso(e.target.value)} placeholder="O nome do cliente" aria-label="Nome do cliente avulso" />
                </Propriedade>
              </>
            )}
            <Propriedade icone="checklist" rotulo="Serviço">
              {travada ? <span>{vm.servico || comissao?.descricao || '—'}</span> : (
                <MenuSuspenso rotulo={vm.servico || 'Escolher o serviço'} className={ESCOLHA + (vm.servico ? '' : ' vazio')} titulo="O serviço comissionado" flutuante largura={320}
                  itens={vm.servicos.map(s => ({ rotulo: s.nome, marcado: s.nome === vm.servico, onClick: () => vm.setServico(s.nome) }))} />
              )}
            </Propriedade>
            {/* Abertura e Alteração de MEI: o cartão CNPJ (registra no sistema, porte MEI) e a senha gov (Vitor, 19/11/2026) */}
            {dev && !travada && ehServicoDeMei(vm.servico) && <MeiDaComissao nome={vm.avulso ? vm.nomeAvulso : vm.cliente} aoLerCartao={nome => { if (vm.clienteCodigo == null && !vm.nomeAvulso.trim()) vm.escolherSemCodigo(nome, 'MEI'); else if (vm.avulso && !vm.porte) vm.setPorte('MEI'); }} />}
            {/* a escondida registrada não mostra o valor do serviço (o robô tira do banco quando calcula) */}
            {!(vm.oculta && comissao) && (
              <Propriedade icone="dinheiro" rotulo="Valor do serviço">
                {/* o R$ pronto e a máscara (Vitor, 13/11/2026: "deixa um cifrao ja pronto") */}
                <CampoReais valor={vm.valorServico} desabilitado={travada} onMudar={vm.setValorServico} rotulo="Valor do serviço (quanto o cliente pagou)" />
              </Propriedade>
            )}
            {/* só o valor, sem a porcentagem (Vitor, 13/11/2026: "oculte a porcentagem para o usuario"; "o valor da comissao aparece, menos a
                porcentagem..., tira isso de financeiro ainda nao decidiu"); a escondida nem o valor (16/11/2026) */}
            {vm.oculta ? (
              <Propriedade icone="check" rotulo="Comissão"><span className="fraco">{comissao ? carteira.rotuloDaSituacao(comissao.situacao) : 'O sistema calcula'}</span></Propriedade>
            ) : !destaque && (
              <Propriedade icone="check" rotulo="Comissão"><span className="num"><b>{formatos.reais(vm.valor)}</b></span></Propriedade>
            )}
          </div>
          {erros.length > 0 && <ul className="registro-erros">{erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
          {vm.podeApagar && <button type="button" className="btn btn-apagar-cheio" onClick={() => void vm.apagar()} title="Apagar" aria-label="Apagar"><Icone nome="lixeira" /></button>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>{travada ? 'Fechar' : 'Cancelar'}</button>
          {!travada && <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => void vm.salvar()} title="Gravar (Ctrl+Enter)"><Icone nome="check" />{comissao ? 'Gravar' : 'Registrar'}</button>}
        </footer>
      </div>
    </div>
  );
}
