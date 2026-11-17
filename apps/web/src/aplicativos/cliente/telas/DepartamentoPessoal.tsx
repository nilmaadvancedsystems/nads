// O Registro da Área do Cliente (12/11/2026: "a função de registro, onde o cliente vai ter acesso aos funcionários
// registrados, folha de pagamento, férias e afins"), no lugar da "Gestão de empregados" do protótipo (Vitor, 16/10/2026):
// o título com Solicitar admissão e Programar férias; os quatro números; os funcionários (pelas guias do FGTS, com o CPF
// mascarado; quem saiu, no interruptor) com a ficha de cada um e os documentos dele; e os documentos do DP mês a mês, por
// categoria (a folha, os recibos, o pró-labore, as férias, as rescisões, o ponto, o FGTS e o INSS), para baixar. Os
// pedidos abrem em janela, como no protótipo, e viram uma solicitação do tipo certo.
// Refeito (12/11/2026): os números no alto; a equipe na largura toda (os ativos ou quem saiu, a busca), a ficha numa janela
// flutuante ("prefiro janela flutuante do que essa lateral"); embaixo, a folha do mês por categoria, no estilo extrato.
// Enxuto (16/11/2026: o dono apresentou a área e ouviu "muita informação"): os três cartões de número viram dois fatos
// embaixo do título; o cartão de cada funcionário só com o nome, o cargo, o salário e um selo quando pede atenção; as
// férias com a data numa frase e a nota numa frase; o custo da folha com o total e três números (o holerite em "Ver
// detalhes"); os documentos da folha só com o nome e o Baixar (o Ver no "⋯"). As janelas não mudaram.
import { CampoData, CampoEscolha, Icone, MenuSuspenso, useRetorno } from '@nads/ui';
import { IconeDoArquivo } from '../partes/IconeDoArquivo';
import { useState } from 'react';
import { Avatar } from '../partes/Avatar';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { ACEITA_FOTO, fotoQuadrada, urlDaFoto } from '../partes/foto';
import { Vazio } from '../partes/Vazio';
import { contaDaAdmissao, contaDasFerias, marcarNoCalendario, mesDasFerias, primeiraDataDasFerias, type PedidoDeAdmissao, type PedidoDeDemissao, type PedidoDeFerias } from '../dados/regras';
import { formatos } from '@nads/core';
import { Colunas } from './Administrativo';
import { useDp, type DadosDoPedido, type Pedido } from './useDp';
import type { DaCasca } from './useAreaCliente';
import { AjudaDaTela } from '../partes/AjudaDaTela';
import { MarcaDaTela } from '../partes/MarcaDaTela';
import './registro.css';

const CONTRATOS = ['Prazo indeterminado', 'Experiência (45 + 45 dias)', 'Estágio', 'Aprendiz'];
const DIAS = ['30 dias', '20 dias e vender 10', '15 dias (primeira parte)', '10 dias (uma parte)'];
/** os dias em botões: o número grande e o que é */
const ROTULO_DOS_DIAS: Record<string, { n: string; t: string }> = {
  '30 dias': { n: '30', t: 'dias corridos' }, '20 dias e vender 10': { n: '20', t: 'e vende 10' },
  '15 dias (primeira parte)': { n: '15', t: 'uma parte' }, '10 dias (uma parte)': { n: '10', t: 'uma parte' },
};
const MOTIVOS = ['O funcionário pediu demissão', 'Dispensa sem justa causa', 'Dispensa com justa causa', 'Fim do contrato de experiência', 'Acordo entre as partes'];
const AVISOS = ['Trabalhado', 'Indenizado', 'Dispensado'];
const TITULO: Record<Pedido, string> = { admissao: 'Solicitar admissão', ferias: 'Programar férias', demissao: 'Pedir desligamento' };

/** o nome e o último sobrenome, para as fichas da janela de férias */
const nomeCurto = (n: string) => { const p = n.split(' ').filter(Boolean); return p.length > 2 ? p[0] + ' ' + p[p.length - 1] : n; };

type PessoaDasFerias = { nome: string; rotulo: string; tom: string; texto: string; limite: string };

/** a foto da admissão no alto da janela: o rosto (toque para escolher), o nome que vai sendo escrito e o Tirar */
function TopoDaAdmissao({ nome, foto, aoMudar }: { nome: string; foto?: string; aoMudar: (b64: string | undefined) => void }) {
  const [erro, setErro] = useState('');
  const escolheu = async (f: File) => {
    try { aoMudar(await fotoQuadrada(f)); setErro(''); } catch (x) { setErro(x instanceof Error ? x.message : 'Não deu para usar esta imagem.'); }
  };
  return (
    <div className="cli-pa-topo cli-largo">
      {foto ? <Avatar nome={nome.trim() || '?'} foto={urlDaFoto(foto)} tamanho={60} onFoto={f => void escolheu(f)} /> : (
        <label className="cli-pa-sem-foto" title="Pôr uma foto">
          <Icone nome="camera" width={22} height={22} />
          <input type="file" className="sr-only" accept={ACEITA_FOTO} aria-label="Pôr uma foto do novo funcionário" onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) void escolheu(f); }} />
        </label>
      )}
      <span className="cli-pa-quem">
        <b>{nome.trim() || 'Novo funcionário'}</b>
        <span className="hint">{foto ? 'Toque na foto para trocar' : 'Uma foto para o crachá e a ficha · opcional'}</span>
        {erro && <span className="cli-erro" role="alert">{erro}</span>}
      </span>
      {foto && <button type="button" className="btn btn-ghost btn-sm" onClick={() => aoMudar(undefined)}>Tirar foto</button>}
    </div>
  );
}

