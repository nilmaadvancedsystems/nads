// ViewModel da página do cliente (16/10/2026, a cópia fiel do montarPaginaDoCliente_ do Entregas): quem é (o cabeçalho
// com os selos), o Resumo (os números, os avisos, os lembretes pra entrega, o contato, a empresa e as últimas entregas), as
// Entregas mês a mês (o Protocolo e o Extrato de cada mês; a entrega feita abre o detalhe, a da rota abre a parada), o
// Cadastro, a Receita, os Contatos, os Documentos e as Ações. `consulta` (como o Painel abre): só ler — sem WhatsApp,
// Ligar, link, lembrete novo e sem a aba Ações.
import { entregas, tarefas as t } from '@nads/core';
import { baixarArquivo, baixarBytes, useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useEntregasDeDocumentos } from '../../dados/repo';
import { useJanelasDasEntregas } from './contextoDasJanelas';
import { abrirAbaDoPapel, escreverNaAba, extratoDoMes, protocoloDoMes } from './papeisParaImprimir';
import { qrDoTexto } from './arquivosDaEntrega';
import { textoDoErro } from './useJanelaDaParada';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;

export type AbaDoCliente = 'resumo' | 'entregas' | 'cadastro' | 'receita' | 'contatos' | 'documentos' | 'acoes';

