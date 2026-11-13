// ViewModel da tarefa aberta na Central (a nova e a que já existe; 28/10/2026, o cadastro de tarefas do Toriba): as abas
// Tarefa (o título, a descrição, o cliente vinculado, o "Delegar para", a prioridade, o prazo, o status, as datas e os
// anexos), Parecer (os comentários) e Histórico (a linha do tempo das mudanças). Salvar grava e volta para a lista;
// Cancelar volta sem gravar (pergunta se mudou algo); Excluir só para quem criou (ou o admin). Na tarefa que já existe os
// anexos sobem e saem na hora; na nova, ficam esperando o Salvar.
import { empresas as emp, entregas, tarefas, usuarios } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { ehDiretor, caminhoDoExecutor } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { useAcesso, useRepo, useTarefasDelegadas } from '../../dados/repo';
import { bytesDoAnexo, encolherAnexo } from '../../dados/encolherAnexo';
import { tamanhoDoArquivo, type ArquivoParaAnexar } from '../../dados/tarefasDelegadas';
import { useEmpresasPermitidas } from '../empresas/andamento';
import { useAgoraDoExpediente } from './useAgoraDoExpediente';

const d = tarefas.delegadas;
type Rascunho = tarefas.delegadas.Rascunho;
export type AbaDaTarefa = 'tarefa' | 'parecer' | 'historico';

const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const tipoDoArquivo = (ext: string) =>
  (ext === 'pdf' ? 'application/pdf' : ext === 'txt' ? 'text/plain' : ext === 'webp' ? 'image/webp' : 'application/octet-stream');

/** Lê os arquivos escolhidos, já encolhidos para gastar o mínimo no banco (a imagem em WebP, o resto em gzip). */
const lerArquivos = (fs: File[]): Promise<ArquivoParaAnexar[]> => Promise.all(fs.map(encolherAnexo));

/**
 * alvo: o id da tarefa ou 'nova'. voltar: para a lista. criada: depois de criar (paraMim: a tarefa ficou com quem criou).
 * novo: a janela do Início novo (os documentos com o fluxo de enviar, conferir e contestar; 13/11/2026).
 */
