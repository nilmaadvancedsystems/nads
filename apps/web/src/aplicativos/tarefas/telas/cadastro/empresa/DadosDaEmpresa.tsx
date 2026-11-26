// Cadastro › a empresa, no estilo das configurações do Notion (Vitor, 14/10/2026: "adicionando na parte de empresa os
// dados dela, e melhorando a parametrização no estilo do Notion; parametrizações por setor"). Três telas:
//   - DadosDaEmpresa (Empresa): a identificação e a situação na Receita (o que o Entregas já tem e, desde 17/11/2026, o
//     Consultar na Receita: a consulta na hora, o antes × depois e o gravar só o escolhido), o contato e os sócios; a razão
//     social, que só o diretor troca (13/11/2026);
//   - ParametrosContabeis (Contábil › Parâmetros): os cartões, a liquidação de cobrança e a nota de honorário;
//   - ParametrosFiscais (Fiscal › Parâmetros): o regime tributário, se presta serviços e os parâmetros da planilha do
//     Fiscal (29/10/2026: segmento, monofásico, ICMS-ST, antecipação, DIFAL, retenções, benefício, parcelamento…).
// Cada opção numa linha solta (ConfigLinha): o nome, a descrição curta e o controle à direita.
import { empresas } from '@nads/core';
import { BotaoAcao, BotaoIcone, ConfigLinha, ConfigSecao, Icone, Interruptor, LogoSci, MenuSuspenso, SeletorMes, useCarregando } from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { JanelaDaReceita } from './JanelaDaReceita';
import { useDadosDaEmpresa } from './useDadosDaEmpresa';

const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso; };
const Valor = ({ v }: { v: string }) => <span className={'cfg-valor' + (v ? '' : ' vazio')}>{v || '—'}</span>;

/** Um dado da grade (26/11/2026: "os elementos estao muito baguncados"): o nome em cima, o valor embaixo; largo ocupa as duas colunas. */
function Dado({ rotulo, valor, largo, manual, children }: { rotulo: string; valor?: ReactNode; largo?: boolean; manual?: boolean; children?: ReactNode }) {
  const vazio = valor == null || valor === '';
  return (
    <div className={'cad-dado' + (largo ? ' largo' : '')}>
      <span className="cad-dado-rotulo">{rotulo}{manual && <span className="cad-dado-selo" title="Digitado no nads, no lugar do da Receita">à mão</span>}</span>
      {valor !== undefined && <span className={'cad-dado-valor' + (vazio ? ' vazio' : '')}>{vazio ? '—' : valor}</span>}
      {children}
    </div>
  );
}

/**
 * A razão social (13/11/2026: "poder trocar a razão social pelo próprio sistema"): só o diretor troca aqui. A troca
 * é só o nome que aparece e que a busca acha; os dados da empresa continuam presos ao nome de sempre (nada se perde).
 */
function DadoDaRazaoSocial({ vm }: { vm: ReturnType<typeof useDadosDaEmpresa> }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const t = vm.trocaDaRazao;
  const abrir = (v: string) => { setTexto(v); setErro(null); setEditando(true); };
  const salvar = () => { const e = vm.trocarRazaoSocial(texto); setErro(e); if (!e) setEditando(false); };
  const nota = t
    ? <>Trocada por {t.por} em {dataBr(t.em.slice(0, 10))}{t.anteriores[0] ? <> · antes: {t.anteriores[0].nome}</> : null}</>
    : vm.razaoDaReceita && vm.podeTrocarRazao ? <>Na Receita: {vm.razaoDaReceita}</> : null;
  if (editando) {
    return (
      <Dado rotulo="Razão social" largo>
        <span className="cad-dado-edita">
          <input type="text" className="input" aria-label="Razão social nova" value={texto} maxLength={empresas.cadastro.MAX_RAZAO_SOCIAL} autoFocus
            onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false); }} />
          <button type="button" className="btn btn-primary btn-sm" onClick={salvar}>Salvar</button>
          <button type="button" className="btn btn-sm" onClick={() => setEditando(false)}>Cancelar</button>
        </span>
        {erro ? <span className="cad-dado-aviso">{erro}</span> : <span className="cad-dado-nota">Os extratos, a conferência, as rotinas e as senhas continuam com a empresa.</span>}
      </Dado>
    );
  }
  return (
    <Dado rotulo="Razão social" largo>
      <span className="cad-dado-linha">
        <span className="cad-dado-valor">{vm.razaoSocial || '—'}</span>
        {vm.podeTrocarRazao && vm.razaoDaReceita && !t && <button type="button" className="btn btn-sm" onClick={() => abrir(vm.razaoDaReceita)}>Usar a da Receita</button>}
        {vm.podeTrocarRazao && <BotaoIcone icone="lapis" pequeno titulo="Trocar a razão social" onClick={() => abrir(vm.razaoSocial)} />}
      </span>
      {nota && <span className="cad-dado-nota">{nota}</span>}
    </Dado>
  );
}