export function useJanelaDoCliente(clienteId: string, consulta: boolean, abaInicial?: string) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const { operador } = useOperador();
  const quem = repo.quem();
  const clientes = repo.clientes();
  const cliente = clientes.lista.find(c => c.id === clienteId) || null;
  const admin = (!!operador?.admin || !!quem?.papeis.includes('admin')) && !consulta;
  const [historico, setHistorico] = useState<Entrega[] | null>(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<AbaDoCliente>((abaInicial as AbaDoCliente) || 'resumo');
  const [lembreteNovo, setLembreteNovo] = useState('');
  const [gravando, setGravando] = useState(false);
  const avisar = (titulo: string, tom: 'ok' | 'erro' | 'info' = 'ok') => retorno.aviso({ tom, titulo });

  useEffect(() => {
    let vivo = true;
    repo.doCliente(clienteId).then(l => { if (vivo) setHistorico(l); }, err => { if (vivo) { setHistorico([]); setErro(textoDoErro(err, 'Não foi possível carregar o histórico.')); } });
    return () => { vivo = false; };
  }, [clienteId, repo]);

  const h = useMemo(() => historico || [], [historico]);
  const grupos = useMemo(() => entregas.historicoPorCompetencia(h), [h]);
  const porId = useMemo(() => new Map(clientes.lista.map(c => [c.id, c])), [clientes.lista]);
  if (!cliente) return { cliente: null as null, carregando: !clientes.carregada, fechar: janelas.fechar };

  const grupo = cliente.grupoLocal ? clientes.lista.filter(x => x.id !== cliente.id && x.grupoLocal === cliente.grupoLocal).map(x => x.nome) : [];
  const r = cliente.receita;
  const regime = entregas.regimeDoCliente(cliente);
  const lembretes = repo.lembretes().lista.filter(l => l.clienteId === cliente.id);
  const comWhats = !!entregas.numeroDoWhatsApp(cliente.telefone);
  const abasVisiveis: { id: AbaDoCliente; rotulo: string; icone: 'grade' | 'caminhao' | 'fileText' | 'landmark' | 'usuario' | 'arquivo' | 'settings'; n?: number }[] = [
    { id: 'resumo', rotulo: 'Resumo', icone: 'grade' },
    { id: 'entregas', rotulo: 'Entregas', icone: 'caminhao', n: h.length },
    { id: 'cadastro', rotulo: 'Cadastro', icone: 'fileText' },
    { id: 'receita', rotulo: 'Receita', icone: 'landmark' },
    ...(cliente.contatos.length ? [{ id: 'contatos' as const, rotulo: 'Contatos', icone: 'usuario' as const, n: cliente.contatos.length }] : []),
    ...(cliente.papeis.length || cliente.ocorrencias.length ? [{ id: 'documentos' as const, rotulo: 'Documentos', icone: 'arquivo' as const }] : []),
    ...(!consulta ? [{ id: 'acoes' as const, rotulo: 'Ações', icone: 'settings' as const }] : []),
  ];
  const nomeQuem = quem?.nome || '';

  return {
    cliente,
    carregando: historico === null,
    erro,
    consulta, admin,
    fechar: janelas.fechar,
    // ---- o cabeçalho ----
    rotulo: entregas.rotuloDoCliente(cliente),
    iniciais: entregas.iniciaisDoCliente(cliente.nome),
    subtitulo: entregas.subtituloDoCliente(cliente),
    selos: [
      ...(cliente.ativo ? [] : [{ texto: 'Inativo', tom: 'danger' }]),
      ...(r?.situacao ? [{ texto: 'Receita: ' + r.situacao, tom: r.situacao === 'ATIVA' ? 'ok' : 'danger' }] : []),
      ...(regime ? [{ texto: regime, tom: 'neutral' }] : []),
      ...(cliente.zona && entregas.rotuloDaZona(cliente.zona) ? [{ texto: entregas.rotuloDaZona(cliente.zona), tom: 'neutral', pin: true }] : []),
      ...(grupo.length ? [{ texto: 'Entrega junto com ' + grupo.length, tom: 'warn', dica: grupo.join(', ') }] : []),
      ...cliente.etiquetas.map(e => ({ texto: e, tom: 'neutral' })),
    ] as { texto: string; tom: string; pin?: boolean; dica?: string }[],
    abas: abasVisiveis,
    aba: abasVisiveis.some(a => a.id === aba) ? aba : 'resumo',
    setAba,
    // ---- o Resumo ----
    kpis: entregas.kpisDoCliente(cliente, h, grupos.length),
    avisos: entregas.avisosDoCliente(cliente, consulta),
    lembretes: lembretes.map(l => ({ id: l.id, texto: l.texto, meta: 'por ' + (l.criadoPorNome || l.criadoPor || 'alguém da equipe') + ' · ' + entregas.dataHoraDaEntrega(l.criadoEm) })),
    lembreteNovo, setLembreteNovo, gravando,
    async criarLembrete() {
      const tx = lembreteNovo.trim();
      if (!tx) return;
      setGravando(true);
      try { await repo.criarLembrete(cliente.id, entregas.rotuloDoCliente(cliente), tx); setLembreteNovo(''); avisar('Lembrete salvo: aparece pra quem for entregar.'); } catch (err) { avisar(textoDoErro(err, 'Não foi possível salvar o lembrete.'), 'erro'); }
      setGravando(false);
    },
    async resolverLembrete(id: string) {
      try { await repo.resolverLembrete(id); avisar('Lembrete resolvido.'); } catch (err) { avisar(textoDoErro(err, 'Não foi possível resolver.'), 'erro'); }
    },
    telefone: cliente.telefone, comWhats,
    telefoneLink: 'tel:' + cliente.telefone.replace(/[^0-9+]/g, ''),
    contato: entregas.dadosComValor([['E-mail', entregas.emailsDoCliente(cliente).join('\n')], ['Endereço', entregas.enderecoCompleto(cliente)], ['Referência', cliente.pontoReferencia], ['Recebe', entregas.recebeQuando(cliente)]]),
    empresa: r ? entregas.dadosComValor([['Razão social', r.razaoSocial], ['Situação', r.situacao + (r.situacaoDesde ? ' desde ' + entregas.dataBr(r.situacaoDesde) : '')], ['Regime', entregas.regimeNaReceita(r)], ['Atividade', r.cnaeDescricao || r.cnae]])
      : entregas.dadosComValor([['Inscrição estadual', cliente.inscricaoEstadual], ['Enquadramento', cliente.enquadramento]]),
    receitaRuim: !!r && r.situacao !== 'ATIVA',
    temReceita: !!r,
    ultimas: h.slice(0, 5).map(e => ({ e, docs: entregas.documentosDaEntrega(e), quando: entregas.dataHoraDaEntrega(entregas.quandoFoi(e)) + (e.competencia ? ' · ' + entregas.rotuloDaCompetencia(e.competencia) : ''), situacao: entregas.rotuloNoHistorico(e) })),
    total: h.length,
    // ---- as Entregas ----
    grupos: grupos.map(g => ({
      ...g, resumo: g.entregas.length + ' entrega(s)' + (g.total > 0 ? ' · ' + entregas.dinheiro(g.total) : ''),
      linhas: g.entregas.map(e => ({ e, docs: entregas.documentosDaEntrega(e), quando: entregas.dataHoraDaEntrega(entregas.quandoFoi(e)) + (entregas.totalDosItens(e.itens) > 0 ? ' · ' + entregas.dinheiro(entregas.totalDosItens(e.itens)) : ''), situacao: entregas.rotuloNoHistorico(e) })),
    })),
    abrirEntrega(e: Entrega) {
      // a da rota (ou no link) abre a parada; a feita abre o detalhe (a não realizada também, com o motivo)
      if (e.status === 'pendente' || e.status === 'link') janelas.abrir({ tipo: 'parada', entrega: e });
      else janelas.abrir({ tipo: 'entrega', entrega: e, nome: entregas.rotuloDoCliente(cliente), clienteId: cliente.id, voltar: { tipo: 'cliente', clienteId: cliente.id, consulta, aba: 'entregas' } });
    },
    async protocolo(comp: string) {
      const aba2 = abrirAbaDoPapel();
      if (!aba2) { avisar('O navegador bloqueou a nova aba. Permita pop-ups para este site.', 'erro'); return; }
      try {
        const ordenadas = h.filter(e => e.competencia === comp).sort((a, b) => entregas.quandoFoi(a).localeCompare(entregas.quandoFoi(b)));
        const assinaturas = await Promise.all(ordenadas.map(e => (e.status === 'confirmada' && e.temAssinatura ? repo.comprovante(e.id).then(c => c.assinatura || null, () => null) : Promise.resolve(null))));
        const total = ordenadas.reduce((s, e) => s + entregas.totalDosItens(e.itens), 0);
        let conferir: { legivel: string; endereco: string; qr: string } | null = null;
        if (quem) {
          const codigo = repo.registrarProtocolo(entregas.retratoDoProtocolo(cliente, comp, ordenadas, total, nomeQuem || quem.email, quem.uid, new Date().toISOString()));
          const endereco = entregas.linkDoProtocolo(codigo);
          conferir = { legivel: (codigo.match(/.{4}/g) || []).join('-'), endereco: endereco.split('?')[0], qr: await qrDoTexto(endereco, 192).catch(() => '') };
        }
        escreverNaAba(aba2, protocoloDoMes(cliente, comp, ordenadas, assinaturas, conferir, nomeQuem));
        repo.registrarAuditoria('protocolo_emitido', entregas.rotuloDoCliente(cliente) + ' · ' + entregas.rotuloDaCompetencia(comp));
      } catch (err) {
        aba2.close();
        avisar(textoDoErro(err, 'Não foi possível montar o protocolo.'), 'erro');
      }
    },
    async extrato(comp: string) {
      const aba2 = abrirAbaDoPapel('Montando o extrato...');
      if (!aba2) { avisar('O navegador bloqueou a nova aba. Permita pop-ups para este site.', 'erro'); return; }
      try {
        const docs = await repo.documentosDoMes(cliente.id, comp);
        escreverNaAba(aba2, extratoDoMes(cliente, comp, h.filter(e => e.competencia === comp), docs, nomeQuem));
        repo.registrarAuditoria('extrato_mes', entregas.rotuloDoCliente(cliente) + ' · ' + entregas.rotuloDaCompetencia(comp));
      } catch (err) {
        aba2.close();
        avisar(textoDoErro(err, 'Não foi possível montar o extrato.'), 'erro');
      }
    },
    // ---- o Cadastro ----
    cadastro: entregas.dadosComValor([
      ['Código', cliente.codigoOrigem], ['Nome', cliente.nome], ['Nome fantasia', cliente.nomeFantasia],
      [cliente.documento.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ', entregas.documentoFormatado(cliente.documento)],
      ['Inscrição estadual', cliente.inscricaoEstadual], ['Enquadramento', cliente.enquadramento], ['Endereço', cliente.endereco], ['Bairro', cliente.bairro],
      ['Cidade', cliente.cidade], ['CEP', cliente.cep], ['Telefone', cliente.telefone], ['E-mail', entregas.emailsDoCliente(cliente).join(', ')], ['Cliente desde', entregas.dataBr(cliente.criadoEm)],
    ]),
    rota: entregas.dadosComValor([
      ['Região', entregas.rotuloDaZona(cliente.zona)], ['Referência', cliente.pontoReferencia], ['Dias que recebe', entregas.textoDiasDeEntrega(cliente)],
      ['Horário', entregas.textoDaJanela(cliente)], ['Entrega junto com', grupo.join(', ')],
      ['Ponto no mapa', cliente.geo ? (cliente.geo.precisao === 'cidade' ? 'só o centro da cidade' : 'marcado') : 'sem ponto'],
    ]),
    honorario: entregas.dadosComValor([['Forma', cliente.honorarioForma], ['Dia', cliente.honorarioDia]]),
    mostrarLink: !consulta && (!!cliente.portalToken || admin),
    temLink: !!cliente.portalToken,
    abrirLink: () => janelas.abrir({ tipo: 'link', clienteId: cliente.id }),
    // ---- a Receita ----
    mudancas: entregas.mudancasDaReceita(cliente).map(m => ({ ...m, quando: entregas.dataBr(m.em) })),
    podeMarcarVisto: admin,
    receita: r ? entregas.dadosComValor([
      ['Razão social', r.razaoSocial], ['Situação', r.situacao + (r.situacaoDesde ? ' desde ' + entregas.dataBr(r.situacaoDesde) : '') + (r.motivoSituacao && r.situacao !== 'ATIVA' ? ' (' + r.motivoSituacao + ')' : '')],
      ['Natureza jurídica', r.naturezaJuridica], ['Porte', r.porte], ['Regime', entregas.regimeNaReceita(r)], ['Atividade principal', [r.cnae, r.cnaeDescricao].filter(Boolean).join(' · ')],
      ['Abertura', entregas.dataBr(r.abertura)], ['Endereço na Receita', r.endereco], ['Sócios', r.socios.join('\n')],
    ]) : [],
    conferidaEm: r ? entregas.dataBr(r.conferidoEm) : '',
    async marcarVisto() {
      try { await repo.receitaVista(cliente); repo.registrarAuditoria('receita_visto', entregas.rotuloDoCliente(cliente)); } catch (err) { avisar(textoDoErro(err, 'Não foi possível marcar.'), 'erro'); }
    },
    // ---- os Contatos e os Documentos ----
    contatos: cliente.contatos.map(c => ({ ...c, sub: [c.papel, c.telefone].filter(Boolean).join(' · '), whats: !!entregas.numeroDoWhatsApp(c.telefone), tel: 'tel:' + c.telefone.replace(/[^0-9+]/g, '') })),
    papeis: entregas.papeisComPrazo(cliente).map(p => ({ ...p, sub: [entregas.dataBr(p.papel.vence), p.papel.observacao].filter(Boolean).join(' · ') })),
    ocorrencias: entregas.ocorrenciasDoCliente(cliente),
    // ---- as ações ----
    whatsapp(tel?: string) { window.open(entregas.linkDoWhatsApp('Olá! Aqui é da Nilma Contabilidade.', tel || cliente.telefone), '_blank'); },
    corrigirLocal: () => janelas.abrir({ tipo: 'corrigirLocal', clienteId: cliente.id, voltar: { tipo: 'cliente', clienteId: cliente.id, consulta, aba: 'acoes' } }),
    aglutinar: () => janelas.abrir({ tipo: 'aglutinar', clienteId: cliente.id, voltar: { tipo: 'cliente', clienteId: cliente.id, consulta, aba: 'acoes' } }),
    async copiarDados() {
      const texto = entregas.dadosParaCopiar(cliente);
      try { await navigator.clipboard.writeText(texto); avisar('Dados do cliente copiados.'); } catch { janelas.abrir({ tipo: 'copiar', titulo: 'Dados do cliente', texto }); }
    },
    exportarHistorico() {
      const bytes = t.planilhaXlsx('Entregas', entregas.CABECALHO_DA_PLANILHA, entregas.linhasDaPlanilha(h));
      baixarBytes(bytes, 'entregas-' + (cliente.codigoOrigem || cliente.nome).replace(/[^\w-]+/g, '-').toLowerCase() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      avisar('Planilha do cliente baixada.');
    },
    async ativar() {
      const vai = !cliente.ativo;
      try { await repo.ativarCliente(cliente, vai); avisar(vai ? 'Cliente reativado.' : 'Cliente desativado.'); janelas.fechar(); } catch (err) { avisar(textoDoErro(err, 'Não foi possível atualizar.'), 'erro'); }
    },
    async levarDados() {
      try {
        const pacote = await repo.dadosDoCliente(cliente, h);
        baixarArquivo(JSON.stringify(pacote, null, 2), 'dados-' + (cliente.codigoOrigem || cliente.nome).replace(/[^\w-]+/g, '-').toLowerCase() + '.json', 'application/json');
        avisar('Arquivo com os dados do cliente baixado.');
      } catch (err) { avisar(textoDoErro(err, 'Não foi possível juntar os dados.'), 'erro'); }
    },
    async apagarDados() {
      const sim = await retorno.modal({
        icone: 'alert', titulo: 'Apagar os dados pessoais deste cliente?', texto: 'Telefone, e-mail, endereço e contatos saem do cadastro e o link do cliente para de funcionar. Não dá para desfazer.',
        botoes: [{ rotulo: 'Apagar dados', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false }],
      });
      if (!sim) return;
      try { await repo.apagarDadosPessoais(cliente); avisar('Dados pessoais apagados e link derrubado.'); janelas.fechar(); } catch (err) { avisar(textoDoErro(err, 'Não foi possível apagar.'), 'erro'); }
    },
    porId,
  };
}
