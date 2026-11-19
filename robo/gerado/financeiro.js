// GERADO — NÃO EDITE. Feito por scripts/robo-financeiro.mjs a partir de packages/core/src/financeiro/{extratoPelaApi,boletoEfi,banco}.ts
// e do slug de packages/core/src/formatos. Mudou alguma dessas fontes? Rode `node scripts/robo-financeiro.mjs` e commite este
// arquivo junto.
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region packages/core/src/financeiro/banco.ts
const emReais = (centavos) => Math.round(Math.abs(centavos)) / 100;
function hash(s) {
	let h = 5381, g = 52711;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		h = h * 33 ^ c;
		g = g * 31 ^ c;
	}
	return (h >>> 0).toString(36) + (g >>> 0).toString(36);
}
const chaveDoBanco = (banco) => banco.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "banco";
function linhasDoExtrato(lidas, banco, importacao, contaBancaria) {
	const vistos = /* @__PURE__ */ new Map();
	const nome = banco.trim() || "Banco";
	const daConta = contaBancaria?.trim() || "";
	const out = [];
	for (const l of lidas) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(l.data) || !Math.round(l.valor)) continue;
		const historico = l.historico.replace(/\s+/g, " ").trim();
		const resto = l.data + "|" + Math.round(l.valor) + "|" + historico.toUpperCase();
		const n = (vistos.get(resto) || 0) + 1;
		vistos.set(resto, n);
		const antigo = "b_" + hash(chaveDoBanco(nome) + "|" + resto + "|" + n);
		out.push({
			id: daConta ? "b_" + hash("conta:" + daConta + "|" + resto + "|" + n) : antigo,
			data: l.data,
			historico,
			valor: emReais(l.valor),
			tipo: l.valor < 0 ? "S" : "E",
			banco: nome,
			importacao,
			...daConta ? {
				contaBancaria: daConta,
				idAntigo: antigo
			} : {}
		});
	}
	return out;
}
function resumoDoExtrato(linhas) {
	const datas = linhas.map((l) => l.data).sort();
	const soma = (t) => Math.round(linhas.filter((l) => l.tipo === t).reduce((s, l) => s + Math.round(l.valor * 100), 0)) / 100;
	return {
		de: datas[0] || "",
		ate: datas.at(-1) || "",
		quantos: linhas.length,
		entradas: soma("E"),
		saidas: soma("S")
	};
}
const EMPRESA_DO_ESCRITORIO = {
	codigo: 284,
	nome: "NILMA CONTABILIDADE LTDA"
};
function contaDoPlanoParaOBanco(plano, descricao) {
	const igual = plano.find((c) => c.descricao.trim().toLowerCase() === descricao.trim().toLowerCase());
	if (igual) return {
		existe: true,
		id: igual.id,
		codigo: igual.codigo
	};
	const grupo = plano.find((c) => c.codigo === "1.1");
	const filhos = plano.filter((c) => /^1\.1\.\d+$/.test(c.codigo)).map((c) => Number(c.codigo.split(".")[2]));
	return {
		existe: false,
		codigo: "1.1." + String((filhos.length ? Math.max(...filhos) : 0) + 1).padStart(2, "0"),
		descricao,
		pai: grupo?.id ?? null,
		nivel: 3
	};
}
function descricaoDaContaBancaria(c) {
	return [
		c.nome,
		c.conta ? "C/C " + c.conta : "",
		c.apelido ? "(" + c.apelido + ")" : ""
	].filter(Boolean).join(" ");
}