/**
 * A identificação, numa grade de duas colunas, e o Editar (26/11/2026: "queria cadastrar a empresa manualmente tbm, ter essa
 * opcao"): o CNPJ, o nome fantasia, a inscrição estadual e o endereço digitados à mão valem no lugar dos da Receita; o campo
 * vazio volta a usar o de lá.
 */
function Identificacao({ vm, daReceita, acaoDaReceita }: { vm: ReturnType<typeof useDadosDaEmpresa>; daReceita?: ReactNode; acaoDaReceita?: ReactNode }) {
  const d = vm.dados;
  const [editando, setEditando] = useState(false);
  const [t, setT] = useState({ cnpj: '', fantasia: '', inscricaoEstadual: '', endereco: '' });
  const [erro, setErro] = useState<string | null>(null);
  const cnpj = vm.cnpj ? empresas.cadastro.cnpjFormatado(vm.cnpj) : '';
  const abrir = () => { setT({ cnpj, fantasia: d.fantasia.valor, inscricaoEstadual: d.inscricaoEstadual.valor, endereco: d.endereco.valor }); setErro(null); setEditando(true); };
  const salvar = () => { const e = vm.gravarDadosManuais(t); setErro(e); if (!e) setEditando(false); };
  const campo = (k: keyof typeof t, rotulo: string, dica: string, largo?: boolean, max?: number) => (
    <Dado rotulo={rotulo} largo={largo}>
      <input type="text" className="input" aria-label={rotulo} value={t[k]} placeholder={dica} maxLength={max}
        onChange={e => setT(x => ({ ...x, [k]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false); }} />
    </Dado>
  );
  const max = empresas.cadastro.MAX_DADO_MANUAL;
  return (
    <ConfigSecao titulo="Identificação" acao={editando
      ? <span className="cfg-razao"><button type="button" className="btn btn-sm" onClick={() => setEditando(false)}>Cancelar</button><button type="button" className="btn btn-primary btn-sm" onClick={salvar}>Salvar</button></span>
      : <span className="cfg-razao">{acaoDaReceita}<button type="button" className="btn btn-ghost btn-sm" onClick={abrir} title="Digitar os dados da empresa à mão"><Icone nome="lapis" />Editar</button></span>}>
      <div className="cad-dados-grade">
        <DadoDaRazaoSocial vm={vm} />
        {editando ? (
          <>
            {campo('cnpj', 'CNPJ ou CPF', '00.000.000/0000-00')}
            <Dado rotulo="Código no Alterdata" valor={vm.empresa?.codigo != null ? String(vm.empresa.codigo) : ''} />
            {campo('fantasia', 'Nome fantasia', 'Como a empresa é conhecida', false, max.fantasia)}
            {campo('inscricaoEstadual', 'Inscrição estadual', 'Só os números ou ISENTO', false, max.inscricaoEstadual)}
            {campo('endereco', 'Endereço', 'Rua, número, bairro, cidade/UF, CEP', true, max.endereco)}
            <span className="cad-dado largo cad-dado-nota">{erro ? <span className="cad-dado-aviso">{erro}</span> : 'Apague o campo para voltar a usar o dado da Receita.'}</span>
          </>
        ) : (
          <>
            <Dado rotulo="CNPJ" valor={cnpj} />
            <Dado rotulo="Código no Alterdata" valor={vm.empresa?.codigo != null ? String(vm.empresa.codigo) : ''} />
            <Dado rotulo="Nome fantasia" valor={d.fantasia.valor} manual={d.fantasia.manual} />
            <Dado rotulo="Inscrição estadual" valor={d.inscricaoEstadual.valor} manual={d.inscricaoEstadual.manual} />
            <Dado rotulo="Endereço" valor={d.endereco.valor} manual={d.endereco.manual} largo />
          </>
        )}
        {/* o que a Receita diz, na mesma grade (26/11/2026: "Coloca isso tudo dentro de identificacao") */}
        {daReceita}
      </div>
    </ConfigSecao>
  );
}

/** A linha de baixo do responsável: de onde ele veio e a transferência pedida, se houver. */
function descricaoDoResponsavel(x: ReturnType<typeof useDadosDaEmpresa>['responsaveis'][number]): string | undefined {
  const partes = [
    x.origem === 'planilha' ? 'Da planilha do Checklist Folha' : '',
    x.origem === 'fora' ? x.foraDaEquipe + ' não está mais na equipe' : '',
    x.transferencia ? 'Transferência pedida para ' + x.transferencia.para + (x.transferencia.faltam.length ? ' (falta o aceite de ' + x.transferencia.faltam.join(' e ') + ')' : '') : '',
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : undefined;
}

/** Empresa: os dados dela, o contato e os sócios. */
export function DadosDaEmpresa({ rota }: { rota: string }) {
  const vm = useDadosDaEmpresa(rota);
  // a linha nova (vazia) do Adicionar sócio, até ganhar um nome ou um CPF
  const [novo, setNovo] = useState(false);
  // o e-mail ou o WhatsApp inválido não grava: o aviso fica ao lado, até a próxima tentativa
  const [erroDoContato, setErroDoContato] = useState<string | null>(null);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  const nr = vm.naReceita;
  const linhas = [...vm.socios, ...(novo ? [{ nome: '', cpf: '' }] : [])];
  /** grava ao sair do campo: a lista inteira, com esta linha trocada */
  const mudar = (i: number, campo: 'nome' | 'cpf', v: string) => {
    const lista = [...vm.socios];
    if (i < vm.socios.length) lista[i] = { ...lista[i], [campo]: v };
    else { lista.push({ nome: '', cpf: '', [campo]: v }); if (v.trim()) setNovo(false); }
    vm.definirSocios(lista);
  };
  const tirar = (i: number) => { if (i >= vm.socios.length) setNovo(false); else vm.definirSocios(vm.socios.filter((_, j) => j !== i)); };
  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };
  const ativa = !nr.situacao || nr.situacao === 'ATIVA';
  const simples = nr.mei?.optante ? 'MEI' + (nr.mei.desde ? ' desde ' + dataBr(nr.mei.desde) : '')
    : nr.simples?.optante ? 'Simples' + (nr.simples.desde ? ' desde ' + dataBr(nr.simples.desde) : '')
      : nr.simples?.optante === false ? 'Fora do Simples' + (nr.simples.exclusao ? ' (excluída em ' + dataBr(nr.simples.exclusao) + ')' : '') : '';
  const conferido = vm.conferidoNaReceita;
  return (
    <>
      {/* a identificação com o que a Receita diz na mesma grade e o Consultar na Receita no topo (26/11/2026: "Coloca isso tudo
          dentro de identificacao"); o retrato é o do vigia do Entregas (toda semana) ou o gravado aqui (17/11/2026) */}
      <Identificacao vm={vm}
        acaoDaReceita={(
          <BotaoAcao className="btn btn-sm" carregando={vm.consulta.consultando} textoCarregando="Consultando…" disabled={!vm.consulta.temCnpj}
            title={vm.consulta.temCnpj ? 'Consultar o CNPJ na Receita agora' : 'A empresa não tem CNPJ'} onClick={() => { void vm.consulta.consultar(); }}>
            <Icone nome="girar" />Consultar na Receita
          </BotaoAcao>
        )}
        daReceita={(
          <>
            {vm.consulta.erro && <span className="cad-dado largo cad-dado-aviso">A consulta não deu certo: {vm.consulta.erro}</span>}
            {!nr.situacao ? (
              <span className="cad-dado largo cad-dado-nota">{vm.entregas.carregado ? 'Ninguém consultou o CNPJ desta empresa na Receita ainda. Use Consultar na Receita.' : 'Lendo o Entregas…'}</span>
            ) : (
              <>
                <Dado rotulo="Situação">
                  <span className="cad-dado-linha"><span className={'badge ' + (ativa ? 'badge-ok' : 'badge-bad')}>{nr.situacao}</span>
                    {nr.situacaoDesde && <span className="cad-dado-nota">desde {dataBr(nr.situacaoDesde)}</span>}</span>
                  {!ativa && <span className="cad-dado-aviso">A empresa não está ativa na Receita.{nr.motivoSituacao ? ' ' + nr.motivoSituacao : ''}</span>}
                </Dado>
                <Dado rotulo="Simples / MEI" valor={simples} />
                <Dado rotulo="Atividade principal" largo valor={nr.cnae ? nr.cnae.codigo + (nr.cnae.descricao ? ' · ' + nr.cnae.descricao : '') : ''} />
                {nr.cnaesSecundarios && <Dado rotulo="Atividades secundárias" largo valor={nr.cnaesSecundarios.length ? nr.cnaesSecundarios.map(x => x.codigo + (x.descricao ? ' ' + x.descricao : '')).join(' · ') : 'Nenhuma'} />}
                <Dado rotulo="Natureza jurídica" valor={nr.naturezaJuridica || ''} />
                <Dado rotulo="Porte" valor={nr.porte || ''} />
                <Dado rotulo="Capital social" valor={nr.capitalSocial != null ? 'R$ ' + nr.capitalSocial.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''} />
                <Dado rotulo="Abertura" valor={dataBr(nr.abertura || '')} />
              </>
            )}
            {conferido && <span className="cad-dado largo cad-dado-nota">Na Receita: conferido em {dataBr(conferido.em.slice(0, 10))}{conferido.por ? ' por ' + conferido.por : ''}</span>}
          </>
        )} />
      {/* quem cuida da empresa (17/11/2026: "a função de eu alterar o responsável fiscal e contábil aqui"): o Diretor troca
          direto, sem pedir o aceite; a transferência pedida no departamento cai */}
      <ConfigSecao titulo="Responsáveis">
        {vm.responsaveis.map(x => (
          <ConfigLinha key={x.dep} titulo={x.rotulo} descricao={descricaoDoResponsavel(x)}>
            {vm.podeTrocarResponsavel
              ? <MenuSuspenso rotulo={x.atual || 'Escolher'} className="btn btn-ghost" titulo={'Responsável no ' + x.rotulo} direita largura={220}
                  itens={[
                    ...x.opcoes.map(n => ({ rotulo: n, marcado: x.origem === 'cadastro' && x.atual === n, onClick: () => vm.trocarResponsavel(x.dep, n) })),
                    ...(x.origem === 'cadastro' || x.origem === 'fora' ? ['separador' as const, { rotulo: x.daPlanilha ? 'Voltar ao da planilha (' + x.daPlanilha + ')' : 'Sem responsável', onClick: () => vm.trocarResponsavel(x.dep, '') }] : []),
                  ]} />
              : <Valor v={x.atual} />}
          </ConfigLinha>
        ))}
      </ConfigSecao>

      {vm.consulta.aberta && <JanelaDaReceita consulta={vm.consulta} />}

      {/* o contato da empresa (Vitor, 07/10/2026): o Mandei manda as perguntas de Clientes e Fornecedores para os dois */}
      <ConfigSecao titulo="Contato">
        <ConfigLinha titulo="E-mail"
          aviso={erroDoContato && erroDoContato.startsWith('E-mail') ? erroDoContato : undefined}>
          <label className="busca-curta" title="O e-mail da empresa">
            <Icone nome="envelope" />
            <input key={'email|' + vm.email} type="email" aria-label="E-mail da empresa" defaultValue={vm.email} placeholder="financeiro@empresa.com.br"
              onBlur={e => setErroDoContato(vm.definirContato('email', e.target.value))} onKeyDown={enter} />
          </label>
        </ConfigLinha>
        <ConfigLinha titulo="WhatsApp"
          aviso={erroDoContato && erroDoContato.startsWith('WhatsApp') ? erroDoContato : undefined}>
          <label className="busca-curta" title="O WhatsApp da empresa, com o DDD">
            <Icone nome="mensagem" />
            <input key={'whatsapp|' + vm.whatsapp} type="tel" inputMode="numeric" aria-label="WhatsApp da empresa" defaultValue={vm.whatsapp} placeholder="(38) 99999-8888"
              onBlur={e => setErroDoContato(vm.definirContato('whatsapp', e.target.value))} onKeyDown={enter} />
          </label>
        </ConfigLinha>
        <ConfigLinha titulo="Outros e-mails"
          aviso={erroDoContato && erroDoContato.startsWith('Algum') ? erroDoContato : undefined}>
          <label className="busca-curta" title="Mais gmails da empresa: o DP Envios manda para eles também">
            <Icone nome="envelope" />
            <input key={'outros|' + vm.outrosEmails.join(',')} type="text" aria-label="Outros e-mails da empresa" defaultValue={vm.outrosEmails.join(', ')} placeholder="outro@empresa.com.br, mais@empresa.com.br"
              onBlur={e => setErroDoContato(vm.definirOutrosEmails(e.target.value))} onKeyDown={enter} />
          </label>
        </ConfigLinha>
      </ConfigSecao>

      {/* os sócios, com o nome e o CPF (Vitor, 06/10/2026): o relatório da etapa Bancos mostra a transferência para eles */}
      <ConfigSecao titulo="Sócios" acao={(
        <>
          {vm.sociosDaReceita.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => vm.importarSociosDaReceita(vm.sociosDaReceita)} title={vm.sociosDaReceita.join(', ')}>
              Usar os da Receita ({vm.sociosDaReceita.length})
            </button>
          )}
          <button type="button" className="btn" disabled={novo} onClick={() => setNovo(true)}><Icone nome="plus" />Adicionar sócio</button>
        </>
      )}>
        {!linhas.length ? <ConfigLinha titulo="Nenhum sócio" /> : linhas.map((so, i) => (
          <div key={i + '|' + so.nome + '|' + so.cpf} className="cfg-linha cfg-socio">
            <input type="text" aria-label="Nome do sócio" defaultValue={so.nome} placeholder="Nome completo" autoFocus={i >= vm.socios.length}
              onBlur={e => { if (e.target.value.trim() !== so.nome) mudar(i, 'nome', e.target.value); }} onKeyDown={enter} />
            <input type="text" aria-label="CPF do sócio" inputMode="numeric" defaultValue={so.cpf} placeholder="CPF"
              onBlur={e => { if (e.target.value.replace(/\D/g, '') !== so.cpf) mudar(i, 'cpf', e.target.value); }} onKeyDown={enter} />
            <BotaoIcone icone="x" pequeno titulo="Tirar o sócio" onClick={() => tirar(i)} />
          </div>
        ))}
      </ConfigSecao>
      <ConfigSecao titulo="Área do Cliente">
        {/* o lembrete de vencimento por cliente (17/11/2026, o dono: "quero que a parte de vencimento tenha como escolher por cliente") */}
        <ConfigLinha titulo="Lembrete de vencimento" descricao="E-mail ao cliente das guias que vencem logo e que ele ainda não abriu na Área do Cliente.">
          <MenuSuspenso className="btn btn-outline" titulo="Lembrete de vencimento"
            rotulo={vm.lembrete.modo === 'sim' ? 'Mandar' + (vm.lembrete.diasAntes != null ? ' · ' + (vm.lembrete.diasAntes === 0 ? 'só no dia' : vm.lembrete.diasAntes + ' dia(s) antes') : '') : vm.lembrete.modo === 'nao' ? 'Não mandar' : 'Como o escritório'}
            itens={[
              { rotulo: 'Como o escritório (Robôs › Ajustes)', marcado: vm.lembrete.modo === 'padrao', onClick: () => vm.definirLembrete('padrao') },
              { rotulo: 'Mandar, nos dias do escritório', marcado: vm.lembrete.modo === 'sim' && vm.lembrete.diasAntes == null, onClick: () => vm.definirLembrete('sim') },
              ...[0, 1, 2, 3, 5].map(n => ({ rotulo: 'Mandar, ' + (n === 0 ? 'só no dia do vencimento' : 'de ' + n + ' dia(s) antes até o dia'), marcado: vm.lembrete.modo === 'sim' && vm.lembrete.diasAntes === n, onClick: () => vm.definirLembrete('sim', n) })),
              { rotulo: 'Não mandar', marcado: vm.lembrete.modo === 'nao', onClick: () => vm.definirLembrete('nao') },
            ]} />
        </ConfigLinha>
      </ConfigSecao>
    </>
  );
}

