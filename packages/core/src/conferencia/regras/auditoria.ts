// Auditoria (histórico único, mais novo primeiro) e o registro no histórico.
// Origem: conferencia.html renderAuditoria (~L3623), registrarHist (~L3656),
// RE_PREFIXO_PERIODO (~L3622).
import type { Empresa, RegistroConferencia } from '../tipos';

const RE_PREFIXO_PERIODO = /^(início a fim|início a \d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2}\/\d{4} a fim|\d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}) — /;

export interface LinhaAuditoria {
  ts: string;
  tipo: string;
  acao: string;
  tom: 'ok' | 'bad' | 'neutral';
  detalhe: string;
  origem: 'Manual' | 'Automático';
  /** marcação automática que ainda dá pra remover */
  remover?: { chave: string; texto: string };
}

export function linhasAuditoria(e: Empresa): LinhaAuditoria[] {
  const linhas: LinhaAuditoria[] = [];
  for (const h of e.importHistorico) {
    const excluido = h.acao === 'excluido';
    linhas.push({
      ts: h.ts, tipo: 'Importação',
      acao: excluido ? (h.auto ? 'Excluído ao sair' : 'Excluído') : h.forcado ? 'Importado com aviso' : h.modo === 'sobreposto' ? 'Sobreposto' : 'Importado',
      tom: excluido || h.forcado ? 'bad' : 'ok',
      detalhe: h.tipo + ' · ' + h.qtd + ' ' + (h.tipo === 'Balancete' ? 'conta(s)' : 'nota(s)') +
        (h.modo === 'sobreposto' ? ' · substituiu ' + h.substituidas + ' nota(s)' : '') + (h.aviso ? ' — ' + h.aviso : ''),
      origem: h.auto ? 'Automático' : 'Manual',
    });
  }
  for (const h of e.confHistorico) {
    const div = h.categoria === 'divergencia';
    const ver = h.categoria === 'verificacao';
    const marc = h.acao === 'marcado';
    const texto = (h.texto || '').replace(RE_PREFIXO_PERIODO, '');
    const podeRemover = marc && h.origem === 'automatico' && e.confAutoMarcados.indexOf(h.chave) > -1;
    linhas.push({
      ts: h.ts,
      tipo: ver ? 'Verificar por conta' : div ? 'Lançamento fora do padrão' : 'Conferência',
      acao: ver ? (marc ? (/sem pendências/.test(h.texto || '') ? 'Ok' : 'Conferido') : 'Desfeito') : div ? (marc ? 'Corrigido' : 'Reaberto') : marc ? 'Marcado' : 'Desmarcado',
      tom: marc ? 'ok' : 'neutral',
      detalhe: texto,
      origem: h.origem === 'automatico' ? 'Automático' : 'Manual',
      remover: podeRemover ? { chave: h.chave, texto } : undefined,
    });
  }
  return linhas.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}

function mesmoMinuto(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();
}

/**
 * Registra no histórico. Desfazer a mesma coisa no mesmo minuto (marcou sem querer e
 * corrigiu na hora) apaga o registro anterior em vez de guardar os dois.
 * Devolve o histórico novo (não muda o de entrada).
 */
export function registrarHist(hist: RegistroConferencia[], chave: string, texto: string, marcado: boolean, agora: Date, categoria?: RegistroConferencia['categoria']): RegistroConferencia[] {
  let idx = -1;
  for (let i = hist.length - 1; i >= 0; i--) if (hist[i].chave === chave) { idx = i; break; }
  if (idx >= 0 && hist[idx].origem === 'manual' && hist[idx].acao === (marcado ? 'desmarcado' : 'marcado') && mesmoMinuto(new Date(hist[idx].ts), agora)) {
    return hist.slice(0, idx).concat(hist.slice(idx + 1));
  }
  const reg: RegistroConferencia = { ts: agora.toISOString(), chave, texto, acao: marcado ? 'marcado' : 'desmarcado', origem: 'manual' };
  if (categoria) reg.categoria = categoria;
  return hist.concat(reg);
}

/**
 * Checklist: marcar/desmarcar à mão. Desmarcar o que acabou de marcar no mesmo minuto
 * some com o registro (só nesse sentido, como no original).
 */
export function registrarMarcaChecklist(hist: RegistroConferencia[], chave: string, texto: string, marcado: boolean, agora: Date): RegistroConferencia[] {
  let idx = -1;
  for (let i = hist.length - 1; i >= 0; i--) if (hist[i].chave === chave) { idx = i; break; }
  if (!marcado && idx >= 0 && hist[idx].acao === 'marcado' && mesmoMinuto(new Date(hist[idx].ts), agora)) {
    return hist.slice(0, idx).concat(hist.slice(idx + 1));
  }
  return hist.concat({ ts: agora.toISOString(), chave, texto, acao: marcado ? 'marcado' : 'desmarcado', origem: 'manual' });
}
