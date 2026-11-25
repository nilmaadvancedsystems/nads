// ViewModel do Fiscal › Relatório › Enviar guias (03/11/2026: "A parte de gmail tem que funcionar assim como o envios do dp,
// ele sobe o arquivo e envia direto via gmail para o cliente, ao enviar o arquivo ele lê e ja coloca os valores na tabela"),
// no desenho do lote do DP (dp/useLoteDoDp.ts): subir as guias, acompanhar a leitura do robô, revisar (as guias por cliente
// e competência, com a coluna do Relatório e o valor lido; a que o leitor não reconheceu, a pessoa escolhe o cliente, a
// coluna e a competência, ou tira do lote) e disparar. Depois do disparo é o robô que preenche o Relatório (só o que está em
// branco: o valor de cada coluna, a data e o Entregue por e-mail); a tela só mostra o que ele fez.
// A via de cada cliente (04/11/2026: "preciso que quando eu va em enviar guias tenha a opção de impresso ou gmail, impresso
// cria na rotina do entregas a entrega"): Gmail ou Impresso. Sem escolha, vale a do Relatório do mês anterior (Entregue =
// Impresso lá, impresso aqui) e, sem e-mail no cadastro, impresso; a escolha vai para o lote (vias) e o robô segue.
// O WhatsApp (12/11/2026, ticket 1ORUBY: "Inserir tipo de envio 'Whastapp'"): "Abrir no WhatsApp" abre o wa.me do cliente (o do
// Cadastro do nads, senão o do Entregas) com o texto do Modelo do e-mail e baixa as guias para anexar; no disparo, o robô faz
// como no SCI Report (o Drive e o Relatório com Entregue = WhatsApp, com a data).
import { financeiro, formatos, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useContatosDoEntregas, useControleTributos, useDriveDoEntregas, useGmailDoEntregas, useLoteFiscal, useRepo, useTodosOsCadastros } from '../../../dados/repo';
import { colunaQueVale, MODELO_PADRAO_DAS_GUIAS, valorDaGuia, valoresDaGuia, type EscolhaDaGuia, type GuiaDoLote, type GuiaNaPasta, type ViaDaGuia } from '../../../dados/loteFiscal';
import { CURTO, type RegimeDoRelatorio } from './useRelatorioGeral';
import { useSepararPorCliente } from '../../ferramentas/useSepararPorCliente';
import { useGuardado } from '../../../../../comum/guardado';

const MAX_ARQUIVOS = 150;
const MAX_BYTES = 25 * 1024 * 1024;
// o robô costuma responder o pedido de abrir em segundos; passado isso, desiste
const PRAZO_DO_DRIVE_MS = 90 * 1000;

/**
 * Abre a guia numa aba nova (04/11/2026: "quando eu clicar no nome do enviado ou para enviar quero poder ver a guia, essa
 * guia tem que ser armazenada de maneira a não pesar o DB"). A aba abre já no clique (senão o navegador a bloqueia) e
 * recebe o endereço quando ele chega; se não chegar, fecha.
 */
function abrirNaAba(nome: string, endereco: () => Promise<string>, falhou: (motivo: string) => void) {
  const aba = window.open('', '_blank');
  if (aba) { try { aba.document.title = nome; aba.document.body.textContent = 'Abrindo "' + nome + '"…'; } catch { /* outra origem */ } }
  endereco().then(url => {
    if (aba && !aba.closed) aba.location.href = url; else window.open(url, '_blank');
  }, (e: unknown) => {
    try { aba?.close(); } catch { /* já fechou */ }
    falhou(e instanceof Error ? e.message : String(e));
  });
}

/** o que vale da guia: a escolha da revisão sobre a leitura do robô (cliente 0 = ainda não escolhido) */
export function efetivoDaGuia(a: GuiaDoLote, grupo: RegimeDoRelatorio) {
  const l = a.leitura;
  const e = a.escolha;
  return {
    codigo: e && e.cliente > 0 ? e.cliente : l?.cliente ?? null,
    competencia: (e && e.competencia) || l?.competencia || '',
    tipo: (e && e.tipo) || l?.tipo || '',
    coluna: colunaQueVale(a, grupo),
    escolhido: !!e && (e.cliente !== (l?.cliente ?? 0) || e.competencia !== (l?.competencia || '')),
  };
}