/** Contábil › Parâmetros: o que liga as etapas do Contábil. */
export function ParametrosContabeis({ rota }: { rota: string }) {
  const vm = useDadosDaEmpresa(rota);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  // ligado = Sim; desligado = Não (ou ainda não informado)
  const chave = (campo: 'cartaoEmpresarial' | 'vendeNoCartao' | 'credLiquidacao', rotulo: string) => (
    <Interruptor ligado={vm[campo] === true} rotulo={rotulo} onMudar={() => vm.definirCartao(campo, vm[campo] !== true)} />
  );
  return (
    <>
      {/* em Despesas e Receitas (26/11/2026: "Despesas: Compras no cartao, Emite nota de honorario. Receitas: Possui Maquininha,
          Liquidacao de Cobranca, ao marcar sim, que aparece as opcoes") */}
      <ConfigSecao titulo="Despesas">
        {/* o nome na tela (26/11/2026: "Troca para, Compras no Cartao"); o campo continua o cartaoEmpresarial */}
        <ConfigLinha titulo="Compras no cartão">
          {chave('cartaoEmpresarial', 'Compras no cartão')}
        </ConfigLinha>
        {/* a nota de honorário (Vitor, 07/10/2026): sem nota, a etapa Honorários pede o Extrato por cobrança */}
        <ConfigLinha titulo="Emite nota de honorário">
          <Interruptor ligado={vm.emiteNotaHonorario === true} rotulo="Emite nota de honorário" onMudar={() => vm.definirNotaDeHonorario(vm.emiteNotaHonorario !== true)} />
        </ConfigLinha>
      </ConfigSecao>
      <ConfigSecao titulo="Receitas">
        {/* o nome na tela (26/11/2026: "Possui Maquininha"); o campo continua o vendeNoCartao */}
        <ConfigLinha titulo="Possui maquininha">
          {chave('vendeNoCartao', 'Possui maquininha')}
        </ConfigLinha>
        {/* o Creditor (Vitor, 08/10/2026): a empresa recebe liquidação de cobrança do banco (CRÉD.LIQ.COBRANÇA) */}
        <ConfigLinha titulo="Liquidação de cobrança (Creditor)">
          {chave('credLiquidacao', 'Liquidação de cobrança')}
        </ConfigLinha>
        {/* de quais bancos vem o relatório (Vitor, 14/10/2026: "checks, Bradesco e Sicoob"): o importar automático procura esses;
            só com a liquidação ligada (26/11/2026: "ao marcar sim, que aparece as opcoes") */}
        {vm.credLiquidacao === true && (
          <ConfigLinha titulo="Relatório de liquidação">
            <span style={{ display: 'inline-flex', gap: 16 }}>
              {empresas.cadastro.BANCOS_DO_RELATORIO.map(b => (
                <label key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={vm.relatoriosDeLiquidacao.includes(b.id)} onChange={e => vm.marcarRelatorioDeLiquidacao(b.id, e.target.checked)} />
                  {b.nome}
                </label>
              ))}
            </span>
          </ConfigLinha>
        )}
      </ConfigSecao>
    </>
  );
}

