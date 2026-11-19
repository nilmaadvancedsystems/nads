// GERADO — NÃO EDITE. Feito por scripts/robo-financeiro.mjs a partir de packages/core/src/financeiro/{extratoPelaApi,banco}.ts
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
exports.EMPRESA_DO_ESCRITORIO = EMPRESA_DO_ESCRITORIO;
exports.NOME_DO_BANCO_PELA_API = NOME_DO_BANCO_PELA_API;
exports.contaDoPlanoParaOBanco = contaDoPlanoParaOBanco;
exports.descricaoDaContaBancaria = descricaoDaContaBancaria;
exports.ehImportacaoPelaApi = ehImportacaoPelaApi;
exports.emendarComOManual = emendarComOManual;
exports.fecharImportacao = fecharImportacao;
exports.idDaImportacaoPelaApi = idDaImportacaoPelaApi;
exports.importacoesPelaApi = importacoesPelaApi;
exports.juntarArquivosDoExtrato = juntarArquivosDoExtrato;
exports.lidasDoSicoob = lidasDoSicoob;
exports.linhasDoExtrato = linhasDoExtrato;
exports.loteDaConta = loteDaConta;
exports.lotesDoCnab240 = lotesDoCnab240;
exports.mesesParaBuscar = mesesParaBuscar;
exports.rotuloDaContaBancaria = rotuloDaContaBancaria;
exports.slug = slug;
exports.ultimoDiaDoMes = ultimoDiaDoMes;
exports.ultimoDiaManual = ultimoDiaManual;