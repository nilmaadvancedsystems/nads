// Ações: tudo que a pessoa faz na Conferência e muda a empresa.
// No original cada ação mudava emp() no lugar, em ~40 lugares, e chamava save()
// (que regravava o documento inteiro). Aqui cada ação é uma função pura:
// recebe a empresa, devolve a empresa nova. Quem guarda é o repositório.
import { nomeNorm } from '../formatos';
import { SV } from './tabelas/servicos';
import type { Conta, Empresa, EstadoVerificacao, FiltroMovimento, Nota, NotaServico, RegistroImportacao, TipoNotaFiscal, TipoServico } from './tipos';
import { registrarHist, registrarMarcaChecklist } from './regras/auditoria';
import { verifChave } from './regras/conciliacao';
import { contasDaNatureza, empresaNuncaAberta } from './regras/empresa';
import { assinaturaBalancete, type ModoImportacao } from './regras/importacao';
import { catFixa } from './regras/servicos';
import type { TipoVista } from './regras/vendaVista';

type Periodo = Pick<FiltroMovimento, 'dataDe' | 'dataAte' | 'meses'>;

function produzir(e: Empresa, fn: (x: Empresa) => void): Empresa {
  const x = structuredClone(e);
  fn(x);
  return x;
}

const ROTULO_TIPO: Record<TipoNotaFiscal, string> = { entradas: 'Entradas', saidas: 'Saídas' };

// ---------- entrar / sair ----------
/** Primeira abertura: fica marcada a pergunta do "Apagar ao sair". */
export function aoEntrar(e: Empresa): Empresa {
  return empresaNuncaAberta(e) ? produzir(e, x => { x.avisoBalPendente = true; }) : e;
}

/** Ao sair, com "Apagar ao sair" ligado, o balancete é descartado (o resto fica). */
export function aoSair(e: Empresa, agora: Date): Empresa {
  if (!e.contas.length || e.autoLimparBalancete === false) return e;
  return produzir(e, x => {
    x.importHistorico.push({ ts: agora.toISOString(), tipo: 'Balancete', qtd: x.contas.length, acao: 'excluido', auto: true });
    x.contas = [];
  });
}

export function definirPrestaServico(e: Empresa, sim: boolean): Empresa {
  return produzir(e, x => { x.prestaServico = sim; });
}

export function definirAutoLimpar(e: Empresa, ligado: boolean): Empresa {
  return produzir(e, x => { x.autoLimparBalancete = ligado; x.avisoBalPendente = false; });
}

// ---------- importação ----------
export function importarBalancete(e: Empresa, lista: Conta[], agora: Date, aviso?: string): Empresa {
  return produzir(e, x => {
    x.contas = lista;
    for (const l of x.dp) {
      if (!l.travado) continue;
      const a = lista.find(c => c.codigo === l.conta);
      if (a) { l.nome = a.nome; l.dc = a.dc; }
    }
    // impressão digital do plano: fica guardada (não some ao sair) pra comparar com o próximo
    x.balanceteAssinatura = assinaturaBalancete(lista);
    x.balanceteAssinaturaTs = agora.toISOString();
    const reg: RegistroImportacao = { ts: agora.toISOString(), tipo: 'Balancete', qtd: lista.length, acao: 'importado' };
    if (aviso !== undefined) { reg.forcado = true; reg.aviso = aviso; }
    x.importHistorico.push(reg);
  });
}

export function apagarBalancete(e: Empresa, agora: Date): Empresa {
  return produzir(e, x => {
    x.importHistorico.push({ ts: agora.toISOString(), tipo: 'Balancete', qtd: x.contas.length, acao: 'excluido' });
    x.contas = [];
  });
}

export function importarNotas(e: Empresa, tipo: TipoNotaFiscal, notas: Nota[], adicionadas: number, modo: ModoImportacao, agora: Date): Empresa {
  return produzir(e, x => {
    const reg: RegistroImportacao = { ts: agora.toISOString(), tipo: ROTULO_TIPO[tipo], qtd: adicionadas, acao: 'importado' };
    if (modo === 'sobrepor') { reg.modo = 'sobreposto'; reg.substituidas = x[tipo].length; }
    x[tipo] = notas;
    x.importHistorico.push(reg);
  });
}