export function useEnvioDeGuias(grupo: RegimeDoRelatorio, competenciaDaTela: string) {
  const repo = useLoteFiscal();
  const tarefas = useRepo();
  const cadastros = useTodosOsCadastros();
  const gmail = useGmailDoEntregas();
  const drive = useDriveDoEntregas();
  const controle = useControleTributos();
  const contatosDoEntregas = useContatosDoEntregas();

  /** espera o mapa do Drive responder (ele carrega quando pedido), até o prazo */
  function esperarDrive<T>(ler: () => T | null): Promise<T> {
    return new Promise((resolver, recusar) => {
      const agora = ler();
      if (agora != null) { resolver(agora); return; }
      const prazo = setTimeout(() => { parar(); recusar(new Error('o mapa do Drive não carregou')); }, 30 * 1000);
      const parar = drive.assinar(() => {
        const x = ler();
        if (x != null) { clearTimeout(prazo); parar(); resolver(x); }
      });
    });
  }
  /** o id da guia pelo nome, na pasta do cliente no mapa do Drive (a mais nova, se houver duas com o mesmo nome) */
  async function idPeloMapa(codigo: number, nome: string): Promise<string> {
    const pasta = await esperarDrive(() => {
      const m = drive.mapa();
      return m.carregado ? m.clientes.find(c => c.codigo === String(codigo)) || false : null;
    });
    if (!pasta) throw new Error('a pasta do cliente ' + codigo + ' não está no mapa do Drive');
    const itens = await esperarDrive(() => { const x = drive.itens(pasta.id); return x.carregados ? x.itens : null; });
    const achado = itens.filter(x => x.t === 'f' && x.n === nome).sort((a, b) => String(b.m || '').localeCompare(String(a.m || '')))[0];
    if (!achado) throw new Error('não achei "' + nome + '" na pasta do cliente no Drive');
    return achado.i;
  }
  const { toast, modal } = useRetorno();
  const separarPorCliente = useSepararPorCliente();
  const doGrupo = t.grupoDoControle(grupo);
  const todos = repo.lotes();
  const lotes = todos.lista.filter(l => l.grupo === grupo);
  // "Para enviar" (04/11/2026: "Precisa ter uma aba de enviados e uma aba de 'para enviar' para nao misturar"): os lotes que
  // ainda têm o que mandar. O disparado em que todos os clientes receberam sai daqui e fica só em "Enviados".
  const terminado = (l: (typeof lotes)[number]) => l.status === 'disparado' && l.resultados.length > 0 && l.resultados.every(r => r.status === 'enviado');
  const paraEnviar = lotes.filter(l => !terminado(l));
  const [escolhido, setEscolhido] = useState<string | null>(null);
  // as guias já arquivadas na pasta do Drive no mês (plano do Acessórias, 17/11/2026, ficha E15; frase do dono: "Seguir"): só as do grupo da tela (Simples, ou
  // Presumido e Real), todas marcadas; a pessoa desmarca o que não vai e cria o lote, que segue o fluxo de sempre
  const [naPasta, setNaPasta] = useState<{ comp: string; carregadas: boolean; erro: string; guias: GuiaNaPasta[] }>({ comp: '', carregadas: false, erro: '', guias: [] });
  const [desmarcadas, setDesmarcadas] = useState<string[]>([]);
  const [criandoDaPasta, setCriandoDaPasta] = useState(false);
  useEffect(() => repo.guiasNaPasta(competenciaDaTela, r => setNaPasta({ comp: competenciaDaTela, ...r })), [repo, competenciaDaTela]);
  const doGrupoNaPasta = (naPasta.comp === competenciaDaTela ? naPasta.guias : []).filter(g => /SIMPLES NACIONAL/i.test(g.pasta) === (grupo === 'sn'));
  const atual = (escolhido ? paraEnviar.find(l => l.id === escolhido) : null) || paraEnviar[0] || null;
  const idAtual = atual?.id || '';
  const [arquivos, setArquivos] = useState<{ lote: string; lista: GuiaDoLote[] } | null>(null);
  useEffect(() => {
    if (!idAtual) return;
    return repo.arquivos(idAtual, lista => setArquivos({ lote: idAtual, lista }));
  }, [idAtual, repo]);
  const lista = arquivos && arquivos.lote === idAtual ? arquivos.lista : [];
  // o Excluir do que está fora do lote (24/11/2026: "nao tem como excluir coisas fora do lote"; o dono escolheu "só esconder"):
  // a guia tirada ou com erro some da lista neste navegador; ela já não vai no disparo e o robô apaga o lote inteiro em 3 dias
  const [escondidas, setEscondidas] = useGuardado<string[]>(idAtual ? 'fiscal-lote-escondidas|' + idAtual : null, []);
  // mais guias no mesmo lote (05/11/2026): só no lido, antes do disparo (depois, o robô pularia o cliente já enviado)
  const podeAdicionar = !!atual && atual.status === 'lido';
  const [subindo, setSubindo] = useState<{ feitos: number; total: number } | null>(null);
  // as guias escolhidas esperam o botão Subir (24/11/2026: "quero um botao para subir ao inves de subir automatico"): dá para
  // conferir a lista, tirar a que veio errada e escolher mais antes de mandar ao robô
  const [aSubir, setASubir] = useState<File[]>([]);
  const [disparando, setDisparando] = useState(false);

  // os clientes para escolher e para mostrar: o nome da lista do escritório, o e-mail e o WhatsApp (os do Cadastro do nads, senão os do Entregas)
  const emailsDoEntregas = new Map(gmail.clientes().lista.map(c => [c.codigo, [c.email, ...c.emails].filter(Boolean)]));
  const clientes = tarefas.listarEmpresas().filter(e => e.codigo != null).map(e => ({
    codigo: e.codigo as number, nome: e.nome,
    email: (cadastros.porId.get(formatos.slug(e.nome))?.contato?.email || '').trim().toLowerCase() || (emailsDoEntregas.get(String(e.codigo)) || [])[0] || (repo.exemplos ? 'financeiro@exemplo.com.br' : ''),
    whatsapp: financeiro.telefoneParaWhatsapp(cadastros.porId.get(formatos.slug(e.nome))?.contato?.whatsapp || contatosDoEntregas.get(e.codigo as number)?.whatsapp || (repo.exemplos ? '11999990000' : '')),
  })).sort((a, b) => a.codigo - b.codigo);
  const doCodigo = new Map(clientes.map(c => [c.codigo, c]));

  // a revisão: as lidas por cliente e competência; as que faltam escolher; as tiradas; as que deram erro
  const porChave = new Map<string, { codigo: number; competencia: string; arquivos: GuiaDoLote[] }>();
  const faltam: GuiaDoLote[] = [];
  const tirados: GuiaDoLote[] = [];
  const comErro: GuiaDoLote[] = [];
  for (const a of lista) {
    if (a.status === 'erro') { if (!escondidas.includes(a.id)) comErro.push(a); continue; }
    if (a.status !== 'lido') continue;
    if (a.fora) { if (!escondidas.includes(a.id)) tirados.push(a); continue; }
    const x = efetivoDaGuia(a, grupo);
    if (x.codigo == null || !x.competencia) { faltam.push(a); continue; }
    const chave = x.codigo + '_' + x.competencia;
    if (!porChave.has(chave)) porChave.set(chave, { codigo: x.codigo, competencia: x.competencia, arquivos: [] });
    porChave.get(chave)!.arquivos.push(a);
  }
  // a competência do lote: a mais comum entre as lidas (senão, a do Relatório aberto); vale para a guia em que o leitor não a achou
  const contagem = new Map<string, number>();
  for (const g of porChave.values()) contagem.set(g.competencia, (contagem.get(g.competencia) || 0) + g.arquivos.length);
  const competenciaDoLote = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || competenciaDaTela;
  const resultadoDe = new Map((atual?.resultados || []).map(r => [r.chave, r]));
  // a via que vale: a escolhida no lote; senão a do Relatório da apuração anterior (Impresso lá) e, sem e-mail, impresso
  const viaDe = (codigo: number, competencia: string, email: string): ViaDaGuia => {
    const escolhida = atual?.vias[String(codigo)];
    if (escolhida) return escolhida;
    const antes = controle.doMes(t.somarMesesDaCompetencia(competencia, -1)).linhas.get(codigo);
    if (antes?.entregue === 'econtador' || antes?.entregue === 'scireport' || antes?.entregue === 'zap') return antes.entregue;
    return antes?.entregue === 'impresso' || !email ? 'impresso' : 'email';
  };
  const grupos = [...porChave.entries()].map(([chave, g]) => {
    const email = doCodigo.get(g.codigo)?.email || '';
    return { chave, ...g, nome: doCodigo.get(g.codigo)?.nome || '', email, whatsapp: doCodigo.get(g.codigo)?.whatsapp || '', via: viaDe(g.codigo, g.competencia, email), resultado: resultadoDe.get(chave) || null };
  }).sort((a, b) => a.codigo - b.codigo || a.competencia.localeCompare(b.competencia));
  const pendentes = grupos.filter(g => g.resultado?.status !== 'enviado');

  // "Enviados": o registro de cada e-mail (fica; o lote some do banco em 3 dias), na competência da apuração escolhida
  const [competenciaEnviados, setCompetenciaEnviados] = useState(competenciaDaTela);
  const doMes = repo.enviados(competenciaEnviados);
  const enviados = doMes.lista.filter(x => x.grupo === grupo);
  const rotuloDaColuna = (c: string) => CURTO[c] || doGrupo.colunas.find(x => x.id === c)?.rotulo || c;

  // o modelo do e-mail e a prévia com um cliente do lote
  const modelo = repo.modelo();
  const exemplo = grupos[0];
  const comp = exemplo?.competencia || competenciaDaTela;
  const camposDe = (cliente: string, c: string): Record<string, string> => ({ cliente, competencia: c.slice(5) + '/' + c.slice(0, 4), mes: t.rotuloCompetencia(c).toLowerCase().replace('/', ' de ') });
  const encherCom = (m: string, campos: Record<string, string>) => m.replace(/\{(\w+)\}/g, (tudo, nome: string) => campos[nome] ?? tudo);
  const encher = (m: string) => encherCom(m, camposDe(exemplo?.nome || 'EMPRESA EXEMPLO LTDA', comp));
  /** o wa.me do cliente com o texto do Modelo do e-mail (o assunto não vai: no WhatsApp é só a mensagem, e o "e-mail" do texto vira "mensagem"); '' sem número */
  const linkDoZap = (codigo: number, nome: string, competencia: string) =>
    financeiro.linkDoWhatsapp(doCodigo.get(codigo)?.whatsapp || '', encherCom(modelo.texto || MODELO_PADRAO_DAS_GUIAS.texto, camposDe(nome || doCodigo.get(codigo)?.nome || 'Cliente ' + codigo, competencia))
      .replace(/\beste e-mail\b/gi, 'esta mensagem'));

  const nomeDoCodigo = (codigo: number) => tarefas.listarEmpresas().find(e => e.codigo === codigo)?.nome || 'Cliente ' + codigo;
  return {
    exemplos: repo.exemplos,
    /** a aba "Já na pasta" (ficha E15): as guias do mês já arquivadas no Drive */
    pasta: {
      carregadas: naPasta.carregadas && naPasta.comp === competenciaDaTela, erro: naPasta.erro,
      guias: doGrupoNaPasta.map(g => ({ ...g, marcada: !desmarcadas.includes(g.driveId), cliente: nomeDoCodigo(g.codigo) })),
      marcadas: doGrupoNaPasta.filter(g => !desmarcadas.includes(g.driveId)).length,
      alternar: (driveId: string) => setDesmarcadas(d => (d.includes(driveId) ? d.filter(x => x !== driveId) : [...d, driveId])),
      criando: criandoDaPasta,
      /** cria o lote com as marcadas; devolve se criou (a tela volta para o lote) */
      async criarLote() {
        const vao = doGrupoNaPasta.filter(g => !desmarcadas.includes(g.driveId));
        if (!vao.length || criandoDaPasta) return false;
        setCriandoDaPasta(true);
        try {
          setEscolhido(await repo.criarDaPasta(grupo, vao));
          toast(vao.length + (vao.length === 1 ? ' guia foi' : ' guias foram') + ' para o lote: o robô lê do Drive e você revisa antes de disparar.');
          return true;
        } catch (e) { toast('Não consegui criar o lote: ' + (e instanceof Error ? e.message : String(e))); return false; } finally { setCriandoDaPasta(false); }
      },
    },
    carregando: !todos.carregados,
    grupo: doGrupo,
    /** os lotes com o que mandar (o aberto é o atual) */
    paraEnviar,
    atual,
    /** os e-mails já enviados na competência escolhida, deste grupo, o mais novo primeiro */
    enviados,
    enviadosCarregados: doMes.carregados,
    competenciaEnviados,
    setCompetenciaEnviados,
    escolherLote: setEscolhido,
    grupos,
    faltam,
    tirados,
    /** tira da lista "Fora do lote" a guia tirada ou com erro (só esconde: ela não vai no disparo de qualquer jeito) */
    excluirDeFora: (a: GuiaDoLote) => setEscondidas(x => (x.includes(a.id) ? x : [...x, a.id])),
    comErro,
    clientes,
    /** a competência que vale para a guia sem ela (a mais comum do lote) */
    competenciaDoLote,
    subindo,
    disparando,
    /** as colunas do Relatório para escolher (e "sem coluna") */
    colunas: [...doGrupo.colunas.map(c => ({ valor: c.id, rotulo: c.rotulo })), { valor: '', rotulo: 'Sem coluna (só vai no e-mail)' }],
    rotuloDaColuna,
    /** o que a guia leva ao Relatório: 'DAS · 1.234,56', ou por que não leva */
    noRelatorio(a: GuiaDoLote): { coluna: string; valor: string; dividida: boolean } {
      const partes = valoresDaGuia(a, grupo);
      const texto = (v: number) => t.valorDoControle(v.toFixed(2).replace('.', ','));
      // o DARF de PIS e COFINS juntos (05/11/2026): 'PIS + COFINS' e '19,50 + 90,00'
      if (partes.length > 1) return { coluna: partes.map(p => rotuloDaColuna(p.coluna)).join(' + '), valor: partes.map(p => texto(p.valor)).join(' + '), dividida: true };
      const c = colunaQueVale(a, grupo);
      const v = valorDaGuia(a.leitura?.valor);
      return { coluna: c ? rotuloDaColuna(c) : '', valor: v != null ? texto(v) : '', dividida: false };
    },
    /** "Para enviar": a guia pelos pedaços do lote, montada aqui (nada novo é gravado) */
    abrirDoLote(a: GuiaDoLote) {
      if (!atual) return;
      const lote = atual.id;
      abrirNaAba(a.leitura?.nomeFinal || a.nome, async () => {
        const b = await repo.bytesDaGuia(lote, a.id);
        const url = URL.createObjectURL(new Blob([b as BlobPart], { type: 'application/pdf' }));
        // a aba já carregou o PDF depois de um tempo: o endereço pode sair da memória
        setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
        return url;
      }, m => toast('Não consegui abrir a guia: ' + m));
    },
    /**
     * "Enviados": a guia gravada no Drive do cliente, pelo robô (uma cópia de 30 minutos; o PDF não fica no banco). Sem o
     * id (os envios de antes de 04/11/2026, 18h41), a guia é achada pelo nome na pasta do cliente, no mapa do Drive.
     */
    abrirEnviada(g: { nome: string; id: string }, codigo: number) {
      abrirNaAba(g.nome, async () => {
        const fileId = g.id || await idPeloMapa(codigo, g.nome);
        return new Promise<string>((resolver, recusar) => {
          const prazo = setTimeout(() => { parar(); recusar(new Error('o robô não respondeu a tempo')); }, PRAZO_DO_DRIVE_MS);
          const parar = drive.pedir({ modo: 'abrir', fileId, nome: g.nome }, x => {
            if (x.status === 'pronto' && x.url) { clearTimeout(prazo); parar(); resolver(x.url); }
            else if (x.status === 'erro') { clearTimeout(prazo); parar(); recusar(new Error(x.erro || 'erro do robô')); }
          });
        });
      }, m => toast('Não consegui abrir a guia: ' + m));
    },
    /**
     * "Abrir no WhatsApp" (12/11/2026, ticket 1ORUBY): a conversa do cliente com a mensagem do modelo, numa aba nova (aberta
     * já no clique, senão o navegador bloqueia), e as guias baixadas para anexar lá. Só antes do disparo: depois, o robô
     * apaga os pedaços e as guias ficam no Drive (em "Enviados").
     */
    abrirWhatsApp(g: { codigo: number; nome: string; competencia: string; arquivos: GuiaDoLote[] }) {
      const link = linkDoZap(g.codigo, g.nome, g.competencia);
      if (!link) { toast('O cliente ' + g.codigo + ' não tem WhatsApp no Cadastro nem no Entregas.'); return; }
      window.open(link, '_blank', 'noopener');
      if (!atual) return;
      const lote = atual.id;
      void (async () => {
        try {
          for (const a of g.arquivos) {
            const b = await repo.bytesDaGuia(lote, a.id);
            baixarBytes(b, a.leitura?.nomeFinal || a.nome, 'application/pdf');
          }
          toast(g.arquivos.length === 1 ? 'A guia foi baixada: anexe na conversa do WhatsApp.' : 'As ' + g.arquivos.length + ' guias foram baixadas: anexe na conversa do WhatsApp.');
        } catch (e) { toast('Não consegui baixar as guias: ' + (e instanceof Error ? e.message : String(e))); }
      })();
    },
    /** "Enviados" pelo WhatsApp: a conversa do cliente com a mensagem do modelo (as guias abrem pelo nome, do Drive) */
    abrirWhatsAppDoEnviado(x: { codigo: number; empresa: string; competencia: string }) {
      const link = linkDoZap(x.codigo, x.empresa, x.competencia);
      if (!link) { toast('O cliente ' + x.codigo + ' não tem WhatsApp no Cadastro nem no Entregas.'); return; }
      window.open(link, '_blank', 'noopener');
    },
    /** o lote aberto pode ser excluído: parado (lido, com erro, ou disparado com alguém que não recebeu), não no meio do robô */
    podeExcluir: !!atual && ['lido', 'disparado', 'erro'].includes(atual.status),
    /** exclui o lote aberto, depois de confirmar (04/11/2026: "Coloca o botão de excluir o para enviar"); quem já recebeu continua em Enviados */
    async excluirLote() {
      if (!atual) return;
      const enviados = atual.resultados.filter(r => r.status === 'enviado').length;
      const ok = await modal({
        icone: 'lixeira', titulo: 'Excluir este lote?',
        texto: 'As ' + atual.total + (atual.total === 1 ? ' guia somem' : ' guias somem') + ' daqui e nada mais é enviado.' +
          (enviados ? ' Os ' + enviados + ' clientes que já receberam continuam em "Enviados".' : ''),
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      try { await repo.excluir(atual.id); setEscolhido(null); toast('Lote excluído.'); }
      catch (e) { toast('Não consegui excluir: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** quantos clientes vão no disparo (os ainda não enviados) */
    paraDisparar: pendentes.length,
    /** muda a via do cliente (Gmail, Impresso, eContador, SCI Report ou WhatsApp) no lote aberto */
    async mudarVia(codigo: number, via: ViaDaGuia) {
      if (!atual) return;
      try { await repo.definirVias(atual.id, { ...atual.vias, [String(codigo)]: via }); }
      catch (e) { toast('Não consegui gravar: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** o lote aberto recebe mais guias: lido e ainda não disparado (05/11/2026) */
    podeAdicionar,
    /** as guias escolhidas que ainda não subiram (esperam o botão Subir) */
    aSubir: aSubir.map((f, i) => ({ i, nome: f.name, tamanho: f.size })),
    /** escolher (ou arrastar) junta à lista; o mesmo arquivo (nome e tamanho) não entra duas vezes */
    escolherParaSubir(fs: File[]) {
      const pdfs = fs.filter(f => /\.pdf$/i.test(f.name));
      if (pdfs.length < fs.length) toast('Só PDF: ' + (fs.length - pdfs.length) + (fs.length - pdfs.length === 1 ? ' arquivo ficou' : ' arquivos ficaram') + ' de fora.');
      setASubir(atuais => [...atuais, ...pdfs.filter(f => !atuais.some(x => x.name === f.name && x.size === f.size))]);
    },
    tirarDaSubida: (i: number) => setASubir(atuais => atuais.filter((_, k) => k !== i)),
    limparSubida: () => setASubir([]),
    /** o botão Subir: manda a lista ao robô (no lote aberto, ou num novo) e limpa a lista se deu certo */
    async subirEscolhidas(noLote = false) {
      if (!aSubir.length || subindo) return;
      if (await this.subir(aSubir, noLote)) setASubir([]);
    },
    /** sobe as guias escolhidas: no lote aberto (noLote) ou num lote novo; o robô lê. true = subiu */
    async subir(escolhidas: FileList | File[], noLote = false): Promise<boolean> {
      const lista = Array.from(escolhidas);
      if (!lista.length || subindo) return false;
      const destino = noLote && podeAdicionar && atual ? atual : null;
      const jaTem = destino ? lista.length + destino.total : lista.length;
      if (jaTem > MAX_ARQUIVOS) { toast('No máximo ' + MAX_ARQUIVOS + ' guias por lote' + (destino ? ' (este já tem ' + destino.total + ')' : '') + '.'); return false; }
      const grande = lista.find(f => f.size > MAX_BYTES);
      if (grande) { toast(grande.name + ' passa de 25 MB.'); return false; }
      setSubindo({ feitos: 0, total: lista.length });
      try {
        const escolhidas = await Promise.all(lista.map(async f => ({ nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
      // o PDF com guias de vários clientes vira um arquivo por cliente, se a pessoa confirmar (plano do Acessórias,
      // 17/11/2026, ficha E16; frase do dono: "Separar PDF (E16)"); cancelou, nada sobe
        const lidos = await separarPorCliente(escolhidas);
        if (!lidos) return false;
        if (lidos.length + (destino ? destino.total : 0) > MAX_ARQUIVOS) { toast('No máximo ' + MAX_ARQUIVOS + ' guias por lote.'); return false; }
        setSubindo({ feitos: 0, total: lidos.length });
        if (destino) await repo.adicionar(destino.id, lidos, (feitos, total) => setSubindo({ feitos, total }));
        else setEscolhido(await repo.subir(grupo, lidos, (feitos, total) => setSubindo({ feitos, total })));
        toast(lidos.length + (lidos.length === 1 ? ' guia enviada' : ' guias enviadas') + ' ao robô para ler' + (destino ? ', no mesmo lote.' : '.'));
        return true;
      } catch (e) { toast('Não consegui subir: ' + (e instanceof Error ? e.message : String(e))); return false; } finally { setSubindo(null); }
    },
    /** a escolha da revisão: o que mudar (cliente, coluna ou competência) vale sobre o que o robô leu */
    async escolher(arquivo: GuiaDoLote, mudar: Partial<EscolhaDaGuia>) {
      if (!atual) return;
      const x = efetivoDaGuia(arquivo, grupo);
      const coluna = mudar.coluna ?? (arquivo.escolha?.coluna ?? undefined);
      const escolha: EscolhaDaGuia = {
        cliente: mudar.cliente ?? (x.codigo || 0),
        // a guia sem tipo lido vai para a pasta do tipo da coluna escolhida (o DAS, a DARF, o DAE ou o DAM)
        tipo: mudar.tipo ?? (x.tipo || (coluna ? t.TIPO_DA_COLUNA[coluna] : '') || 'OUTRO'),
        competencia: mudar.competencia ?? (x.competencia || competenciaDoLote),
        ...(coluna != null ? { coluna } : {}),
      };
      try { await repo.escolher(atual.id, arquivo.id, escolha); }
      catch (e) { toast('Não consegui gravar: ' + (e instanceof Error ? e.message : String(e))); }
    },
    async tirar(arquivo: GuiaDoLote, fora: boolean) {
      if (!atual) return;
      try { await repo.tirar(atual.id, arquivo.id, fora); } catch (e) { toast('Não consegui: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** dispara o lote (os clientes ainda não enviados), depois de confirmar */
    async disparar(agendar?: { data: string; hora: string }) {
      if (!atual || disparando) return;
      // o envio agendado (plano do Acessórias, 17/11/2026, ficha E17; frase do dono: "Seguir"): o dia e a hora de Brasília; nada sai antes
      const agendadoPara = agendar ? t.agendadoParaIso(agendar.data, agendar.hora) : '';
      if (agendar) { const erro = t.erroDoAgendamento(agendadoPara, new Date()); if (erro) { toast(erro); return; } }
      const venceAntes = agendadoPara ? t.venceAntesDoEnvio(agendadoPara, (arquivos?.lista || []).map(a => a.leitura?.vencimento || '')) : null;
      const quando = agendadoPara ? 'Sai ' + t.rotuloDoAgendamento(agendadoPara) + ' (na primeira vez que o robô passar depois dessa hora). '
        + (venceAntes ? 'Atenção: tem guia que vence em ' + venceAntes + ', antes do envio. ' : '') : '';
      const n = pendentes.length;
      if (!n) return;
      const porEmail = pendentes.filter(g => g.via === 'email').length;
      const impressos = pendentes.filter(g => g.via === 'impresso').length;
      const noEcontador = pendentes.filter(g => g.via === 'econtador').length;
      const noSci = pendentes.filter(g => g.via === 'scireport').length;
      const noZap = pendentes.filter(g => g.via === 'zap').length;
      const semEmail = pendentes.filter(g => g.via === 'email' && !g.email).length;
      const semZap = pendentes.filter(g => g.via === 'zap' && !g.whatsapp).length;
      const ok = await modal({
        icone: 'envelope', titulo: (agendadoPara ? 'Agendar para ' : 'Disparar para ') + n + (n === 1 ? ' cliente?' : ' clientes?'),
        texto: quando + (porEmail ? porEmail + (porEmail === 1 ? ' cliente recebe' : ' clientes recebem') + ' as guias no e-mail do cadastro. ' : '') +
          (impressos ? impressos + (impressos === 1 ? ' cliente vai' : ' clientes vão') + ' para a rota do Entregas, com as guias anexadas para imprimir. ' : '') +
          (noEcontador ? noEcontador + (noEcontador === 1 ? ' cliente fica' : ' clientes ficam') + ' com Entregue = eContador (as guias no Drive, para postar no eContador). ' : '') +
          (noSci ? noSci + (noSci === 1 ? ' cliente fica' : ' clientes ficam') + ' com Entregue = SCI Report (as guias no Drive, para mandar pelo SCI Report). ' : '') +
          (noZap ? noZap + (noZap === 1 ? ' cliente fica' : ' clientes ficam') + ' com Entregue = WhatsApp (a mensagem vai pelo "Abrir no WhatsApp" de cada um). ' : '') +
          'O robô grava cada guia na pasta do cliente no Drive e preenche o ' + doGrupo.rotulo +
          ' no Relatório: o valor de cada coluna e o Entregue (e-mail, com a data, impresso, eContador, SCI Report ou WhatsApp), só onde está em branco.' +
          (semEmail ? ' ' + semEmail + (semEmail === 1 ? ' cliente está' : ' clientes estão') + ' sem e-mail e vai dar erro.' : '') +
          (semZap ? ' ' + semZap + (semZap === 1 ? ' cliente do WhatsApp está' : ' clientes do WhatsApp estão') + ' sem número no Cadastro e no Entregas.' : '') +
          (faltam.length ? ' ' + faltam.length + (faltam.length === 1 ? ' guia sem cliente fica' : ' guias sem cliente ficam') + ' de fora.' : ''),
        botoes: [{ rotulo: agendadoPara ? 'Agendar' : 'Disparar', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
      });
      if (!ok) return;
      setDisparando(true);
      // a via de cada um vai junto (a que vale na tela, mesmo a que veio do mês anterior)
      try { await repo.definirVias(atual.id, { ...atual.vias, ...Object.fromEntries(pendentes.map(g => [String(g.codigo), g.via])) }); await repo.disparar(atual.id, agendadoPara || undefined); } catch (e) { toast('Não consegui ' + (agendadoPara ? 'agendar' : 'disparar') + ': ' + (e instanceof Error ? e.message : String(e))); } finally { setDisparando(false); }
    },
    /** o lote está agendado (ainda não chegou a hora): o selo e o Cancelar agendamento (ficha E17) */
    agendado: atual && atual.status === 'disparar' && t.aindaAgendado(atual.agendadoPara, Date.now()) ? t.rotuloDoAgendamento(atual.agendadoPara) : '',
    async cancelarAgendamento() {
      if (!atual) return;
      try { await repo.cancelarAgendamento(atual.id); toast('Agendamento cancelado. O lote espera você enviar.'); }
      catch (e) { toast('Não consegui cancelar: ' + (e instanceof Error ? e.message : String(e))); }
    },

    /** o modelo do e-mail (vazio = o padrão) e a prévia com um cliente do lote */
    modelo: { carregado: modelo.carregado, assunto: modelo.assunto, texto: modelo.texto, padrao: MODELO_PADRAO_DAS_GUIAS },
    previa: { assunto: encher(modelo.assunto || MODELO_PADRAO_DAS_GUIAS.assunto), texto: encher(modelo.texto || MODELO_PADRAO_DAS_GUIAS.texto) },
    async gravarModelo(m: { assunto: string; texto: string }) {
      try { await repo.gravarModelo(m); toast('Modelo do e-mail salvo.'); }
      catch (e) { toast('Não consegui salvar: ' + (e instanceof Error ? e.message : String(e))); }
    },
  };
}

export type VmEnvioDeGuias = ReturnType<typeof useEnvioDeGuias>;
