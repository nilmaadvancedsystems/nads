// ViewModel do Fiscal › Relatório › Enviar guias (03/11/2026: "A parte de gmail tem que funcionar assim como o envios do dp,
// ele sobe o arquivo e envia direto via gmail para o cliente, ao enviar o arquivo ele lê e ja coloca os valores na tabela"),
// no desenho do lote do DP (dp/useLoteDoDp.ts): subir as guias, acompanhar a leitura do robô, revisar (as guias por cliente
// e competência, com a coluna do Relatório e o valor lido; a que o leitor não reconheceu, a pessoa escolhe o cliente, a
// coluna e a competência, ou tira do lote) e disparar. Depois do disparo é o robô que preenche o Relatório (só o que está em
// branco: o valor de cada coluna, a data e o Entregue por e-mail); a tela só mostra o que ele fez.
import { formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useDriveDoEntregas, useGmailDoEntregas, useLoteFiscal, useRepo, useTodosOsCadastros } from '../../../dados/repo';
import { colunaQueVale, MODELO_PADRAO_DAS_GUIAS, valorDaGuia, type EscolhaDaGuia, type GuiaDoLote } from '../../../dados/loteFiscal';
import { CURTO, type RegimeDoRelatorio } from './useRelatorioGeral';

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
  const { toast, modal } = useRetorno();
  const doGrupo = t.grupoDoControle(grupo);
  const todos = repo.lotes();
  const lotes = todos.lista.filter(l => l.grupo === grupo);
  // "Para enviar" (04/11/2026: "Precisa ter uma aba de enviados e uma aba de 'para enviar' para nao misturar"): os lotes que
  // ainda têm o que mandar. O disparado em que todos os clientes receberam sai daqui e fica só em "Enviados".
  const terminado = (l: (typeof lotes)[number]) => l.status === 'disparado' && l.resultados.length > 0 && l.resultados.every(r => r.status === 'enviado');
  const paraEnviar = lotes.filter(l => !terminado(l));
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const atual = (escolhido ? paraEnviar.find(l => l.id === escolhido) : null) || paraEnviar[0] || null;
  const idAtual = atual?.id || '';
  const [arquivos, setArquivos] = useState<{ lote: string; lista: GuiaDoLote[] } | null>(null);
  useEffect(() => {
    if (!idAtual) return;
    return repo.arquivos(idAtual, lista => setArquivos({ lote: idAtual, lista }));
  }, [idAtual, repo]);
  const lista = arquivos && arquivos.lote === idAtual ? arquivos.lista : [];
  const [subindo, setSubindo] = useState<{ feitos: number; total: number } | null>(null);
  const [disparando, setDisparando] = useState(false);

  // os clientes para escolher e para mostrar: o nome da lista do escritório e o e-mail (o do Cadastro do nads, senão o do Entregas)
  const emailsDoEntregas = new Map(gmail.clientes().lista.map(c => [c.codigo, [c.email, ...c.emails].filter(Boolean)]));
  const clientes = tarefas.listarEmpresas().filter(e => e.codigo != null).map(e => ({
    codigo: e.codigo as number, nome: e.nome,
    email: (cadastros.porId.get(formatos.slug(e.nome))?.contato?.email || '').trim().toLowerCase() || (emailsDoEntregas.get(String(e.codigo)) || [])[0] || (repo.exemplos ? 'financeiro@exemplo.com.br' : ''),
  })).sort((a, b) => a.codigo - b.codigo);
  const doCodigo = new Map(clientes.map(c => [c.codigo, c]));

  // a revisão: as lidas por cliente e competência; as que faltam escolher; as tiradas; as que deram erro
  const porChave = new Map<string, { codigo: number; competencia: string; arquivos: GuiaDoLote[] }>();
  const faltam: GuiaDoLote[] = [];
  const tirados: GuiaDoLote[] = [];
  const comErro: GuiaDoLote[] = [];
  for (const a of lista) {
    if (a.status === 'erro') { comErro.push(a); continue; }
    if (a.status !== 'lido') continue;
    if (a.fora) { tirados.push(a); continue; }
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
  const grupos = [...porChave.entries()].map(([chave, g]) => ({
    chave, ...g, nome: doCodigo.get(g.codigo)?.nome || '', email: doCodigo.get(g.codigo)?.email || '', resultado: resultadoDe.get(chave) || null,
  })).sort((a, b) => a.codigo - b.codigo || a.competencia.localeCompare(b.competencia));

  // "Enviados": o registro de cada e-mail (fica; o lote some do banco em 3 dias), na competência da apuração escolhida
  const [competenciaEnviados, setCompetenciaEnviados] = useState(competenciaDaTela);
  const doMes = repo.enviados(competenciaEnviados);
  const enviados = doMes.lista.filter(x => x.grupo === grupo);
  const rotuloDaColuna = (c: string) => CURTO[c] || doGrupo.colunas.find(x => x.id === c)?.rotulo || c;

  // o modelo do e-mail e a prévia com um cliente do lote
  const modelo = repo.modelo();
  const exemplo = grupos[0];
  const comp = exemplo?.competencia || competenciaDaTela;
  const campos: Record<string, string> = { cliente: exemplo?.nome || 'EMPRESA EXEMPLO LTDA', competencia: comp.slice(5) + '/' + comp.slice(0, 4), mes: t.rotuloCompetencia(comp).toLowerCase().replace('/', ' de ') };
  const encher = (m: string) => m.replace(/\{(\w+)\}/g, (tudo, nome: string) => campos[nome] ?? tudo);

  return {
    exemplos: repo.exemplos,
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
    noRelatorio(a: GuiaDoLote): { coluna: string; valor: string } {
      const c = colunaQueVale(a, grupo);
      const v = valorDaGuia(a.leitura?.valor);
      return { coluna: c ? rotuloDaColuna(c) : '', valor: v != null ? t.valorDoControle(v.toFixed(2).replace('.', ',')) : '' };
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
    /** "Enviados": a guia gravada no Drive do cliente, pelo robô (uma cópia de 30 minutos; o PDF não fica no banco) */
    abrirEnviada(g: { nome: string; id: string }) {
      abrirNaAba(g.nome, () => new Promise<string>((resolver, recusar) => {
        const prazo = setTimeout(() => { parar(); recusar(new Error('o robô não respondeu a tempo')); }, PRAZO_DO_DRIVE_MS);
        const parar = drive.pedir({ modo: 'abrir', fileId: g.id, nome: g.nome }, x => {
          if (x.status === 'pronto' && x.url) { clearTimeout(prazo); parar(); resolver(x.url); }
          else if (x.status === 'erro') { clearTimeout(prazo); parar(); recusar(new Error(x.erro || 'erro do robô')); }
        });
      }), m => toast('Não consegui abrir a guia: ' + m));
    },
    /** quantos clientes vão no disparo (os ainda não enviados) */
    paraDisparar: grupos.filter(g => g.resultado?.status !== 'enviado').length,
    /** sobe as guias escolhidas e entrega o lote ao robô */
    async subir(escolhidas: FileList | File[]) {
      const lista = Array.from(escolhidas);
      if (!lista.length || subindo) return;
      if (lista.length > MAX_ARQUIVOS) { toast('No máximo ' + MAX_ARQUIVOS + ' guias por lote.'); return; }
      const grande = lista.find(f => f.size > MAX_BYTES);
      if (grande) { toast(grande.name + ' passa de 25 MB.'); return; }
      setSubindo({ feitos: 0, total: lista.length });
      try {
        const lidos = await Promise.all(lista.map(async f => ({ nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
        const id = await repo.subir(grupo, lidos, (feitos, total) => setSubindo({ feitos, total }));
        setEscolhido(id);
        toast(lista.length + (lista.length === 1 ? ' guia enviada' : ' guias enviadas') + ' ao robô para ler.');
      } catch (e) { toast('Não consegui subir: ' + (e instanceof Error ? e.message : String(e))); } finally { setSubindo(null); }
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
    async disparar() {
      if (!atual || disparando) return;
      const n = grupos.filter(g => g.resultado?.status !== 'enviado').length;
      if (!n) return;
      const semEmail = grupos.filter(g => g.resultado?.status !== 'enviado' && !g.email).length;
      const ok = await modal({
        icone: 'envelope', titulo: 'Disparar para ' + n + (n === 1 ? ' cliente?' : ' clientes?'),
        texto: 'Cada cliente recebe as guias dele no e-mail do cadastro; depois o robô grava cada guia na pasta do cliente no Drive e preenche o ' + doGrupo.rotulo +
          ' no Relatório: o valor de cada coluna, a data e o Entregue por e-mail, só onde está em branco.' +
          (semEmail ? ' ' + semEmail + (semEmail === 1 ? ' cliente está' : ' clientes estão') + ' sem e-mail e vai dar erro.' : '') +
          (faltam.length ? ' ' + faltam.length + (faltam.length === 1 ? ' guia sem cliente fica' : ' guias sem cliente ficam') + ' de fora.' : ''),
        botoes: [{ rotulo: 'Disparar', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
      });
      if (!ok) return;
      setDisparando(true);
      try { await repo.disparar(atual.id); } catch (e) { toast('Não consegui disparar: ' + (e instanceof Error ? e.message : String(e))); } finally { setDisparando(false); }
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