export function apagarNotas(e: Empresa, tipo: TipoNotaFiscal, agora: Date): Empresa {
  return produzir(e, x => {
    x.importHistorico.push({ ts: agora.toISOString(), tipo: ROTULO_TIPO[tipo], qtd: x[tipo].length, acao: 'excluido' });
    x[tipo] = [];
  });
}

export function importarServicos(e: Empresa, tipo: TipoServico, notas: NotaServico[], adicionadas: number, modo: ModoImportacao, agora: Date): Empresa {
  const campo = SV[tipo].campo;
  return produzir(e, x => {
    const reg: RegistroImportacao = { ts: agora.toISOString(), tipo: SV[tipo].rotulo, qtd: adicionadas, acao: 'importado' };
    if (modo === 'sobrepor') { reg.modo = 'sobreposto'; reg.substituidas = x[campo].length; }
    x[campo] = notas;
    x.importHistorico.push(reg);
  });
}

export function apagarServicos(e: Empresa, tipo: TipoServico, agora: Date): Empresa {
  const campo = SV[tipo].campo;
  return produzir(e, x => {
    x.importHistorico.push({ ts: agora.toISOString(), tipo: SV[tipo].rotulo, qtd: x[campo].length, acao: 'excluido' });
    x[campo] = [];
  });
}

// ---------- cadastro: naturezas × contas ----------
export function vincularConta(e: Empresa, k: string, codigo: string): Empresa {
  return produzir(e, x => {
    const atuais = contasDaNatureza(x, k).slice();
    if (atuais.indexOf(codigo) < 0) atuais.push(codigo);
    x.naturezaConta[k] = atuais;
    delete x.naoContabil[k];
  });
}

export function desvincularConta(e: Empresa, k: string, codigo: string): Empresa {
  return produzir(e, x => {
    const atuais = contasDaNatureza(x, k).filter(c => c !== codigo);
    if (atuais.length) x.naturezaConta[k] = atuais; else delete x.naturezaConta[k];
  });
}

export function marcarNaoContabil(e: Empresa, k: string, marcar: boolean): Empresa {
  return produzir(e, x => { if (marcar) x.naoContabil[k] = true; else delete x.naoContabil[k]; });
}

export function alternarVendaVista(e: Empresa): Empresa {
  return produzir(e, x => { x.vendaVista.ativo = !x.vendaVista.ativo; });
}

/** Grava (ou remove, com valor vazio) o lançamento à vista/a prazo de um CFOP de venda. */
export function gravarLancVista(e: Empresa, k: string, t: TipoVista, valor: string): { empresa: Empresa; mudou: boolean; mensagem: string } {
  const novo = String(valor || '').replace(/\D/g, '');
  const rot = t === 'prazo' ? 'Lançamento a prazo' : 'Lançamento à vista';
  const atual = ((t === 'prazo' ? e.vendaVista.prazo : e.vendaVista.lancs) || {})[k] || '';
  if (novo === atual) return { empresa: e, mudou: false, mensagem: '' };
  const empresa = produzir(e, x => {
    const v = x.vendaVista;
    if (!v.prazo) v.prazo = {};
    const l = t === 'prazo' ? v.prazo : v.lancs;
    if (novo) l[k] = novo; else delete l[k];
  });
  return { empresa, mudou: true, mensagem: novo ? rot + ': ' + novo + '.' : rot + ' removido.' };
}

// ---------- cadastro: serviços ----------
export function colocarNaCategoria(e: Empresa, t: TipoServico, cat: string, nome: string): Empresa {
  if (catFixa(t, nome)) return e; // Honorário é permanente
  return produzir(e, x => {
    const m = (x.servCat[t] = x.servCat[t] || {});
    m[nomeNorm(nome)] = { cat, nome };
  });
}

export function tirarDaCategoria(e: Empresa, t: TipoServico, nome: string): Empresa {
  return produzir(e, x => { const m = x.servCat[t]; if (m) delete m[nomeNorm(nome)]; });
}

