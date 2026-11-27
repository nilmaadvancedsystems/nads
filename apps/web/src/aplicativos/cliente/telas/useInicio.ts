// ViewModel da tela inicial da Área do Cliente (Vitor, 16/10/2026; refeita em 13/11 e enxugada em 16/11/2026).
// Refeita de novo em 17/11/2026 ("remove esse boa tarde e esse inicio precisamos montar de maneira mais simples possivel o
// inicio, onde precisamos ter uma tela de guias e documentos la"; escolhida "Guias e documentos juntos", no celular e no
// computador): sem saudação e sem resumo; as guias a pagar (a vencida pede uma nova, as outras baixam), os documentos mais
// recentes (baixar) e o enviar. (17/11/2026: "remove isso") sem a lista da resposta, do certificado e do pedido do
// escritório: ficam no sino. (17/11/2026: "deixa mais bonito", escolhido o "Cartãozinho por guia") cada guia com a
// sigla colorida, o valor e UM botão; tocar na guia abre a prévia; a vencida pede uma nova. As regras ficam em
// dados/inicioSimples.ts.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { bibliotecaDoCliente, detalheCurto, type ItemDaBiblioteca } from '../dados/biblioteca';
import { documentosRecentes, guiasDoInicio } from '../dados/inicioSimples';
import { repoAreaCliente } from '../dados/repo';
import { tituloDaGuiaNova } from '../dados/visaoGeral';
import { useVisualizar } from './useVisualizar';
import type { DaCasca } from './useAreaCliente';

/** quantas guias e quantos documentos a tela inicial mostra; o resto fica no "Ver todas" e no "Ver todos" */
const GUIAS = 5;
const DOCUMENTOS = 3;

export function useInicio({ token, area, hoje, irPara, copiar, marcarGuiaPaga }: DaCasca, abrirEnvio: () => void) {
  const { toast, modal } = useRetorno();
  /** "Já paguei" (26/11/2026): confirma e tira a guia do "A pagar" neste aparelho */
  const jaPaguei = async (id: string, nome: string, valor: string) => {
    if (!marcarGuiaPaga) return;
    const sim = await modal<boolean>({ titulo: 'Já pagou esta guia?', corpo: nome + ' de ' + valor + ' sai da lista de guias a pagar neste aparelho. Se quiser, mande o comprovante pelo Enviar documentos.',
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Já paguei', valor: true, variante: 'btn-primary' }] });
    if (sim) { marcarGuiaPaga(id); toast(nome + ' saiu das guias a pagar.'); }
  };
  const [baixando, setBaixando] = useState('');

  // a pré-visualização da guia (12/11/2026: "quero que a pessoa tenha uma pré-visualização")
  const vista = useVisualizar();
  const verGuia = (id: string) => vista.ver(id, () => repoAreaCliente.baixarGuia(token, id));

  async function baixarGuia(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  /** a guia vencida não passa no banco: o pedido "Pedir um documento" já com o título */
  const pedirGuiaNova = (titulo: string) => irPara('chamados', { novoChamado: { tipo: 'documento', titulo } });

  // ---------- as guias a pagar ----------
  const g = guiasDoInicio(area.guias, hoje, GUIAS);
  const guias = g.itens.map(({ guia, quando, tom }) => {
    const id = guia.id, codigo = area.codigos[id] ?? '', nome = ac.rotuloDaGuia(guia);
    // a vencida pede uma nova (o link embaixo); as outras: baixar (sem o PDF, copiar o código; sem os dois, nada)
    const pedirNova = tom === 'vencida' ? () => pedirGuiaNova(tituloDaGuiaNova(guia)) : null;
    const acao = pedirNova ? null
      : guia.temPdf ? { rotulo: 'Baixar', icone: 'download' as const, fazer: () => void baixarGuia(id) }
      : codigo ? { rotulo: 'Copiar código', icone: 'copiar' as const, fazer: () => copiar(codigo, 'Código') } : null;
    // a sigla do quadradinho e o nome curto do celular ("DAS", não "DAS (Simples Nacional)")
    const curto = guia.tipo === 'outra' ? 'Guia' : guia.tipo;
    return {
      id, nome, curto, tipo: guia.tipo, quando, tom, valor: formatos.reais(guia.valor), acao, pedirNova,
      jaPaguei: marcarGuiaPaga ? () => void jaPaguei(id, nome, formatos.reais(guia.valor)) : null,
      /** tocar na guia abre a prévia (só a que tem o PDF) */
      abrir: guia.temPdf ? () => verGuia(id) : null, abrindo: vista.abrindo === id,
    };
  });

  // ---------- os documentos mais recentes (o do DP, a DANFE, o do escritório; sem as guias e sem o que o cliente mandou) ----------
  const biblioteca = bibliotecaDoCliente({
    guias: area.guias, documentosDp: area.documentosDp, danfes: area.danfes,
    documentos: area.secoes.documentos ? area.documentos : [], envios: area.envios,
  });
  const d = documentosRecentes(biblioteca, DOCUMENTOS);
  function pegar(i: ItemDaBiblioteca): Promise<{ nome: string; arquivo: Blob } | { erro: string } | null> {
    switch (i.origem.tipo) {
      case 'dp': return repoAreaCliente.baixarDocumentoDp(token, i.origem.id);
      case 'danfe': return repoAreaCliente.pedirDanfe(token, i.origem.chave ?? '');
      case 'escritorio': return repoAreaCliente.baixarDocumento(token, i.origem.id);
      default: return Promise.resolve(null);
    }
  }
  async function baixarDocumento(i: ItemDaBiblioteca) {
    setBaixando(i.chave);
    try {
      const r = await pegar(i);
      if (!r) toast('Não achamos este arquivo agora. Fale com o escritório.');
      else if ('erro' in r) toast(r.erro);
      else baixarArquivo(r.nome, r.arquivo);
    } finally { setBaixando(''); }
  }
  const documentos = d.itens.map(i => ({
    chave: i.chave, nome: i.nome, formato: i.formato, novo: i.novo,
    // só a data (ou, sem ela, a pasta): a descrição longa fica na Central de documentos
    detalhe: i.data ? i.data.slice(8, 10) + '/' + i.data.slice(5, 7) : detalheCurto(i).split(' · ')[0] ?? '',
    baixar: () => void baixarDocumento(i),
  }));

  return {
    guias, maisGuias: g.quantas - guias.length,
    // o número grande, estilo saldo de banco (17/11/2026): o total e a linha de baixo ("3 guias · 1 vencida")
    total: formatos.reais(g.total),
    totalSub: g.quantas + (g.quantas === 1 ? ' guia' : ' guias') + (g.vencidas ? ' · ' + g.vencidas + (g.vencidas === 1 ? ' vencida' : ' vencidas') : ''),
    temVencida: g.vencidas > 0,
    documentos, documentosNovos: d.novos,
    enviar: abrirEnvio,
    verGuias: () => irPara('guias'),
    verDocumentos: () => irPara('documentos'),
    vista, baixando,
  };
}