export function useTarefaAberta(alvo: string, voltar: () => void, criada: (paraMim: boolean) => void, novo = false) {
  const repo = useTarefasDelegadas();
  const acesso = useAcesso();
  // o cliente vinculado: só as empresas da pessoa (29/10/2026)
  const empresas = useEmpresasPermitidas().filtrar(useRepo().listarEmpresas());
  const { operador } = useOperador();
  const admin = !!operador?.admin;
  const { toast, modal } = useRetorno();
  const eu = repo.eu();
  const uid = eu?.uid || '';
  // 'documentos': a nova já como pedido de documentos (o botão Delegar documentos do Início; 12/11/2026)
  const pedido = alvo === 'documentos';
  const ehNova = alvo === 'nova' || pedido;
  const { carregadas, tarefas: todas } = repo.lista();
  const tarefa = ehNova ? null : todas.find(t => t.id === alvo) || null;
  const relogio = useAgoraDoExpediente();
  // o Visualizado (12/11/2026): a primeira vez que quem recebeu abre a tarefa, a hora vai ao banco (sem a regra no ar, fica sem)
  const marcar = !!tarefa && d.marcaVisualizada(tarefa, uid);
  useEffect(() => {
    if (marcar && tarefa) repo.marcarVisualizada(tarefa.id).catch(() => { /* sem rede ou sem a regra: tenta na próxima vez que abrir */ });
  }, [marcar, tarefa?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // o rascunho começa da tarefa (ou vazio); o prazo fica no texto do CampoData (dd/mm/aaaa) até salvar
  const [inicial, setInicial] = useState<Rascunho>(() => (tarefa ? d.rascunhoDe(tarefa) : pedido ? { ...d.rascunhoVazio(null), titulo: d.TITULO_DO_PEDIDO, tipo: 'documentos' } : d.rascunhoVazio(null)));
  const [r, setR] = useState<Rascunho>(inicial);
  const [prazoTexto, setPrazoTexto] = useState(() => d.prazoParaTela(inicial.prazo));
  const [aba, setAba] = useState<AbaDaTarefa>('tarefa');
  const [pendentes, setPendentes] = useState<ArquivoParaAnexar[]>([]);
  // os links da tarefa nova esperam o Criar, como os anexos (o Início novo; 13/11/2026)
  const [linksPendentes, setLinksPendentes] = useState<string[]>([]);
  const [parecer, setParecer] = useState('');
  const [ocupado, setOcupado] = useState<'' | 'salvar' | 'excluir' | 'anexar' | 'parecer'>('');
  const [erro, setErro] = useState('');
  // o toggle Delegar (09/11/2026: "caso esteja off, não é para a tarefa ser delegada, é para o próprio usuário"): enquanto a
  // pessoa não mexe, segue a tarefa (de outra pessoa = ligado; a nova e a dela mesma = desligado)
  // (o pedido de documentos já abre delegando: é para outra pessoa anexar)
  const [delegarEscolhido, setDelegarEscolhido] = useState<boolean | null>(pedido ? true : null);
  // delegar documentos no Início novo (13/11/2026): pedir ou enviar, o cliente obrigatório e uma ou mais pessoas (uma tarefa
  // para cada); a janela antiga não escolhe o modo e segue como era
  const [modoDocs, setModoDocs] = useState<tarefas.delegadas.ModoDosDocumentos | null>(null);
  const [pessoasDocs, setPessoasDocs] = useState<string[]>([]);
  // o ⚡ preencheu com o exemplo: o Criar não grava nada (modo desenvolvedor)
  const [deTeste, setDeTeste] = useState(false);

  // a tarefa que chega do banco depois de aberta (a lista ainda carregava, ou outra pessoa mudou; 29/10/2026: "não salva
  // nada"): o formulário acompanha o banco nos campos que a pessoa não mexeu, e o que ela mudou fica por cima (30/10/2026:
  // antes ele parava de acompanhar no primeiro toque e o Salvar regravava tudo, desfazendo o status e o responsável que
  // outra pessoa tinha mudado nesse meio-tempo)
  const [base, setBase] = useState(tarefa?.atualizadaEm ?? '');
  if (tarefa && tarefa.atualizadaEm !== base) {
    setBase(tarefa.atualizadaEm);
    const minhas = d.mudancasDoRascunho(inicial, { ...r, prazo: d.prazoDaTela(prazoTexto) ?? r.prazo });
    const novo = d.rascunhoDe(tarefa);
    setInicial(novo);
    setR({ ...novo, ...minhas });
    // o prazo que a pessoa escreveu fica (mesmo pela metade); sem mexer, vem o do banco
    if (prazoTexto === d.prazoParaTela(inicial.prazo)) setPrazoTexto(d.prazoParaTela(novo.prazo));
  }

  const mudar = (p: Partial<Rascunho>) => { setR(x => ({ ...x, ...p })); setErro(''); };
  const prazo = d.prazoDaTela(prazoTexto);
  const delegar = delegarEscolhido ?? (!!r.responsavel && r.responsavel.uid !== uid);
  const final: Rascunho = {
    ...r, prazo: prazo ?? r.prazo, responsavel: delegar || !eu ? r.responsavel : { uid: eu.uid, nome: eu.nome },
    // a nova que vai para outra pessoa nasce pendente: quem recebe é que inicia
    status: ehNova && delegar ? 'pendente' : r.status,
  };
  // o que a pessoa mudou desde que abriu: é só isso que o Salvar grava
  const mudancas = ehNova ? {} : d.mudancasDoRascunho(inicial, final);
  const mudou = ehNova
    ? !!(r.titulo.trim() !== inicial.titulo || r.descricao.trim() || r.clientes.length || r.responsavel || prazoTexto || r.prazoHora || pendentes.length || r.prioridade !== 'normal' || r.status !== 'pendente' || linksPendentes.length || !!modoDocs || pessoasDocs.length)
    : !!tarefa && (Object.keys(mudancas).length > 0 || prazo === null);
  const podeMudar = ehNova || (!!tarefa && d.podeMudar(tarefa, uid));
  // a etapa delegada a esta pessoa (Vitor, 10/11/2026): abre só ela, com o resto da empresa bloqueado
  const caminhoDaEtapa = tarefa?.etapaDelegada && tarefa.responsavel.uid === uid && tarefa.status !== 'cancelada' ? caminhoDoExecutor(tarefa.etapaDelegada.rota, tarefa.etapaDelegada.periodo) + '?delegada=' + tarefa.id : null;

  // a equipe ativa no "Delegar para" (quem já é o responsável fica, mesmo desativado)
  // com a foto de perfil (a do Entregas, usuarios.fotoPerfil) e as iniciais para quem não tem (28/10/2026: "a escolha tem
  // que ser um dropdown com foto de perfil")
  const docs = acesso.equipe().docs;
  const pessoa = (u: { uid: string; nome: string }) => ({ uid: u.uid, nome: u.nome, voce: u.uid === uid, foto: String(docs[u.uid]?.fotoPerfil || '') || null, iniciais: usuarios.iniciais(u.nome) });
  // as contas reservadas (Fiscal Xereta, Contábil Curioso) só aparecem para o Diretor e o admin (Vitor, 09/11/2026)
  const equipe = acesso.equipe().lista.filter(u => (u.ativo && (ehDiretor(operador) || !usuarios.ehContaReservada(u.email) || u.uid === uid)) || u.uid === r.responsavel?.uid).map(pessoa);
  if (r.responsavel && !equipe.some(p => p.uid === r.responsavel?.uid)) equipe.unshift(pessoa(r.responsavel));

  const mesmaEmpresa = (a: { codigo: number | null; nome: string }, b: { codigo: number | null; nome: string }) => a.codigo === b.codigo && a.nome === b.nome;

  // o parecer escrito e ainda não gravado (29/10/2026: "o parecer não fica gravado"): quem escrevia e clicava em Salvar,
  // no ‹ Voltar ou fechava a Central perdia o texto sem aviso; agora o Salvar grava junto e o sair pergunta
  const parecerEscrito = !ehNova && !!tarefa && podeMudar && !!parecer.trim();

  /** grava o parecer escrito; false = não gravou (o motivo já foi para o toast) */
  async function gravarParecer(): Promise<boolean> {
    if (!tarefa) return false;
    const problema = d.problemaDoParecer(parecer, tarefa);
    if (problema) { toast(problema); return false; }
    setOcupado('parecer');
    try { await repo.comentar(tarefa.id, parecer); setParecer(''); return true; } catch (e) { toast('Não gravei o parecer: ' + (e instanceof Error ? e.message : String(e))); return false; } finally { setOcupado(''); }
  }

  /** pergunta antes de largar o que mudou (e o parecer escrito); sem mudança, segue direto */
  async function largar(depois: () => void) {
    if (parecerEscrito && !mudou) {
      const r = await modal<'' | 'descartar' | 'gravar'>({ icone: 'alert', titulo: 'Gravar o parecer?', texto: 'O parecer que você escreveu ainda não foi gravado.',
        botoes: [{ rotulo: 'Continuar editando', valor: '', variante: 'btn-outline' }, { rotulo: 'Descartar', valor: 'descartar', variante: 'btn-outline' },
          { rotulo: 'Gravar parecer', valor: 'gravar', variante: 'btn-primary' }] });
      if (!r || (r === 'gravar' && !(await gravarParecer()))) return;
    } else if ((mudou || parecerEscrito) && podeMudar) {
      const ok = await modal({ icone: 'alert', titulo: 'Descartar as mudanças?', texto: parecerEscrito ? 'O que você mudou nesta tarefa e o parecer não foram salvos.' : 'O que você mudou nesta tarefa não foi salvo.',
        botoes: [{ rotulo: 'Continuar editando', valor: false, variante: 'btn-outline' }, { rotulo: 'Descartar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
    }
    depois();
  }

  return {
    caminhoDaEtapa,
    carregando: !ehNova && !carregadas,
    /** a tarefa saiu da lista da pessoa (apagada, ou delegada para outra pessoa por quem criou) */
    sumiu: !ehNova && carregadas && !tarefa,
    ehNova,
    numero: tarefa?.numero || null,
    // nos intervalos (11:05–13:00 e 18:05–07:00) a em andamento aparece Pausada, e volta sozinha (12/11/2026)
    status: tarefa ? { rotulo: d.rotuloNoHorario(tarefa, relogio), tom: d.tomDoStatus(d.situacaoNoHorario(tarefa, relogio).status) } : null,
    podeMudar,
    podeExcluir: !!tarefa && d.podeExcluir(tarefa, uid, admin),
    aba, setAba,
    abas: [
      { valor: 'tarefa' as const, rotulo: 'Tarefa' },
      { valor: 'parecer' as const, rotulo: 'Parecer' + (tarefa?.pareceres.length ? ' (' + tarefa.pareceres.length + ')' : '') },
      { valor: 'historico' as const, rotulo: 'Histórico' },
    ],
    erro,

    // ---- a aba Tarefa
    rascunho: r,
    setTitulo: (titulo: string) => mudar({ titulo }),
    setDescricao: (descricao: string) => mudar({ descricao }),
    maiorTitulo: d.MAIOR_TITULO,
    maiorDescricao: d.MAIOR_DESCRICAO,
    prazoTexto,
    setPrazo: (v: string) => { setPrazoTexto(v); setErro(''); },
    prazoInvalido: prazo === null,
    prazoHora: r.prazoHora,
    setPrazoHora: (prazoHora: string) => mudar({ prazoHora }),
    prioridades: d.PRIORIDADES,
    setPrioridade: (v: string) => { if (d.ehPrioridade(v)) mudar({ prioridade: v }); },
    opcoesDeStatus: d.STATUS.map(s => ({ valor: s.valor, rotulo: s.rotulo })),
    setStatus: (s: tarefas.delegadas.Status) => mudar({ status: s }),
    /** a tarefa nova: "Já estava fazendo" nasce em andamento; sem marcar, pendente (09/11/2026) */
    jaFazendo: r.status === 'andamento',
    setJaFazendo: (sim: boolean) => mudar({ status: sim ? 'andamento' : 'pendente' }),
    /** o seletor de status é de quem criou (o controle de quem delegou); quem recebeu usa os botões */
    mudaStatus: !!tarefa && (tarefa.criadaPor.uid === uid || admin),
    /** Iniciar, Pausar, Retomar e Concluir: de quem vai fazer a tarefa */
    acoes: tarefa && tarefa.responsavel.uid === uid ? d.acoesDaTarefa(tarefa, relogio) : [],
    /** o pedido de documentos: o aviso no alto da janela */
    pedeDocumentos: pedido || (!!tarefa && d.pedeDocumentos(tarefa)),
    souQuemFaz: !!tarefa && tarefa.responsavel.uid === uid,
    /** delegar documentos no Início novo: o passo 1 (pedir ou enviar, o cliente, para quem) e o ⚡ */
    documentos: {
      modo: modoDocs,
      escolherModo(m: tarefas.delegadas.ModoDosDocumentos) {
        setModoDocs(m);
        setR(x => d.rascunhoDosDocumentos(x, m));
        // o requerer vai para uma pessoa só; o envio não tem prazo
        if (m === 'requerer') setPessoasDocs(p => p.slice(0, 1)); else setPrazoTexto('');
        setErro('');
      },
      pessoas: pessoasDocs,
      /** o envio marca e desmarca (uma ou mais); o requerer troca a pessoa (uma só) */
      alternarPessoa(u: string) {
        setPessoasDocs(p => (modoDocs === 'requerer' ? [u] : p.includes(u) ? p.filter(x => x !== u) : [...p, u]));
        setErro('');
      },
      /** o que falta no passo 1: o modo e o cliente */
      faltaNoPasso1: d.problemaDosDocumentos({ modo: modoDocs, clientes: r.clientes.length, pessoas: 1, anexos: 1, links: 1, prazo: '-' }),
      deTeste,
      /** o ⚡ Dados de teste: preenche com o exemplo do envio ou do requerer; nada vai para o banco */
      preencherExemplo(m: tarefas.delegadas.ModoDosDocumentos) {
        setModoDocs(m);
        setR(x => ({ ...d.rascunhoDosDocumentos(x, m), clientes: [{ codigo: null, nome: 'Cliente de teste (EXEMPLO)' }], prioridade: m === 'requerer' ? 'alta' : 'normal',
          descricao: m === 'requerer' ? 'Os extratos de outubro e as notas de entrada do mês (EXEMPLO)' : 'O contrato social e a última alteração (EXEMPLO)' }));
        const outros = equipe.filter(p => !p.voce);
        setPessoasDocs((m === 'requerer' ? outros.slice(0, 1) : outros.slice(0, 2)).map(p => p.uid));
        setPrazoTexto(m === 'requerer' ? d.prazoParaTela(tarefas.agenda.somarDias(d.hojeIso(), 2)) : '');
        if (m === 'enviar' && !linksPendentes.length) setLinksPendentes(['https://exemplo.com/contrato-social']);
        setDeTeste(true);
        setErro('');
      },
      // ---- a tarefa de documentos que já existe: onde está e os botões de quem está com ela
      situacao: tarefa ? d.situacaoDosDocumentos(tarefa) : '',
      /** o envio não tem prazo nem prioridade */
      ehEnvio: !!tarefa && d.enviaDocumentos(tarefa),
      acoes: tarefa && novo ? d.acoesDosDocumentos(tarefa, uid) : [],
      /** para quem dá para repassar o requerer: a equipe, menos quem pediu e quem está com ele */
      paraRepassar: tarefa ? equipe.filter(p => p.uid !== tarefa.criadaPor.uid && p.uid !== tarefa.responsavel.uid) : [],
      async repassarPara(uidNovo: string) {
        const p = equipe.find(x => x.uid === uidNovo);
        if (!tarefa || !p) return;
        const ok = await modal({ icone: 'repeat', titulo: 'Repassar para ' + p.nome + '?', texto: 'A conversa segue entre ' + tarefa.criadaPor.nome + ' e ' + p.nome + ', com o histórico. A tarefa sai da sua lista.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Repassar', valor: true, variante: 'btn-primary' }] });
        if (!ok) return;
        try {
          await repo.salvar(tarefa.id, { responsavel: { uid: p.uid, nome: p.nome }, entrega: '' });
          toast('Repassado para ' + p.nome + '.');
          voltar();
        } catch (e) { setErro('Não repassei: ' + (e instanceof Error ? e.message : String(e))); }
      },
      async fazer(id: tarefas.delegadas.AcaoDosDocumentos) {
        if (!tarefa) return;
        try {
          if (id === 'confirmarRecebimento') { await repo.salvar(tarefa.id, { status: 'concluida' }); toast('Recebimento confirmado.'); voltar(); }
          if (id === 'enviarDocumentos') { await repo.salvar(tarefa.id, { entrega: 'enviada' }); toast('Enviado para ' + tarefa.criadaPor.nome + ' conferir.'); }
          if (id === 'confirmarTudo') { await repo.salvar(tarefa.id, { status: 'concluida' }); toast('Tarefa concluída.'); voltar(); }
          if (id === 'contestar') {
            // o que faltou vai no comentário (Vitor: "se faltou algo, pode contestar")
            if (!parecer.trim()) { setErro('Escreva no comentário o que faltou e clique em Contestar.'); return; }
            if (!(await gravarParecer())) return;
            await repo.salvar(tarefa.id, { entrega: 'contestada' });
            toast('Contestado: volta para ' + tarefa.responsavel.nome + '.');
          }
          setErro('');
        } catch (e) { setErro('Não gravei: ' + (e instanceof Error ? e.message : String(e))); }
      },
    },
    async fazerAcao(status: tarefas.delegadas.Status) {
      if (!tarefa) return;
      try {
        await repo.salvar(tarefa.id, { status });
        if (status === 'concluida' && !mudou) voltar();
      } catch (e) { setErro('Não gravei: ' + (e instanceof Error ? e.message : String(e))); }
    },
    equipe,
    delegar,
    /** ligar numa tarefa que era da própria pessoa pede para escolher alguém; desligar deixa a tarefa com ela (no Salvar) */
    alternarDelegar: () => {
      setDelegarEscolhido(!delegar);
      if (delegar) setErro(''); else mudar(r.responsavel?.uid === uid ? { responsavel: null } : {});
    },
    setResponsavel: (uidDoResponsavel: string) => {
      const u = acesso.equipe().lista.find(x => x.uid === uidDoResponsavel);
      mudar({ responsavel: u ? { uid: u.uid, nome: u.nome } : r.responsavel?.uid === uidDoResponsavel ? r.responsavel : null });
    },
    /** os clientes vinculados (opcional; 09/11/2026: "deixe eu colocar mais de um", com um botão "+") */
    clientes: r.clientes,
    podeMaisClientes: r.clientes.length < d.MAIS_CLIENTES,
    /** as empresas da pessoa que a busca acha e que ainda não estão na tarefa (sem busca, as primeiras) */
    achadasPara: (q: string) => (q.trim() ? emp.buscarEmpresas(empresas, q) : empresas).filter(e => !r.clientes.some(c => mesmaEmpresa(c, e))).slice(0, 8),
    adicionarCliente: (e: { codigo: number | null; nome: string }) => { if (r.clientes.length < d.MAIS_CLIENTES) mudar({ clientes: [...r.clientes, { codigo: e.codigo, nome: e.nome }] }); },
    tirarCliente: (i: number) => mudar({ clientes: r.clientes.filter((_, n) => n !== i) }),
    datas: tarefa ? [
      { rotulo: 'Criada em', valor: quando(tarefa.criadaEm) + ' por ' + tarefa.criadaPor.nome },
      { rotulo: 'Concluída em', valor: tarefa.concluidaEm ? quando(tarefa.concluidaEm) : '—' },
      // só o expediente conta: os intervalos e a noite ficam de fora
      ...(tarefa.criadaPor.uid === uid && d.rotuloDaVisualizacao(tarefa) ? [{ rotulo: 'Visualizado', valor: d.rotuloDaVisualizacao(tarefa).replace(/^Visualizada /, 'Sim, ') }] : []),
      { rotulo: 'Tempo trabalhado', valor: d.duracaoParaTela(d.minutosTrabalhados(tarefa, relogio)) },
    ] : [],

    // ---- os anexos: na nova, esperando o Salvar; na que existe, sobem na hora
    anexos: ehNova
      ? pendentes.map((a, i) => ({ id: 'p' + i, nome: a.nome, detalhe: entregas.tamanhoLegivel(tamanhoDoArquivo(a)) + ' · vai ao salvar' }))
      : (tarefa?.anexos || []).map(a => ({ id: a.id, nome: a.nome, detalhe: [a.extensao.toUpperCase(), entregas.tamanhoLegivel(a.tamanho), quando(a.em), a.por].filter(Boolean).join(' · ') })),
    limiteDosAnexos: 'Até ' + d.MAIS_ANEXOS + ' arquivos de ' + d.MAIOR_ANEXO / 1024 / 1024 + ' MB cada (' + d.MAIOR_TOTAL_DE_ANEXOS / 1024 / 1024 + ' MB por tarefa).',
    anexando: ocupado === 'anexar',
    async anexar(fs: File[]) {
      if (!fs.length) return;
      const arquivos = await lerArquivos(fs);
      const problema = d.problemaDosAnexos(arquivos.map(a => ({ nome: a.nome, tamanho: tamanhoDoArquivo(a) })), ehNova ? pendentes.map(a => ({ tamanho: tamanhoDoArquivo(a) })) : tarefa?.anexos || []);
      if (problema) { toast(problema); return; }
      if (ehNova) { setPendentes(p => [...p, ...arquivos]); return; }
      if (!tarefa) return;
      setOcupado('anexar');
      try {
        await repo.anexar(tarefa.id, arquivos);
        toast(arquivos.length === 1 ? 'Arquivo anexado.' : arquivos.length + ' arquivos anexados.');
      } catch (e) { toast('Não anexei: ' + (e instanceof Error ? e.message : String(e))); return; } finally { setOcupado(''); }
      // o pedido de documentos (12/11/2026: "após anexar, já dá como concluído"; o Vitor escolheu confirmar, porque às vezes são
      // vários arquivos): quem recebeu responde se já anexou tudo
      if (novo && d.requerDocumentos(tarefa) && tarefa.responsavel.uid === uid && tarefa.criadaPor.uid !== uid && d.emAberto(tarefa) && tarefa.entrega !== 'enviada') {
        const enviar = await modal({ icone: 'check', titulo: 'Enviar os documentos?', texto: tarefa.criadaPor.nome + ' confere e conclui, ou contesta o que faltou.',
          botoes: [{ rotulo: 'Ainda falta', valor: false, variante: 'btn-outline' }, { rotulo: 'Enviar para conferir', valor: true, variante: 'btn-primary' }] });
        if (!enviar) return;
        try { await repo.salvar(tarefa.id, { entrega: 'enviada' }); toast('Enviado para ' + tarefa.criadaPor.nome + ' conferir.'); } catch (e) { setErro('Não enviei: ' + (e instanceof Error ? e.message : String(e))); }
        return;
      }
      if (!novo && d.requerDocumentos(tarefa) && tarefa.responsavel.uid === uid && d.emAberto(tarefa)) {
        const tudo = await modal({ icone: 'check', titulo: 'Anexou tudo?', texto: 'Concluindo, quem delegou vê a tarefa concluída com os documentos.',
          botoes: [{ rotulo: 'Ainda falta', valor: false, variante: 'btn-outline' }, { rotulo: 'Anexei tudo, concluir', valor: true, variante: 'btn-primary' }] });
        if (!tudo) return;
        try {
          await repo.salvar(tarefa.id, { status: 'concluida' });
          toast('Tarefa concluída.');
          if (!mudou) voltar();
        } catch (e) { setErro('Não concluí: ' + (e instanceof Error ? e.message : String(e))); }
      }
    },
    async tirarAnexo(id: string) {
      if (ehNova) { setPendentes(p => p.filter((_, i) => 'p' + i !== id)); return; }
      const a = tarefa?.anexos.find(x => x.id === id);
      if (!tarefa || !a) return;
      const ok = await modal({ icone: 'alert', titulo: 'Tirar ' + a.nome + '?', texto: 'O arquivo sai da tarefa para todos.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      try { await repo.tirarAnexo(tarefa.id, id); toast('Arquivo tirado.'); } catch (e) { toast('Não tirei: ' + (e instanceof Error ? e.message : String(e))); }
    },
    async baixarAnexo(id: string) {
      if (ehNova) { const a = pendentes.find((_, i) => 'p' + i === id); if (a) baixarBytes(await bytesDoAnexo(a.bytes, a.gzip), a.nome, tipoDoArquivo(d.extensaoDe(a.nome))); return; }
      const a = tarefa?.anexos.find(x => x.id === id);
      if (!tarefa || !a) return;
      try {
        const bytes = await repo.baixarAnexo(tarefa.id, id);
        if (bytes) baixarBytes(bytes, a.nome, tipoDoArquivo(a.extensao)); else toast('O arquivo não está mais no banco.');
      } catch (e) { toast('Não baixei: ' + (e instanceof Error ? e.message : String(e))); }
    },

    // ---- salvar, cancelar e excluir
    salvando: ocupado === 'salvar',
    excluindo: ocupado === 'excluir',
    // ---- os links fixados (o Início novo): na nova, esperando o Criar; na que existe, gravam na hora
    links: ehNova ? linksPendentes.map(u => ({ url: u, detalhe: 'vai ao salvar' })) : (tarefa?.links || []).map(l => ({ url: l.url, detalhe: [l.por, quando(l.em)].filter(Boolean).join(' · ') })),
    async fixarLink(url: string): Promise<boolean> {
      const u = url.trim();
      const problema = d.problemaDoLink(u, ehNova ? linksPendentes.map(x => ({ url: x })) : tarefa?.links);
      if (problema) { toast(problema); return false; }
      if (ehNova) { setLinksPendentes(x => [...x, u]); return true; }
      if (!tarefa) return false;
      try { await repo.fixarLink(tarefa.id, u); toast('Link fixado.'); return true; } catch (e) { toast('Não fixei: ' + (e instanceof Error ? e.message : String(e))); return false; }
    },
    async tirarLink(url: string) {
      if (ehNova) { setLinksPendentes(x => x.filter(y => y !== url)); return; }
      if (!tarefa) return;
      try { await repo.tirarLink(tarefa.id, url); } catch (e) { toast('Não tirei: ' + (e instanceof Error ? e.message : String(e))); }
    },
    async salvar() {
      if (pedido && modoDocs) {
        if (prazo === null) { setErro('O prazo não é uma data válida (dd/mm/aaaa).'); return; }
        const problema = d.problemaDosDocumentos({ modo: modoDocs, clientes: r.clientes.length, pessoas: pessoasDocs.length, anexos: pendentes.length, links: linksPendentes.length, prazo: prazo || '' });
        if (problema) { setErro(problema); return; }
        if (deTeste) { toast('Teste: nada foi gravado no banco.'); voltar(); return; }
        const para = pessoasDocs.map(u => equipe.find(p => p.uid === u)).filter((p): p is (typeof equipe)[number] => !!p);
        const feitos: string[] = [];
        setOcupado('salvar');
        try {
          for (const p of para) {
            const id = await repo.criar({ ...r, prazo: modoDocs === 'requerer' ? prazo || '' : '', prazoHora: '', responsavel: { uid: p.uid, nome: p.nome }, status: 'pendente' }, pendentes);
            for (const u of linksPendentes) await repo.fixarLink(id, u);
            feitos.push(p.nome);
          }
          toast((modoDocs === 'requerer' ? 'Pedido delegado para ' : 'Documentos enviados para ') + feitos.join(', ') + '.');
          criada(false);
        } catch (e) {
          setErro('Não delegei' + (feitos.length ? ' para todos (já foi para ' + feitos.join(', ') + ')' : '') + ': ' + (e instanceof Error ? e.message : String(e)));
        } finally { setOcupado(''); }
        return;
      }
      if (prazo === null) { setErro('O prazo não é uma data válida (dd/mm/aaaa).'); return; }
      const problema = d.problemaDaTarefa(final);
      if (problema) { setErro(problema); setAba('tarefa'); return; }
      setOcupado('salvar');
      try {
        if (ehNova) {
          const id = await repo.criar(final, pendentes);
          for (const u of linksPendentes) await repo.fixarLink(id, u);
          const paraMim = final.responsavel?.uid === uid;
          toast(paraMim ? 'Tarefa criada.' : 'Tarefa delegada para ' + final.responsavel?.nome + '.');
          criada(paraMim);
        } else if (tarefa) {
          // o parecer escrito vai junto (primeiro: se não gravar, a pessoa fica na tarefa com o texto)
          if (parecerEscrito) {
            const problemaDoParecer = d.problemaDoParecer(parecer, tarefa);
            if (problemaDoParecer) { setErro(problemaDoParecer); setAba('parecer'); return; }
            await repo.comentar(tarefa.id, parecer);
            setParecer('');
          }
          // sem mudança, só volta (nada a gravar nem a pôr no histórico)
          if (mudou) { await repo.salvar(tarefa.id, mudancas); toast(parecerEscrito ? 'Tarefa e parecer salvos.' : 'Tarefa salva.'); }
          else if (parecerEscrito) toast('Parecer gravado.');
          voltar();
        }
      } catch (e) { setErro('Não salvei: ' + (e instanceof Error ? e.message : String(e))); } finally { setOcupado(''); }
    },
    /** o Cancelar e o ‹ Voltar: pergunta se mudou algo */
    cancelar: () => { void largar(voltar); },
    /** sair da tarefa para outra coisa (fechar a Central, trocar de aba): pergunta se mudou algo */
    largar,
    async excluir() {
      if (!tarefa) return;
      const ok = await modal({ icone: 'alert', titulo: 'Excluir a tarefa ' + tarefa.numero + '?', texto: '"' + tarefa.titulo + '" sai da Central de todos, com os anexos. Não tem como desfazer.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      setOcupado('excluir');
      try { await repo.excluir(tarefa.id); toast('Tarefa excluída.'); voltar(); } catch (e) { setErro('Não excluí: ' + (e instanceof Error ? e.message : String(e))); } finally { setOcupado(''); }
    },

    // ---- o parecer
    pareceres: (tarefa?.pareceres || []).map((p, i) => ({ id: String(i), por: p.por, quando: quando(p.em), texto: p.texto })).reverse(),
    parecer, setParecer,
    maiorParecer: d.MAIOR_PARECER,
    escrevendo: ocupado === 'parecer',
    async escreverParecer() { await gravarParecer(); },

    // ---- o histórico, o mais novo em cima
    historico: (tarefa?.historico || []).map((h, i) => ({ id: String(i), por: h.por, quando: quando(h.em), texto: h.texto })).reverse(),
  };
}