/** uma linha do resumo que a janela monta enquanto preenche (o pagamento, as férias, a volta, o prazo do eSocial) */
function PassoDoResumo({ icone, rotulo, valor, detalhe }: { icone: 'dinheiro' | 'calendar' | 'checkCircle' | 'clock'; rotulo: string; valor: string; detalhe?: string }) {
  return (
    <li className="cli-pf-passo">
      <span className="cli-pf-passo-ico"><Icone nome={icone} width={16} height={16} /></span>
      <span className="cli-pf-passo-txt"><span className="hint">{rotulo}</span><b>{valor}</b>{detalhe && <span className="hint">{detalhe}</span>}</span>
    </li>
  );
}

const LETRAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const mesDoBr = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5);
const andarMes = (mes: string, n: number) => { const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

/** o calendário da janela de férias, como reserva de hotel (13/11/2026: "coloca para poder marcar no calendário para
 *  selecionar os dias, tipo de um hotel"): o primeiro toque marca o começo, o segundo o último dia (com a prévia ao passar o
 *  mouse); o pagamento e a volta aparecem pintados; sexta e sábado, apagados (não podem começar ali). */
function CalendarioDasFerias({ pedido, hoje, aoMarcar }: { pedido: PedidoDeFerias; hoje: Date; aoMarcar: (m: { inicio: string; dias: string }) => void }) {
  const valido = /^\d{2}\/\d{2}\/\d{4}$/.test(pedido.inicio);
  const [visto, setVisto] = useState<string | null>(null);
  const [fase, setFase] = useState<'inicio' | 'fim'>('inicio');
  const [sobre, setSobre] = useState('');
  const mes = visto ?? mesDoBr(valido ? pedido.inicio : primeiraDataDasFerias(hoje));
  const deHoje = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  const escolhendoFim = fase === 'fim' && valido;
  const dias = mesDasFerias(mes, pedido, hoje, escolhendoFim ? sobre : '');
  const tocar = (br: string, doMes: boolean) => {
    const m = marcarNoCalendario(pedido, br, fase);
    setFase(m.fase); setSobre('');
    if (!doMes) setVisto(mesDoBr(br));
    aoMarcar({ inicio: m.inicio, dias: m.dias });
  };
  return (
    <div className={'cli-pf-cal' + (escolhendoFim ? ' escolhendo' : '')} onMouseLeave={() => setSobre('')}>
      <div className="cli-pf-cal-topo">
        <button type="button" className="icon-btn" aria-label="Mês anterior" disabled={mes <= deHoje} onClick={() => setVisto(andarMes(mes, -1))}><Icone nome="chevronLeft" width={16} height={16} /></button>
        <b>{formatos.capital(formatos.rot(mes).toLowerCase())}</b>
        <button type="button" className="icon-btn" aria-label="Próximo mês" onClick={() => setVisto(andarMes(mes, 1))}><Icone nome="chevronRight" width={16} height={16} /></button>
      </div>
      {/* o passo da escolha, como no hotel */}
      <p className="cli-pf-cal-passo" aria-live="polite">
        <span className={'cli-pf-cal-etapa' + (!escolhendoFim ? ' agora' : ' feita')}><i>1</i>Primeiro dia</span>
        <span className="cli-pf-cal-seta" aria-hidden="true" />
        <span className={'cli-pf-cal-etapa' + (escolhendoFim ? ' agora' : '')}><i>2</i>Último dia</span>
      </p>
      <div className="cli-pf-cal-grade" role="grid" aria-label={escolhendoFim ? 'Escolha o último dia das férias' : 'Escolha o primeiro dia das férias'}>
        {LETRAS_DA_SEMANA.map((l, k) => <span key={'s' + k} className="cli-pf-cal-sem" aria-hidden="true">{l}</span>)}
        {dias.map(d => (
          <button key={d.br} type="button" disabled={d.passou}
            className={'cli-pf-cal-dia' + (d.doMes ? '' : ' fora') + (d.hoje ? ' hoje' : '') + (d.ferias ? ' ferias' : '') + (d.inicio ? ' ini' : '') + (d.fim ? ' fim' : '') + (d.volta ? ' volta' : '') + (d.pagamento ? ' pag' : '') + (d.evitar ? ' evitar' : '')}
            aria-pressed={d.inicio || d.fim} aria-label={d.br + (d.pagamento ? ', pagamento' : d.inicio ? ', primeiro dia' : d.fim ? ', último dia' : d.volta ? ', volta' : '')}
            onMouseEnter={() => { if (escolhendoFim) setSobre(d.br); }}
            onClick={() => tocar(d.br, d.doMes)}>
            <span>{d.dia}</span>
          </button>
        ))}
      </div>
      <div className="cli-pf-cal-legenda" aria-hidden="true">
        <span><i className="pag" />Pagamento</span><span><i className="ferias" />Férias</span><span><i className="volta" />Volta</span>
      </div>
    </div>
  );
}

/** o formulário de um pedido dentro da janela; cada mudança volta para quem abriu (que envia ao fechar com "Enviar")
 *  (13/11/2026: "melhore visualmente esses dois, principalmente a parte de programar férias"): as férias escolhem a pessoa
 *  por cartões (com o selo das férias de cada um), os dias em botões e mostram a conta (o pagamento, de quando a quando e a
 *  volta); a admissão tem a foto no alto, os campos em dois blocos e o prazo do eSocial pela data. */
function FormDoPedido({ pedido, inicial, erro, nomes, equipe, hoje, aoMudar }: { pedido: Pedido; inicial: DadosDoPedido; erro: string; nomes: string[]; equipe: PessoaDasFerias[]; hoje: Date; aoMudar: (d: DadosDoPedido) => void }) {
  const [d, setD] = useState(inicial);
  // pelo valor de antes (duas mudanças seguidas não se atropelam)
  const mudar = (m: Partial<PedidoDeAdmissao & PedidoDeFerias & PedidoDeDemissao>) => setD(antes => { const novo = { ...antes, ...m } as DadosDoPedido; aoMudar(novo); return novo; });
  const a = d as PedidoDeAdmissao, f = d as PedidoDeFerias, x = d as PedidoDeDemissao;
  const funcionario = (valor: string) => (
    <div className="field cli-largo">
      <label>Funcionário</label>
      <CampoEscolha rotulo="Funcionário" valor={valor} opcoes={nomes} onMudar={v => mudar({ empregado: v })} />
    </div>
  );
  const escolhida = pedido === 'ferias' ? equipe.find(p => p.nome === f.empregado) : undefined;
  const sugestao = primeiraDataDasFerias(hoje);
  const contaF = pedido === 'ferias' ? contaDasFerias(f, hoje, escolhida?.limite) : null;
  const contaA = pedido === 'admissao' ? contaDaAdmissao(a, hoje) : null;
  return (
    <div className={'cli-app cli-janela cli-pedido' + (pedido === 'ferias' ? ' cli-pf' : pedido === 'admissao' ? ' cli-pa' : '')}>
      {pedido === 'admissao' && (
        <>
          <TopoDaAdmissao nome={a.nome} foto={a.foto} aoMudar={foto => mudar({ foto })} />
          <p className="cli-pf-rotulo cli-largo">A pessoa</p>
          <div className="field"><label htmlFor="cli-nome">Nome completo</label><input id="cli-nome" type="text" value={a.nome} onChange={e => mudar({ nome: e.target.value })} placeholder="Como está no documento" /></div>
          <div className="field"><label htmlFor="cli-cpf">CPF</label><input id="cli-cpf" type="text" inputMode="numeric" value={a.cpf} onChange={e => mudar({ cpf: e.target.value })} placeholder="000.000.000-00" /></div>
          <p className="cli-pf-rotulo cli-largo">O trabalho</p>
          <div className="field"><label htmlFor="cli-cargo">Cargo</label><input id="cli-cargo" type="text" value={a.cargo} onChange={e => mudar({ cargo: e.target.value })} placeholder="Ex.: Auxiliar administrativo" /></div>
          <div className="field"><label htmlFor="cli-sal">Salário</label><input id="cli-sal" type="text" inputMode="decimal" value={a.salario} onChange={e => mudar({ salario: e.target.value })} placeholder="R$ 2.000,00" /></div>
          <div className="field"><label htmlFor="cli-inicio">Primeiro dia</label><CampoData id="cli-inicio" rotulo="Primeiro dia" valor={a.inicio} onMudar={v => mudar({ inicio: v })} /></div>
          <div className="field">
            <label>Contrato</label>
            <CampoEscolha rotulo="Contrato" valor={a.contrato} opcoes={CONTRATOS} onMudar={v => mudar({ contrato: v })} />
          </div>
          {contaA ? (
            <ul className="cli-pf-resumo cli-largo">
              <PassoDoResumo icone="clock" rotulo="Registro no eSocial até" valor={contaA.registrarAte} detalhe="um dia antes do primeiro dia" />
              {contaA.experiencia && <PassoDoResumo icone="calendar" rotulo="Contrato de experiência" valor={contaA.experiencia} />}
            </ul>
          ) : <p className="cli-pf-vazio cli-largo"><Icone nome="ajuda" width={15} height={15} />O eSocial pede o registro até um dia antes do primeiro dia de trabalho.</p>}
          {contaA?.aviso && <p className="cli-pf-aviso cli-largo"><Icone nome="alert" width={15} height={15} />{contaA.aviso}</p>}
          <div className="field cli-largo"><label htmlFor="cli-obs">Horário, vale-transporte e outros detalhes <span className="cli-pf-opc">opcional</span></label><textarea id="cli-obs" rows={2} value={a.observacoes} onChange={e => mudar({ observacoes: e.target.value })} placeholder="Ex.: seg a sex, 8h às 17h; usa 2 conduções por dia" /></div>
        </>
      )}
      {pedido === 'ferias' && (
        <>
          {/* (13/11/2026: "não quero scroll para baixo") tudo numa tela só: as pessoas em fichas numa linha, o calendário à
              esquerda e, à direita, os dias, a conta, os avisos e o 13º; a data se escolhe só no calendário */}
          <div className="cli-largo cli-pf-quem">
            {equipe.length ? (
              <div className="cli-pf-fichas" role="radiogroup" aria-label="Quem vai sair de férias">
                {equipe.map(p => (
                  <button key={p.nome} type="button" role="radio" aria-checked={f.empregado === p.nome} title={p.nome + (p.rotulo ? ' · ' + p.rotulo : '')}
                    className={'cli-pf-ficha' + (f.empregado === p.nome ? ' sel' : '')} onClick={() => mudar({ empregado: p.nome })}>
                    <Avatar nome={p.nome} tamanho={24} />
                    <span>{nomeCurto(p.nome)}</span>
                    {p.rotulo && <i className={'cli-pf-ficha-ponto t-' + p.tom} aria-label={p.rotulo} />}
                  </button>
                ))}
              </div>
            ) : <p className="hint">Nenhum funcionário ativo no registro.</p>}
            <p className="cli-pf-sobre">
              {escolhida
                ? <>{escolhida.rotulo && <span className={'cli-eq-ferias t-' + escolhida.tom}>{escolhida.rotulo}</span>}<span>{escolhida.texto || escolhida.nome}</span></>
                : <span>Escolha quem vai sair de férias.</span>}
            </p>
          </div>
          <div className="cli-pf-quando cli-largo">
            <CalendarioDasFerias pedido={f} hoje={hoje} aoMarcar={m => mudar(m)} />
            <div className="cli-pf-lado">
              {/* sem rótulo em cima (13/11/2026: "fica desalinhado"): os botões começam na altura do calendário */}
              <div className="field">
                <div className="cli-pf-dias" role="radiogroup" aria-label="Quantos dias de férias (ou marque o último dia no calendário)">
                  {DIAS.map(o => (
                    <button key={o} type="button" role="radio" aria-checked={f.dias === o} className={'cli-pf-dia' + (f.dias === o ? ' sel' : '')} onClick={() => mudar({ dias: o })}>
                      <b>{ROTULO_DOS_DIAS[o].n}</b><span>{ROTULO_DOS_DIAS[o].t}</span>
                    </button>
                  ))}
                </div>
              </div>
              {contaF ? (
                <ul className="cli-pf-resumo">
                  <PassoDoResumo icone="dinheiro" rotulo="Pagamento até" valor={contaF.pagarAte} />
                  <PassoDoResumo icone="calendar" rotulo={'De férias · ' + contaF.dias + ' dias' + (contaF.vende ? ' (vende ' + contaF.vende + ')' : '')} valor={contaF.de + ' a ' + contaF.ate} />
                  <PassoDoResumo icone="checkCircle" rotulo="Volta ao trabalho" valor={contaF.volta} />
                </ul>
              ) : (
                <div className="cli-pf-vazio">
                  <span>Marque no calendário o primeiro e o último dia, como numa reserva de hotel.</span>
                  <button type="button" className="cli-pf-sugestao" onClick={() => mudar({ inicio: sugestao })}>
                    <Icone nome="lampada" width={14} height={14} /><span>Sugestão: <b>{sugestao.slice(0, 5)}</b>, a primeira segunda com 30 dias de aviso</span>
                  </button>
                </div>
              )}
              {!!contaF?.avisos.length && (
                <div className="cli-pf-aviso" role="note">
                  <Icone nome="alert" width={14} height={14} />
                  {contaF.avisos.length === 1 ? <span>{contaF.avisos[0]}</span> : <ul>{contaF.avisos.map(t => <li key={t}>{t}</li>)}</ul>}
                </div>
              )}
              <label className="cli-pf-chave">
                <input type="checkbox" role="switch" checked={f.adiantar13} onChange={e => mudar({ adiantar13: e.target.checked })} />
                <span className="cli-pf-chave-trilho" aria-hidden="true" />
                <span className="cli-pf-chave-txt"><b>Adiantar metade do 13º</b><span className="hint">Paga junto com as férias</span></span>
              </label>
            </div>
          </div>
        </>
      )}
      {pedido === 'demissao' && (
        <>
          {funcionario(x.empregado)}
          <div className="field"><label htmlFor="cli-ud">Último dia de trabalho</label><CampoData id="cli-ud" rotulo="Último dia de trabalho" valor={x.ultimoDia} onMudar={v => mudar({ ultimoDia: v })} /></div>
          <div className="field cli-pedido-motivo">
            <label>Motivo</label>
            <CampoEscolha rotulo="Motivo" valor={x.motivo} opcoes={MOTIVOS} onMudar={v => mudar({ motivo: v })} />
          </div>
          <div className="field">
            <label>Aviso prévio</label>
            <CampoEscolha rotulo="Aviso prévio" valor={x.aviso} opcoes={AVISOS} onMudar={v => mudar({ aviso: v })} />
          </div>
        </>
      )}
      {erro && <p className="cli-erro cli-largo" role="alert">{erro}</p>}
    </div>
  );
}

type VM = ReturnType<typeof useDp>;
type Doc = VM['funcionarios'][number]['docs'][number];

/** Uma linha de documento: o ícone pelo tipo, o nome, de quem e o mês, e o Ver e o Baixar (o grande demais, pedir ao escritório). */
function LinhaDoDocumento({ d, vm }: { d: Doc; vm: VM }) {
  return (
    <li className="cli-reg-doc">
      <IconeDoArquivo formato={d.formato} tamanho={30} />
      {/* clicar no nome abre a visualização (13/11/2026: o mesmo padrão da Central) */}
      {d.podeBaixar ? (
        <button type="button" className="cli-reg-doc-txt cli-biblioteca-abrir" disabled={vm.vista.abrindo === d.id} onClick={() => vm.verDoc(d.id)} title={'Ver ' + d.nome}>
          <b>{d.nome}</b>
          <span className="hint">{[d.dono, d.detalhe].filter(Boolean).join(' · ')}</span>
        </button>
      ) : (
        <span className="cli-reg-doc-txt">
          <b>{d.nome}</b>
          <span className="hint">{[d.dono, d.detalhe].filter(Boolean).join(' · ')}</span>
        </span>
      )}
      {d.podeBaixar ? (
        <span className="cli-reg-doc-acoes">
          <button type="button" className="icon-btn" title="Ver" aria-label={'Ver ' + d.nome} disabled={vm.vista.abrindo === d.id} onClick={() => vm.verDoc(d.id)}><Icone nome="olho" width={16} height={16} /></button>
          <button type="button" className="icon-btn" title="Baixar" aria-label={'Baixar ' + d.nome} disabled={vm.baixando === d.id} onClick={() => vm.baixar(d.id)}><Icone nome="download" width={16} height={16} /></button>
        </span>
      ) : <span className="hint">Grande demais: peça ao escritório</span>}
    </li>
  );
}

/** Uma linha dos documentos da folha (16/11/2026: "muita informação"): o ícone, o nome (abre a visualização) e de quem é,
 *  sem o mês e o tamanho (o mês já está no alto do cartão); a ação principal é o Baixar, o Ver vai no "⋯". A ficha
 *  continua com a LinhaDoDocumento (a janela foi aprovada). */
function LinhaDaFolha({ d, vm }: { d: Doc & { quem: string }; vm: VM }) {
  return (
    <li className="cli-reg-doc cli-rg-doc">
      <IconeDoArquivo formato={d.formato} tamanho={30} />
      {d.podeBaixar ? (
        <button type="button" className="cli-reg-doc-txt cli-biblioteca-abrir" disabled={vm.vista.abrindo === d.id} onClick={() => vm.verDoc(d.id)} title={'Ver ' + d.nome}>
          <b>{d.nome}</b>
          {d.quem && <span className="hint">{d.quem}</span>}
        </button>
      ) : (
        <span className="cli-reg-doc-txt">
          <b>{d.nome}</b>
          <span className="hint">Grande demais: peça ao escritório</span>
        </span>
      )}
      {d.podeBaixar && (
        <span className="cli-rg-doc-acoes">
          <button type="button" className="btn btn-ghost btn-sm cli-rg-baixar" aria-label={'Baixar ' + d.nome} disabled={vm.baixando === d.id} onClick={() => vm.baixar(d.id)}><Icone nome="download" width={14} height={14} /><span className="cli-rg-baixar-txt">Baixar</span></button>
          <MenuSuspenso rotulo="" icone="mais" semSeta direita flutuante compacto className="icon-btn cli-rg-mais" titulo={'Mais ações: ' + d.nome} dica="Mais ações"
            itens={[{ rotulo: 'Ver', icone: 'olho', onClick: () => vm.verDoc(d.id) }]} />
        </span>
      )}
    </li>
  );
}

export function DepartamentoPessoal(props: DaCasca) {
  const vm = useDp(props);
  const { modal } = useRetorno();

  /** abre a janela do pedido; se faltar algo, abre de novo com o que já foi preenchido e o aviso */
  /** a ficha numa janela flutuante: a situação e a matrícula, os dados em blocos, os documentos dela (ver e baixar) e as ações */
  const ficha = async (f: VM['funcionarios'][number]) => {
    const escolha = await modal<'ferias' | 'demissao' | null>({
      titulo: f.nome,
      corpo: (
        <div className="cli-app cli-janela cli-ficha">
          {/* a ficha refeita (13/11/2026: "preciso de uma melhora com relação à tela do funcionário"): a pessoa no alto, os
              números numa faixa, os documentos dela e as ações embaixo, à direita */}
          <header className="cli-ficha-cabeca">
            <Avatar nome={f.nome} tamanho={56} />
            <div className="cli-ficha-quem">
              <b className="cli-ficha-nome">{f.nome}</b>
              <span className="cli-ficha-linha">
                <span className={'badge ' + (f.ativo ? 'badge-ok' : 'badge-neutral')}>{f.situacao}</span>
                {f.cargo && <span>{f.cargo}</span>}
                {f.matricula && <span>Matrícula {f.matricula}</span>}
                {f.tempo && <span>{f.tempo} na empresa</span>}
              </span>
            </div>
          </header>
          {f.afastado && <p className="cli-ficha-afastado"><Icone nome="clock" width={14} height={14} />{f.afastado}</p>}
          <dl className={'cli-ficha-faixa' + (f.liquido ? ' quatro' : '')}>
            {f.salarioBase
              ? <div><dt>Salário</dt><dd className="cli-ficha-dinheiro">{f.salarioBase}</dd></div>
              : <div><dt>Remuneração{vm.competencia && f.ativo ? ' · ' + vm.competencia : ''}</dt><dd className="cli-ficha-dinheiro">{f.remuneracao}</dd></div>}
            {f.liquido && <div><dt>Último líquido</dt><dd className="cli-ficha-dinheiro">{f.liquido}</dd></div>}
            <div><dt>{f.admissao ? 'Admissão' : 'No registro desde'}</dt><dd>{f.admissao || f.desde || '—'}</dd></div>
            <div><dt>CPF</dt><dd>{f.cpf || '—'}</dd></div>
          </dl>
          <div className="cli-ficha-docs">
            <p className="cli-ficha-sub">Documentos{f.docs.length ? ' · ' + f.docs.length : ''}</p>
            {f.docs.length
              ? <ul className="cli-reg-docs">{f.docs.map(d => <LinhaDoDocumento key={d.id} d={d} vm={vm} />)}</ul>
              : <p className="hint cli-ficha-sem">Nenhum documento dele ainda. Os recibos, as férias e o ponto aparecem aqui quando o escritório salva.</p>}
          </div>
          <p className="hint cli-ficha-dica"><Icone nome="ajuda" width={14} height={14} />Para mudar um dado ou mandar um atestado, abra uma solicitação.</p>
        </div>
      ),
      botoes: f.ativo
        ? [{ rotulo: 'Voltar', valor: null, variante: 'btn-outline' }, { rotulo: 'Pedir desligamento', valor: 'demissao', variante: 'btn-danger', classe: 'cli-perigo' }, { rotulo: 'Programar férias', valor: 'ferias', variante: 'btn-primary' }]
        : [{ rotulo: 'Voltar', valor: null, variante: 'btn-outline' }],
    });
    if (escolha === 'ferias') await abrirPedido('ferias', vm.novasFerias(f.nome));
    if (escolha === 'demissao') await abrirPedido('demissao', vm.novaDemissao(f.nome));
  };

  const abrirPedido = async (pedido: Pedido, dados: DadosDoPedido, erro = ''): Promise<void> => {
    let atual = dados;
    const enviar = await modal<boolean>({
      titulo: TITULO[pedido],
      corpo: <FormDoPedido pedido={pedido} inicial={dados} erro={erro} nomes={vm.nomes} equipe={vm.equipeDasFerias} hoje={vm.hoje} aoMudar={d => { atual = d; }} />,
      botoes: [{ rotulo: pedido === 'admissao' ? 'Enviar ao departamento pessoal' : 'Enviar ao escritório', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!enviar) return;
    const problema = await vm.pedir(pedido, atual);
    if (problema) await abrirPedido(pedido, atual, problema);
  };

  return (
    <>
      <div className="cli-titulo">
        <div>
          <MarcaDaTela /><h1 className="page-title">RH</h1><AjudaDaTela />
          {/* dois fatos numa linha (16/11/2026: "muita informação"; no lugar dos três cartões de número): os ativos e as
              férias, que levam à aba Férias */}
          <p className="cli-subtitulo cli-rg-resumo">
            {vm.resumo.map((t, i) => t.aba ? (
              <button key={i} type="button" className={'cli-rg-trecho cli-rg-trecho-link' + (t.tom ? ' t-' + t.tom : '')} onClick={() => vm.escolherAba('ferias')}><b>{t.valor}</b> {t.depois}</button>
            ) : (
              <span key={i} className="cli-rg-trecho"><b>{t.valor}</b> {t.depois}</span>
            ))}
          </p>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={() => void abrirPedido('admissao', vm.novaAdmissao())}><Icone nome="plus" width={16} height={16} />Solicitar admissão</button>
          <button type="button" className="btn" onClick={() => void abrirPedido('ferias', vm.novasFerias())}><Icone nome="calendar" width={16} height={16} />Programar férias</button>
        </div>
      </div>

      {/* as abas (13/11/2026: "quero trabalhar no DP"): a equipe, as férias, a folha e o calendário, uma parte por vez */}
      <nav className="cli-fat-abas cli-rg-abas" role="tablist" aria-label="Partes do RH">
        {vm.abas.map(x => (
          <button key={x.id} type="button" role="tab" data-aba={x.id} aria-selected={vm.aba === x.id} className={'cli-fat-aba' + (vm.aba === x.id ? ' ativa' : '')} onClick={() => vm.escolherAba(x.id)}>
            <Icone nome={x.icone} width={17} height={17} />{x.rotulo}{x.conta > 0 && <span className="cli-aba-conta">{x.conta}</span>}
          </button>
        ))}
      </nav>

      {/* a equipe na largura toda; a ficha abre numa janela flutuante (12/11/2026: "prefiro janela flutuante do que essa
          lateral") */}
      {vm.aba === 'equipe' && <section className="card cli-reg-equipe">
        {vm.temFuncionarios ? (
          <>
            <div className="cli-reg-equipe-topo">
              <div className="cli-sol-filtros" role="tablist" aria-label="Equipe">
                <button type="button" role="tab" aria-selected={!vm.mostrarSaidas} className={'cli-sol-filtro' + (!vm.mostrarSaidas ? ' ativo' : '')} onClick={vm.verAtivos}>Ativos<b>{vm.ativosN}</b></button>
                <button type="button" role="tab" aria-selected={vm.mostrarSaidas} className={'cli-sol-filtro' + (vm.mostrarSaidas ? ' ativo' : '')} onClick={vm.verSaidas}>Saíram<b>{vm.saidas}</b></button>
              </div>
              <label className="cli-busca cli-reg-busca">
                <Icone nome="search" width={16} height={16} />
                <input type="text" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Nome, CPF ou matrícula" aria-label="Buscar funcionário" />
              </label>
            </div>
            {vm.funcionarios.length ? (
              <ul className="cli-eq-grade">
                {vm.funcionarios.map(f => (
                  <li key={f.id}>
                    {/* (16/11/2026: "muita informação") o nome, uma frase, o salário e um selo só quando pede atenção; o resto
                        (a matrícula, os documentos, as férias em dia) está na ficha e na aba Férias */}
                    <button type="button" className={'cli-eq-cartao cli-rg-cartao' + (f.ativo ? '' : ' saiu')} onClick={() => void ficha(f)}>
                      <Avatar nome={f.nome} tamanho={40} />
                      <span className="cli-rg-quem"><b>{f.nome}</b>{f.linha && <span className="hint">{f.linha}</span>}</span>
                      <span className="cli-rg-lado">
                        <b className="cli-valor">{f.salarioBase || f.remuneracao}</b>
                        {f.selo && <span className={'cli-eq-ferias t-' + f.selo.tom} title={f.afastado || undefined}>{f.selo.rotulo}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : vm.busca ? <p className="hint cli-sol-vazio">Ninguém com esse nome. <button type="button" className="cli-link-mini" onClick={() => vm.mudarBusca('')}>Limpar a busca</button></p>
              : <p className="hint cli-sol-vazio">{vm.mostrarSaidas ? 'Ninguém saiu do registro.' : 'Nenhum funcionário ativo.'}</p>}
          </>
        ) : <Vazio icone="equipe" titulo="Nenhum funcionário no registro" texto="Os funcionários aparecem aqui quando o escritório emite a guia do FGTS do mês." />}
      </section>}

      {/* as férias de cada um (13/11/2026: os avisos de férias): a vencida primeiro, com o Programar férias */}
      {vm.aba === 'ferias' && (
        <section className="card cli-fe">
          <div className="card-head"><h3>Férias da equipe</h3></div>
          {vm.ferias.length ? (
            <ul className="cli-fe-lista">
              {vm.ferias.map(x => (
                <li key={x.id} className={'cli-fe-linha t-' + x.tom}>
                  <Avatar nome={x.nome} tamanho={36} />
                  <span className="cli-fe-txt"><b>{x.nome}</b><span className="hint" title={x.texto}>{x.frase}</span></span>
                  <span className={'cli-eq-ferias t-' + x.tom}>{x.rotulo}</span>
                  {x.podeProgramar ? <button type="button" className="btn btn-sm" onClick={() => void abrirPedido('ferias', vm.novasFerias(x.nome))}><Icone nome="calendar" width={14} height={14} />Programar</button> : <span className="cli-fe-vaga" />}
                </li>
              ))}
            </ul>
          ) : <Vazio icone="calendar" titulo="Nenhum funcionário ativo" texto="As férias aparecem aqui pelo tempo de cada um no registro." />}
          {/* a nota numa frase (16/11/2026: "muita informação") */}
          <p className="hint cli-fe-nota">{vm.notaDasFerias}</p>
        </section>
      )}

      {/* o custo da folha mês a mês (13/11/2026); enxuto (16/11/2026: "muita informação"): o total e três números à vista,
          o resto dos holerites recolhido no "Ver detalhes" */}
      {vm.aba === 'folha' && vm.custoDoMes && (
        <section className="card cli-cf cli-rg-cf">
          <div className="card-head"><h3>Custo da folha</h3></div>
          <div className="cli-cf-corpo">
            <div className="cli-cf-numeros">
              <div><span className="cli-sobre">{vm.custoDoMes.mes}</span><b className="cli-valor cli-cf-total">{vm.custoDoMes.total}</b>
                {vm.custoDoMes.variacao != null && <span className="hint"><span className={'cli-variacao ' + (vm.custoDoMes.variacao >= 0 ? 'desce' : 'sobe')}>{(vm.custoDoMes.variacao > 0 ? '+' : '') + String(vm.custoDoMes.variacao).replace('.', ',')}%</span> sobre o mês anterior</span>}</div>
              <div className="cli-cf-partes">
                <span>Salários<b className="cli-valor">{vm.custoDoMes.salarios}</b></span>
                <span>FGTS<b className="cli-valor">{vm.custoDoMes.fgts}</b></span>
                {vm.custoDoMes.holerite
                  ? <span>Líquido pago<b className="cli-valor">{vm.custoDoMes.holerite.liquido}</b></span>
                  : <span>Por funcionário<b className="cli-valor">{vm.custoDoMes.porFuncionario}</b></span>}
              </div>
              {vm.custoDoMes.holerite && (
                <details className="cli-rg-detalhes">
                  <summary><Icone nome="chevronRight" width={14} height={14} />Ver detalhes</summary>
                  <div className="cli-cf-partes cli-rg-detalhes-corpo">
                    <span>Por funcionário<b className="cli-valor">{vm.custoDoMes.porFuncionario}</b></span>
                    <span>INSS descontado<b className="cli-valor">{vm.custoDoMes.holerite.inss}</b></span>
                    <span>IRRF descontado<b className="cli-valor">{vm.custoDoMes.holerite.irrf}</b></span>
                    <span>Todos os descontos<b className="cli-valor">{vm.custoDoMes.holerite.descontos}</b></span>
                  </div>
                </details>
              )}
            </div>
            <div className="cli-cf-grafico">
              <Colunas colunas={vm.folhaColunas} eixo={vm.folhaEixo} rotulo="O custo da folha mês a mês. Passe o mouse ou toque num mês para ver o custo dele" onFoco={vm.focarFolha} compacto />
            </div>
          </div>
        </section>
      )}

      {/* o calendário do DP do mês (13/11/2026) */}
      {vm.aba === 'calendario' && (
        <section className="card cli-cd">
          <div className="card-head">
            <h3>Datas do DP</h3>
            <span className="card-head-ctl cli-cd-mes">
              <button type="button" className="icon-btn icon-btn-sm" onClick={vm.calendario.anterior} aria-label="Mês anterior"><Icone nome="chevronLeft" width={15} height={15} /></button>
              <b>{vm.calendario.titulo}</b>
              <button type="button" className="icon-btn icon-btn-sm" onClick={vm.calendario.proximo} aria-label="Próximo mês"><Icone nome="chevronRight" width={15} height={15} /></button>
            </span>
          </div>
          {vm.calendario.datas.length ? (
            <ul className="cli-cd-lista">
              {vm.calendario.datas.map(d => (
                <li key={d.chave} className={'cli-cd-linha t-' + d.tipo + (d.passou ? ' passou' : '')}>
                  <span className="cli-cd-dia"><b>{d.dia || '•'}</b><span>{d.semana}</span></span>
                  <span className="cli-cd-txt"><b>{d.titulo}</b><span className="hint">{d.detalhe}</span></span>
                </li>
              ))}
            </ul>
          ) : <Vazio icone="calendar" titulo="Nada neste mês" texto="Sem funcionário ativo, o DP não tem datas." />}
          <p className="hint cli-fe-nota">Os dias úteis sem os feriados: quando cai num feriado, o escritório avisa.</p>
        </section>
      )}

      {/* a folha do mês: os documentos do DP por categoria (a folha, os recibos, as férias…), no estilo extrato */}
      {vm.aba === 'folha' && <section className="card cli-reg-folha">
        <div className="card-head">
          <h3>Folha {vm.meses.length ? 'de ' + (vm.meses.find(m => m.valor === vm.mes)?.rotulo.toLowerCase() ?? '') : 'do mês'}</h3>
          {(vm.meses.length > 1 || vm.docsDoMesN > 1) && (
            <span className="card-head-ctl cli-reg-folha-ctl">
              {/* a folha do mês inteira num .zip (13/11/2026: o mesmo padrão da Central) */}
              {vm.docsDoMesN > 1 && <button type="button" className="cli-baixar-tudo" disabled={!!vm.juntando} onClick={vm.baixarFolha} title="Baixar todos os documentos do mês num .zip"><Icone nome="download" width={15} height={15} />{vm.juntando || <>Baixar a folha<span className="cli-baixar-n">{vm.docsDoMesN}</span></>}</button>}
              <span className="chip-row" role="radiogroup" aria-label="Mês dos documentos" style={{ margin: 0 }}>
                {vm.meses.length > 1 && vm.meses.map(m => (
                  <button key={m.valor} type="button" role="radio" aria-checked={vm.mes === m.valor} className={'chip-f' + (vm.mes === m.valor ? ' on' : '')} onClick={() => vm.mudarMes(m.valor)}>{m.rotulo}</button>
                ))}
              </span>
            </span>
          )}
        </div>
        {vm.grupos.length ? vm.grupos.map(g => (
          <div key={g.categoria} className="cli-reg-grupo">
            <p className="cli-biblioteca-mes-titulo">{g.rotulo.toUpperCase()}</p>
            <ul className="cli-reg-docs">{g.docs.map(d => <LinhaDaFolha key={d.id} d={d} vm={vm} />)}</ul>
          </div>
        )) : <Vazio icone="pastaAberta" titulo="Nenhum documento ainda" texto="A folha, os recibos e as guias do mês aparecem aqui quando o escritório salva na pasta da empresa." />}
      </section>}
      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar}
        onAnterior={vm.setas.anterior} onProximo={vm.setas.proximo} posicao={vm.setas.posicao} abrindo={!!vm.vista.abrindo} />}
    </>
  );
}