//#endregion
//#region packages/core/src/financeiro/extratoPelaApi.ts
const NOME_DO_BANCO_PELA_API = {
	sicoob: "Sicoob",
	efi: "Efí"
};
function dataIso(v) {
	const s = String(v ?? "").trim();
	let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (m) return m[1] + "-" + m[2] + "-" + m[3];
	m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
	return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
}
function centavos(v) {
	if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : void 0;
	let s = String(v ?? "").trim().replace(/\s|R\$/g, "");
	if (!s) return void 0;
	if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
	const n = Number(s);
	return Number.isFinite(n) ? Math.round(n * 100) : void 0;
}
const texto = (v) => (typeof v === "string" || typeof v === "number" ? String(v) : "").replace(/\s+/g, " ").trim();
function lidasDoSicoob(resposta) {
	const r = resposta && typeof resposta === "object" ? resposta : {};
	const raiz = r.resultado && typeof r.resultado === "object" ? r.resultado : r;
	const transacoes = Array.isArray(raiz.transacoes) ? raiz.transacoes : [];
	const lidas = [];
	for (const t of transacoes) {
		if (!t || typeof t !== "object") continue;
		const data = dataIso(t.data ?? t.dataLancamento ?? t.dataTransacao);
		const bruto = centavos(t.valor);
		if (!data || bruto == null || !bruto) continue;
		const tipo = texto(t.tipo).toUpperCase();
		const valor = /^D/.test(tipo) ? -Math.abs(bruto) : /^C/.test(tipo) ? Math.abs(bruto) : bruto;
		const historico = [texto(t.descricao ?? t.historico), texto(t.descInfComplementar ?? t.complemento)].filter(Boolean).join(" - ");
		if (/^SALDO\b/i.test(historico)) continue;
		lidas.push({
			data,
			valor,
			historico
		});
	}
	const saldoAnterior = centavos(raiz.saldoAnterior);
	const saldoAtual = centavos(raiz.saldoAtual);
	return {
		lidas,
		...saldoAnterior != null ? { saldoAnterior } : {},
		...saldoAtual != null ? { saldoAtual } : {}
	};
}
const dataDoCnab = (s) => /^\d{8}$/.test(s) && s !== "00000000" ? s.slice(4, 8) + "-" + s.slice(2, 4) + "-" + s.slice(0, 2) : "";
function saldoDoCnab(l) {
	const data = dataDoCnab(l.slice(142, 150));
	const n = l.slice(150, 168);
	if (!data || !/^\d{18}$/.test(n)) return void 0;
	const v = Number(n);
	return {
		valor: l[168] === "D" ? -v : v,
		data
	};
}
function lotesDoCnab240(arquivo) {
	const lotes = [];
	let atual = null;
	for (const bruta of arquivo.split(/\r?\n/)) {
		if (bruta.length < 14) continue;
		const l = bruta.padEnd(240, " ");
		const registro = l[7];
		if (registro === "1") {
			atual = {
				agencia: l.slice(52, 57).replace(/^0+/, ""),
				conta: l.slice(58, 70).replace(/^0+/, "") + (l[70].trim() ? "-" + l[70] : ""),
				lidas: []
			};
			const s = saldoDoCnab(l);
			if (s) atual.saldoInicial = s;
			lotes.push(atual);
		} else if (registro === "3" && l[13] === "E" && atual) {
			const data = dataDoCnab(l.slice(142, 150));
			const n = l.slice(150, 168);
			if (!data || !/^\d{18}$/.test(n) || !Number(n)) continue;
			const historico = [texto(l.slice(176, 201)), texto(l.slice(113, 133))].filter(Boolean).join(" - ");
			atual.lidas.push({
				data,
				valor: l[168] === "D" ? -Number(n) : Number(n),
				historico
			});
		} else if (registro === "5" && atual) {
			const s = saldoDoCnab(l);
			if (s) atual.saldoFinal = s;
			atual = null;
		}
	}
	return lotes;
}
function nucleo(conta) {
	const d = conta.replace(/\D+/g, "");
	return (/[-.\s][0-9xX]$/.test(conta.trim()) && d.length > 1 ? d.slice(0, -1) : d).replace(/^0+/, "");
}
function loteDaConta(lotes, conta) {
	if (conta) {
		const alvo = nucleo(conta), inteiro = conta.replace(/\D+/g, "").replace(/^0+/, "");
		const achado = lotes.find((l) => {
			const d = l.conta.replace(/\D+/g, "").replace(/^0+/, "");
			return d === inteiro || d === alvo || nucleo(l.conta) === alvo;
		});
		if (achado) return achado;
	}
	return lotes.length === 1 ? lotes[0] : null;
}
function juntarArquivosDoExtrato(arquivos) {
	const ordem = [...arquivos].sort((a, b) => b.geradoEm.localeCompare(a.geradoEm));
	const donoDoDia = /* @__PURE__ */ new Map();
	for (const a of ordem) for (const l of a.lote.lidas) if (!donoDoDia.has(l.data)) donoDoDia.set(l.data, a.lote);
	const lidas = [];
	for (const a of [...ordem].reverse()) for (const l of a.lote.lidas) if (donoDoDia.get(l.data) === a.lote) lidas.push(l);
	lidas.sort((a, b) => a.data.localeCompare(b.data));
	let saldo;
	for (const a of ordem) if (a.lote.saldoFinal && (!saldo || a.lote.saldoFinal.data > saldo.data)) saldo = a.lote.saldoFinal;
	return {
		lidas,
		...saldo ? { saldo } : {}
	};
}
function mesesParaBuscar(hoje, diasDoMesAnterior = 5) {
	const mes = hoje.slice(0, 7);
	if (Number(hoje.slice(8, 10)) > diasDoMesAnterior) return [mes];
	const [a, m] = mes.split("-").map(Number);
	return [m === 1 ? a - 1 + "-12" : a + "-" + String(m - 1).padStart(2, "0"), mes];
}
function ultimoDiaDoMes(mes) {
	const [a, m] = mes.split("-").map(Number);
	return mes + "-" + String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0");
}
const idDaImportacaoPelaApi = (contaBancaria, mes) => "api_" + contaBancaria + "_" + mes;
const ehImportacaoPelaApi = (id) => id.startsWith("api_");
function ultimoDiaManual(importacoes, contaBancaria) {
	let ultimo = null;
	for (const i of importacoes) if (i.contaBancaria === contaBancaria && !ehImportacaoPelaApi(i.id) && i.ate && (!ultimo || i.ate > ultimo)) ultimo = i.ate;
	return ultimo;
}
function emendarComOManual(lidas, ultimoDia, manuaisDoDia) {
	if (!ultimoDia) return [...lidas];
	const sobra = /* @__PURE__ */ new Map();
	for (const m of manuaisDoDia) {
		const k = (m.tipo === "S" ? -1 : 1) * Math.round(m.valor * 100) + "";
		sobra.set(k, (sobra.get(k) || 0) + 1);
	}
	const out = [];
	for (const l of lidas) {
		if (l.data < ultimoDia) continue;
		if (l.data === ultimoDia) {
			const k = Math.round(l.valor) + "";
			const n = sobra.get(k) || 0;
			if (n) {
				sobra.set(k, n - 1);
				continue;
			}
		}
		out.push(l);
	}
	return out;
}
const rotuloDaContaBancaria = (c) => [
	c.apelido,
	c.agencia ? "Ag. " + c.agencia : "",
	c.conta ? "C/C " + c.conta : ""
].filter(Boolean).join(" · ");
function importacoesPelaApi(p) {
	const nome = NOME_DO_BANCO_PELA_API[p.banco];
	const porMes = /* @__PURE__ */ new Map();
	for (const l of p.lidas) porMes.set(l.data.slice(0, 7), [...porMes.get(l.data.slice(0, 7)) ?? [], l]);
	const saldo = p.saldo && (!p.ultimoDiaManual || p.saldo.data >= p.ultimoDiaManual) ? p.saldo : void 0;
	if (saldo && !porMes.has(saldo.data.slice(0, 7))) porMes.set(saldo.data.slice(0, 7), []);
	const out = [];
	for (const mes of [...porMes.keys()].sort()) {
		const id = idDaImportacaoPelaApi(p.conta.id, mes);
		const linhas = linhasDoExtrato(porMes.get(mes), nome, id, p.conta.id).map((l) => ({
			...l,
			...p.contaDoPlano ? { conta: p.contaDoPlano } : {}
		}));
		const datas = linhas.map((l) => l.data).sort();
		const fim = p.hoje.slice(0, 7) === mes ? p.hoje : ultimoDiaDoMes(mes);
		const doSaldo = saldo && saldo.data.slice(0, 7) === mes ? saldo : void 0;
		const ate = [
			datas.at(-1) ?? "",
			doSaldo?.data ?? "",
			fim
		].sort().at(-1);
		out.push({
			importacao: {
				id,
				banco: nome,
				marca: p.conta.marca,
				contaBancaria: p.conta.id,
				...p.contaDoPlano ? { conta: p.contaDoPlano } : {},
				rotuloDaConta: rotuloDaContaBancaria(p.conta),
				arquivo: "API do " + nome + " · " + mes.slice(5) + "/" + mes.slice(0, 4),
				de: datas[0] ?? mes + "-01",
				ate,
				...doSaldo ? { saldoFinal: Math.round(doSaldo.valor) / 100 } : {}
			},
			linhas
		});
	}
	return out;
}
function fecharImportacao(imp, jaGravadas) {
	const porId = new Map(jaGravadas.map((g) => [g.id, g.importacao]));
	const novas = imp.linhas.filter((l) => !porId.has(l.id));
	const dela = imp.linhas.filter((l) => !porId.has(l.id) || porId.get(l.id) === imp.importacao.id);
	const { quantos, entradas, saidas } = resumoDoExtrato(dela);
	return {
		novas,
		resumo: {
			quantos,
			entradas,
			saidas
		}
	};
}