/**
 * O SCI da empresa (26/11/2026: "Estar na sci nao e contabil nem fiscal, pode deixar em primeiro de todos, coloca o icone da sci";
 * "Data tambem, porque a partir de tal competencia entra na sci"): está no SCI (só as ligadas aparecem no minimum), o plano de
 * contas do SCI e a competência em que entrou. Em primeiro nas Particularidades.
 */
export function SciDaEmpresa({ rota }: { rota: string }) {
  const vm = useDadosDaEmpresa(rota);
  if (vm.carregando || !vm.comSci) return null;
  return (
    // sem a linha divisória e com a logo na mesma linha do "Está no SCI" (26/11/2026: "Remove essa linha divisoria, coloque tudo na
    // mesma linha")
    <div className="cfg-linhas cad-sci-bloco">
      {/* está no SCI (Vitor, 24/11/2026: "ja que sairam do alterdata"): só as ligadas aparecem no minimum */}
      {/* sem as descrições (26/11/2026: "Remove isso") */}
      <ConfigLinha titulo={<span className="cad-sci-titulo"><LogoSci altura={18} />Está no SCI</span>}>
        <Interruptor ligado={vm.noSci} rotulo="Está no SCI" onMudar={() => vm.definirNoSci(!vm.noSci)} />
      </ConfigLinha>
      {vm.noSci && (
        // sem a descrição (26/11/2026: "Remove isso"); o aviso fica enquanto falta a competência
        <ConfigLinha titulo="Desde" aviso={vm.sciDesde ? undefined : 'Informe a competência de entrada no SCI.'}>
          <SeletorMes valor={vm.sciDesde} onMudar={vm.definirSciDesde} rotulo="Competência de entrada no SCI" semValor="Escolher" />
        </ConfigLinha>
      )}
      {/* ligada, pede o plano de contas do SCI (24/11/2026: "referenciar para nao ficar selecionando"): o minimum abre nele */}
      {vm.noSci && (
        // o plano num menu, como o regime (26/11/2026: "Coloque outra maneira de selecionar o plano que vai vim mais"): a lista cresce
        // sem empurrar a linha
        <ConfigLinha titulo="Plano de contas do SCI" aviso={vm.planoSci ? undefined : 'Escolha o plano: sem ele, o minimum pede a cada vez.'}>
          <MenuSuspenso rotulo={vm.planoSci ? 'Plano ' + vm.planoSci : 'Escolher'} className="btn btn-ghost cad-sci-plano" titulo="Plano de contas do SCI" direita largura={200}
            itens={vm.planosDoSci.map(p => ({ rotulo: 'Plano ' + p, marcado: vm.planoSci === p, onClick: () => { if (vm.planoSci !== p) vm.definirNoSci(true, p); } }))} />
        </ConfigLinha>
      )}
    </div>
  );
}