// ---------- lançamentos automáticos ----------
export function gravarDp(e: Empresa, lanc: string, codigo: string): Empresa {
  return produzir(e, x => {
    const ex = x.dp.find(l => l.lanc === lanc);
    if (!codigo) { if (ex) x.dp = x.dp.filter(l => l.lanc !== lanc); return; }
    const conta = x.contas.find(c => c.codigo === codigo);
    if (ex) { ex.conta = codigo; ex.nome = conta ? conta.nome : ''; ex.dc = conta ? conta.dc : 'D'; }
    else x.dp.push({ lanc, conta: codigo, nome: conta ? conta.nome : '', dc: conta ? conta.dc : 'D', travado: true });
  });
}

export function aplicarSugestoesDp(e: Empresa, sugestoes: { lanc: string; conta: Conta }[]): Empresa {
  return produzir(e, x => { for (const s of sugestoes) x.dp.push({ lanc: s.lanc, conta: s.conta.codigo, nome: s.conta.nome, dc: s.conta.dc, travado: true }); });
}

// ---------- movimento: marcas ----------
/** Nota fora do padrão (ou o grupo) marcada como corrigida. chaves = "tipo|chave da nota". */
export function marcarCorrigido(e: Empresa, chaves: string[], marcado: boolean, chaveHist: string, texto: string, agora: Date): Empresa {
  return produzir(e, x => {
    for (const key of chaves) {
      const pos = x.divResolvidos.indexOf(key);
      if (marcado) { if (pos < 0) x.divResolvidos.push(key); } else if (pos >= 0) x.divResolvidos.splice(pos, 1);
    }
    x.confHistorico = registrarHist(x.confHistorico, chaveHist, texto, marcado, agora, 'divergencia');
  });
}

/** Checklist: marcar/desmarcar à mão. Desmarcar impede a marcação automática de voltar. */
export function marcarNatureza(e: Empresa, marca: string, marcado: boolean, texto: string, agora: Date): Empresa {
  return produzir(e, x => {
    const pos = x.confMarcados.indexOf(marca);
    if (marcado) { if (pos < 0) x.confMarcados.push(marca); } else if (pos >= 0) x.confMarcados.splice(pos, 1);
    if (!marcado && x.confAutoRecusados.indexOf(marca) < 0) x.confAutoRecusados.push(marca);
    x.confHistorico = registrarMarcaChecklist(x.confHistorico, marca, texto, marcado, agora);
  });
}

/** Marca sozinho as naturezas que bateram com o balancete. */
export function marcarAutomaticos(e: Empresa, itens: { chave: string; texto: string }[], agora: Date): Empresa {
  if (!itens.length) return e;
  return produzir(e, x => {
    for (const it of itens) {
      if (x.confMarcados.indexOf(it.chave) > -1 || x.confAutoRecusados.indexOf(it.chave) > -1) continue;
      x.confMarcados.push(it.chave);
      x.confAutoMarcados.push(it.chave);
      x.confHistorico.push({ ts: agora.toISOString(), chave: it.chave, texto: it.texto, acao: 'marcado', origem: 'automatico' });
    }
  });
}

/** Auditoria › Remover: tira a marcação automática e ela não volta sozinha. */
export function removerMarcaAutomatica(e: Empresa, chave: string, texto: string, agora: Date): Empresa {
  return produzir(e, x => {
    let p = x.confMarcados.indexOf(chave); if (p > -1) x.confMarcados.splice(p, 1);
    p = x.confAutoMarcados.indexOf(chave); if (p > -1) x.confAutoMarcados.splice(p, 1);
    if (x.confAutoRecusados.indexOf(chave) < 0) x.confAutoRecusados.push(chave);
    x.confHistorico.push({ ts: agora.toISOString(), chave, texto, acao: 'desmarcado', origem: 'manual' });
  });
}

/** Resultado do Verificar por conta (Ok / Conferido / desfeito), por período. */
export function gravarVerificacao(e: Empresa, p: Periodo, conta: string, estado: EstadoVerificacao | null, texto: string, agora: Date): Empresa {
  const ch = verifChave(p, conta);
  const antes = (e.verifConta || {})[ch] || null;
  if (antes === estado) return e;
  return produzir(e, x => {
    if (estado) x.verifConta[ch] = estado; else delete x.verifConta[ch];
    x.confHistorico = registrarHist(x.confHistorico, 'verif|' + ch, texto, !!estado, agora, 'verificacao');
  });
}