//#endregion
//#region packages/core/src/formatos/index.ts
const DUAS_CASAS = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});
function slug(nome) {
	return String(nome).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "") || "empresa";
}
const DIA_EM_BRASILIA = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
	year: "numeric",
	month: "2-digit",
	day: "2-digit"
});

//#endregion
//#region packages/core/src/financeiro/honorarios.ts
const competenciaValida = (c) => /^\d{4}-(0[1-9]|1[0-2])$/.test(c);
const competenciaBr = (c) => competenciaValida(c) ? `${c.slice(5)}/${c.slice(0, 4)}` : c;

//#endregion
//#region packages/core/src/financeiro/boletoEfi.ts
const CONFIG_PADRAO_DO_BOLETO = {
	multa: 0,
	jurosAoMes: 0,
	diaPadrao: 10
};
const diaDeVencimentoValido = (d) => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 31;
function conferirConfigDoBoleto(c) {
	const erros = [];
	if (!(Number.isFinite(c.multa) && c.multa >= 0 && c.multa <= 10)) erros.push("A multa vai de 0 a 10%.");
	if (!(Number.isFinite(c.jurosAoMes) && c.jurosAoMes >= 0 && c.jurosAoMes <= 10)) erros.push("Os juros vão de 0 a 10% ao mês.");
	if (!diaDeVencimentoValido(c.diaPadrao)) erros.push("O dia de vencimento padrão vai de 1 a 31.");
	return erros;
}
function configDoBoletoDoBanco(d) {
	const o = d && typeof d === "object" ? d : {};
	const percentual = (v, padrao) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10 ? v : padrao;
	return {
		multa: percentual(o.multa, CONFIG_PADRAO_DO_BOLETO.multa),
		jurosAoMes: percentual(o.jurosAoMes, CONFIG_PADRAO_DO_BOLETO.jurosAoMes),
		diaPadrao: diaDeVencimentoValido(o.diaPadrao) ? o.diaPadrao : CONFIG_PADRAO_DO_BOLETO.diaPadrao
	};
}
const somarDias = (iso, dias) => {
	const d = /* @__PURE__ */ new Date(iso + "T12:00:00Z");
	d.setUTCDate(d.getUTCDate() + dias);
	return d.toISOString().slice(0, 10);
};
function vencimentoDoHonorario(competencia, dia, hoje) {
	const [a, m] = competencia.split("-").map(Number);
	const ano = m === 12 ? a + 1 : a, mes = m === 12 ? 1 : m + 1;
	const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
	const v = ano + "-" + String(mes).padStart(2, "0") + "-" + String(Math.min(dia, ultimo)).padStart(2, "0");
	return v > hoje ? {
		vencimento: v,
		ajustado: false
	} : {
		vencimento: somarDias(hoje, 3),
		ajustado: true
	};
}
const diaDoContrato = (c, cfg) => diaDeVencimentoValido(c.diaVencimento) ? c.diaVencimento : cfg.diaPadrao;
function boletoQueVale(c, competencia) {
	const b = c.boletosEfi?.[competencia];
	return b && b.status !== "erro" && b.status !== "cancelado" ? b : null;
}
function porQueNaoEmitir(c, competencia, recebimento) {
	if (!competenciaValida(competencia)) return "Escolha uma competência.";
	if (!c.ativo) return "O honorário deste cliente está parado.";
	if (!(c.valor > 0)) return "Defina o valor do honorário primeiro.";
	if (recebimento) return "Este honorário já está pago.";
	if (!/^(\d{11}|\d{14})$/.test(c.cnpj)) return "O cliente está sem CNPJ/CPF no contrato.";
	const b = boletoQueVale(c, competencia);
	if (b) return b.status === "pago" ? "Este boleto já foi pago." : "O boleto deste mês já foi pedido.";
	return "";
}
function pedidoDeBoleto(c, competencia, cfg, hoje, destinatarios, quem, agora) {
	return {
		status: "pedido",
		valor: Math.round(c.valor * 100) / 100,
		vencimento: vencimentoDoHonorario(competencia, diaDoContrato(c, cfg), hoje).vencimento,
		destinatarios: [...new Set(destinatarios.map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 10),
		pedidoEm: agora,
		pedidoPor: quem
	};
}
function corpoDoBolix(c, competencia, b, cfg) {
	const nome = c.nome.replace(/\s+/g, " ").trim().slice(0, 255);
	const email = b.destinatarios[0];
	const cliente = c.cnpj.length === 14 ? {
		juridical_person: {
			corporate_name: nome,
			cnpj: c.cnpj
		},
		...email ? { email } : {}
	} : {
		name: nome,
		cpf: c.cnpj,
		...email ? { email } : {}
	};
	const configuracoes = {
		...cfg.multa > 0 ? { fine: Math.round(cfg.multa * 100) } : {},
		...cfg.jurosAoMes > 0 ? { interest: Math.max(1, Math.round(cfg.jurosAoMes / 30 * 1e3)) } : {}
	};
	return {
		items: [{
			name: "Honorários contábeis " + competenciaBr(competencia),
			value: Math.round(b.valor * 100),
			amount: 1
		}],
		metadata: { custom_id: c.id + "_" + competencia },
		payment: { banking_billet: {
			expire_at: b.vencimento,
			customer: cliente,
			...Object.keys(configuracoes).length ? { configurations: configuracoes } : {},
			message: "Honorários contábeis de " + competenciaBr(competencia) + " · Nilma Contabilidade"
		} }
	};
}
function lerBolixEmitido(resposta) {
	const r = resposta && typeof resposta === "object" ? resposta : {};
	const d = r.data && typeof r.data === "object" ? r.data : r;
	const pix = d.pix && typeof d.pix === "object" ? d.pix : {};
	const pdf = d.pdf && typeof d.pdf === "object" ? d.pdf : {};
	const chargeId = Number(d.charge_id);
	const linha = String(d.barcode ?? "").replace(/\D/g, "");
	if (!Number.isInteger(chargeId) || chargeId <= 0) throw new Error("o Efí não devolveu o número da cobrança");
	if (!/^\d{47}$/.test(linha)) throw new Error("o Efí não devolveu a linha digitável");
	return {
		chargeId,
		linha,
		pix: String(pix.qrcode ?? ""),
		link: String(d.billet_link ?? d.link ?? ""),
		pdf: String(pdf.charge ?? "")
	};
}
function seloDoBoletoEfi(b) {
	if (!b) return null;
	const dia = b.vencimento.slice(8, 10) + "/" + b.vencimento.slice(5, 7);
	if (b.status === "pedido") return {
		rotulo: "Boleto pedido",
		tom: "info",
		dica: "O robô emite no Efí em instantes."
	};
	if (b.status === "emitindo") return {
		rotulo: "Emitindo boleto",
		tom: "info"
	};
	if (b.status === "erro") return {
		rotulo: "Boleto com erro",
		tom: "bad",
		dica: b.erro
	};
	if (b.status === "pago") return {
		rotulo: "Boleto pago" + (b.pagoEm ? " em " + b.pagoEm.slice(8, 10) + "/" + b.pagoEm.slice(5, 7) : ""),
		tom: "ok"
	};
	if (b.status === "cancelado") return {
		rotulo: "Boleto cancelado",
		tom: "aviso",
		dica: "Cancelado no Efí: dá para pedir outro."
	};
	return b.ambiente === "homologacao" ? {
		rotulo: "Boleto de teste · " + dia,
		tom: "aviso",
		dica: "Emitido na homologação do Efí: não vale como cobrança."
	} : {
		rotulo: "Boleto até " + dia,
		tom: "info"
	};
}
function boletosEfiDoBanco(v) {
	if (!v || typeof v !== "object") return void 0;
	const STATUS = [
		"pedido",
		"emitindo",
		"emitido",
		"erro",
		"pago",
		"cancelado"
	];
	const t = (x) => x == null ? "" : String(x);
	const out = {};
	for (const [comp, x] of Object.entries(v)) {
		const o = x && typeof x === "object" ? x : {};
		if (!competenciaValida(comp) || !STATUS.includes(o.status)) continue;
		out[comp] = {
			status: o.status,
			valor: Number(o.valor) || 0,
			vencimento: t(o.vencimento),
			destinatarios: Array.isArray(o.destinatarios) ? o.destinatarios.map(t).filter(Boolean) : [],
			pedidoEm: t(o.pedidoEm),
			pedidoPor: t(o.pedidoPor),
			...o.ambiente === "homologacao" || o.ambiente === "producao" ? { ambiente: o.ambiente } : {},
			...Number.isInteger(o.chargeId) ? { chargeId: o.chargeId } : {},
			...o.linha ? { linha: t(o.linha) } : {},
			...o.pix ? { pix: t(o.pix) } : {},
			...o.link ? { link: t(o.link) } : {},
			...o.boletoId ? { boletoId: t(o.boletoId) } : {},
			...o.emitidoEm ? { emitidoEm: t(o.emitidoEm) } : {},
			...o.erro ? { erro: t(o.erro) } : {},
			...o.pagoEm ? { pagoEm: t(o.pagoEm) } : {}
		};
	}
	return Object.keys(out).length ? out : void 0;
}
const DIAS_DE_CONSULTA = 120;
function boletosParaConsultar(contratos, hoje, dias = 120) {
	const limite = somarDias(hoje, -dias);
	const out = [];
	for (const c of contratos) for (const [competencia, b] of Object.entries(c.boletosEfi ?? {})) if (b.status === "emitido" && b.chargeId && (b.emitidoEm || "").slice(0, 10) >= limite) out.push({
		contratoId: c.id,
		competencia,
		boleto: b
	});
	return out;
}
function lerCobrancaDoEfi(resposta) {
	const r = resposta && typeof resposta === "object" ? resposta : {};
	const d = r.data && typeof r.data === "object" ? r.data : r;
	const status = String(d.status ?? "").toLowerCase();
	if (status === "canceled" || status === "cancelled") return { situacao: "cancelado" };
	if (status !== "paid" && status !== "settled") return { situacao: "aberto" };
	const pagamento = d.payment && typeof d.payment === "object" ? d.payment : {};
	const historico = Array.isArray(d.history) ? d.history : [];
	const dia = (v) => {
		const m = String(v ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
		return m ? m[1] : null;
	};
	const doHistorico = [...historico].reverse().find((h) => /pag|paid|pix/i.test(String(h?.message ?? "")));
	const pagoEm = dia(d.paid_at) ?? dia(pagamento.paid_at) ?? dia(doHistorico?.created_at);
	const centavos = [
		d.paid_value,
		pagamento.paid_value,
		d.total
	].map(Number).find((n) => Number.isFinite(n) && n > 0);
	const pix = String(pagamento.method ?? "").toLowerCase() === "pix" || historico.some((h) => /\bpix\b/i.test(String(h?.message ?? "")));
	return {
		situacao: "pago",
		valor: centavos == null ? null : Math.round(centavos) / 100,
		pagoEm,
		forma: pix ? "pix" : "boleto"
	};
}
function recebimentoDaBaixa(contratoId, competencia, b, pago, hoje, quem, agora) {
	return {
		contratoId,
		competencia,
		valor: pago.valor ?? b.valor,
		recebidoEm: pago.pagoEm ?? hoje,
		forma: pago.forma,
		observacoes: "Baixa automática pelo Efí (cobrança " + b.chargeId + ")",
		por: quem,
		em: agora
	};
}

//#endregion
exports.CONFIG_PADRAO_DO_BOLETO = CONFIG_PADRAO_DO_BOLETO;
exports.DIAS_DE_CONSULTA = DIAS_DE_CONSULTA;
exports.EMPRESA_DO_ESCRITORIO = EMPRESA_DO_ESCRITORIO;
exports.NOME_DO_BANCO_PELA_API = NOME_DO_BANCO_PELA_API;
exports.boletoQueVale = boletoQueVale;
exports.boletosEfiDoBanco = boletosEfiDoBanco;
exports.boletosParaConsultar = boletosParaConsultar;
exports.conferirConfigDoBoleto = conferirConfigDoBoleto;
exports.configDoBoletoDoBanco = configDoBoletoDoBanco;
exports.contaDoPlanoParaOBanco = contaDoPlanoParaOBanco;
exports.corpoDoBolix = corpoDoBolix;
exports.descricaoDaContaBancaria = descricaoDaContaBancaria;
exports.diaDeVencimentoValido = diaDeVencimentoValido;
exports.diaDoContrato = diaDoContrato;
exports.ehImportacaoPelaApi = ehImportacaoPelaApi;
exports.emendarComOManual = emendarComOManual;
exports.fecharImportacao = fecharImportacao;
exports.idDaImportacaoPelaApi = idDaImportacaoPelaApi;
exports.importacoesPelaApi = importacoesPelaApi;
exports.juntarArquivosDoExtrato = juntarArquivosDoExtrato;
exports.lerBolixEmitido = lerBolixEmitido;
exports.lerCobrancaDoEfi = lerCobrancaDoEfi;
exports.lidasDoSicoob = lidasDoSicoob;
exports.linhasDoExtrato = linhasDoExtrato;
exports.loteDaConta = loteDaConta;
exports.lotesDoCnab240 = lotesDoCnab240;
exports.mesesParaBuscar = mesesParaBuscar;
exports.pedidoDeBoleto = pedidoDeBoleto;
exports.porQueNaoEmitir = porQueNaoEmitir;
exports.recebimentoDaBaixa = recebimentoDaBaixa;
exports.rotuloDaContaBancaria = rotuloDaContaBancaria;
exports.seloDoBoletoEfi = seloDoBoletoEfi;
exports.slug = slug;
exports.ultimoDiaDoMes = ultimoDiaDoMes;
exports.ultimoDiaManual = ultimoDiaManual;
exports.vencimentoDoHonorario = vencimentoDoHonorario;