/** Fiscal › Parâmetros: o regime (que monta a rotina do Fiscal) e os serviços. */
export function ParametrosFiscais({ rota }: { rota: string }) {
  const vm = useDadosDaEmpresa(rota);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  return (
    <>
    <ConfigSecao titulo="Tributação">
      {/* o regime (13/10/2026: "no cadastro da empresa tenha os regimes, aí muda na rotina") */}
      <ConfigLinha titulo="Regime tributário"
        aviso={vm.receitaDiscorda ? 'Na Receita: ' + vm.receitaDiscorda + '. Confira.' : undefined}>
        <MenuSuspenso rotulo={vm.regime ?? (vm.regimePadrao || 'Escolher')} className="btn btn-ghost" titulo="Regime tributário" direita largura={200}
          itens={vm.regimes.map(r => ({ rotulo: r, marcado: (vm.regime ?? vm.regimePadrao) === r, onClick: () => { if (vm.regime !== r) vm.definirRegime(r); } }))} />
      </ConfigLinha>
      {vm.regimeComData && (
        <ConfigLinha titulo="A troca de regime vale a partir de" descricao="Os meses antes continuam com o regime anterior, na rotina e no Executor.">
          <MenuSuspenso rotulo={vm.opcoesRegimeDesde.find(o => o.valor === vm.regimeDesde)?.rotulo || vm.regimeDesde} className="btn btn-ghost" titulo="A partir de qual competência" direita largura={200}
            itens={vm.opcoesRegimeDesde.map(o => ({ rotulo: o.rotulo, marcado: o.valor === vm.regimeDesde, onClick: () => vm.setRegimeDesde(o.valor) }))} />
        </ConfigLinha>
      )}
      {vm.regimeComData && vm.trocasDeRegime.length > 1 && (
        <ConfigLinha titulo="Regimes por período" descricao={vm.trocasDeRegime.map(t => t.texto).join(' → ')}>
          <MenuSuspenso rotulo="Desfazer" className="btn btn-ghost" titulo="Desfazer uma troca de regime" direita largura={240}
            itens={vm.trocasDeRegime.filter(t => t.desde).map(t => ({ rotulo: 'Desfazer: ' + t.texto, onClick: () => vm.tirarTrocaDeRegime(t.desde) }))} />
        </ConfigLinha>
      )}
      <ConfigLinha titulo="Presta serviços">
        <Interruptor ligado={vm.prestaServico === true} rotulo="Presta serviços" onMudar={() => vm.definirPrestaServico(vm.prestaServico !== true)} />
      </ConfigLinha>
    </ConfigSecao>
    <ParametrosDaPlanilhaDoFiscal vm={vm} />
    </>
  );
}

/**
 * Fiscal › Parâmetros › a planilha do Fiscal (29/10/2026): o segmento, os de sim ou não e os textos livres. O que veio da
 * planilha aparece assim, e "Voltar à planilha" desfaz tudo o que foi mudado aqui.
 */
function ParametrosDaPlanilhaDoFiscal({ vm }: { vm: ReturnType<typeof useDadosDaEmpresa> }) {
  const mudado = Object.values(vm.origemDoFiscal).includes('cadastro');
  const deOnde = (campo: keyof typeof vm.origemDoFiscal) => vm.origemDoFiscal[campo] === 'planilha' ? 'Da planilha' + (vm.abaDoFiscal ? ' (' + vm.abaDoFiscal.charAt(0) + vm.abaDoFiscal.slice(1).toLowerCase() + ')' : '') + '.'
    : vm.origemDoFiscal[campo] === 'cadastro' ? 'Mudado aqui.' : 'Ainda não informado.';
  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };
  return (
    <ConfigSecao titulo="Parâmetros do Fiscal" acao={mudado ? <button type="button" className="btn btn-ghost" onClick={vm.voltarFiscalAPlanilha}>Voltar à planilha</button> : undefined}>
      <ConfigLinha titulo="Segmento" descricao={deOnde('segmentos')}>
        <span className="usuarios-papeis">
          {vm.segmentosFiscais.map(s => {
            const on = (vm.fiscal.segmentos || []).includes(s.id);
            return <button key={s.id} type="button" className={'chip-f' + (on ? ' on' : '')} aria-pressed={on} onClick={() => vm.alternarSegmento(s.id)}>{s.rotulo}</button>;
          })}
        </span>
      </ConfigLinha>
      {vm.parametrosFiscais.map(p => (
        <ConfigLinha key={p.id} titulo={p.rotulo} descricao={deOnde(p.id)}>
          <Interruptor ligado={vm.fiscal[p.id] === true} rotulo={p.rotulo} onMudar={() => vm.definirFiscal(p.id, vm.fiscal[p.id] !== true)} />
        </ConfigLinha>
      ))}
      {(['especificidades', 'observacoes'] as const).map(k => (
        <ConfigLinha key={k} titulo={k === 'especificidades' ? 'Especificidades' : 'Observações'} descricao={deOnde(k)}>
          <input key={k + '|' + (vm.fiscal[k] || '')} type="text" aria-label={k === 'especificidades' ? 'Especificidades' : 'Observações'} defaultValue={vm.fiscal[k] || ''}
            maxLength={vm.maxTextoDoFiscal} placeholder="—" onBlur={e => vm.definirFiscal(k, e.target.value)} onKeyDown={enter} />
        </ConfigLinha>
      ))}
    </ConfigSecao>
  );
}
