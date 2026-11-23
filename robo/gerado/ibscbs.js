// GERADO — NÃO EDITE. Feito por scripts/robo-ibscbs.mjs a partir de packages/core/src/tarefas/sieg/ibsCbs.ts. Mudou a
// fonte? Rode `node scripts/robo-ibscbs.mjs` e commite este arquivo junto.
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region packages/core/src/tarefas/sieg/ibsCbs.ts
const NUMERO_DA_BASE = 1e3;
const ENTIDADES = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: "\"",
	apos: "'"
};
const decodificar = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e] ?? m);
const reTag = (nome, g = "") => new RegExp("<(?:\\w+:)?" + nome + "(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?" + nome + ">", g);
function tag(x, nome) {
	const m = reTag(nome).exec(x);
	return m ? m[1] : "";
}
function tagInteira(x, nome) {
	const m = reTag(nome).exec(x);
	return m ? m[0] : "";
}
const texto = (x, nome) => decodificar(tag(x, nome).trim());
const num = (x, nome) => {
	const v = Number(tag(x, nome).trim());
	return Number.isFinite(v) ? v : 0;
};
const tem = (x, nome) => reTag(nome).test(x);
function dets(x) {
	return [...x.matchAll(/<(?:\w+:)?det\s[^>]*nItem="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/g)].map((m) => ({
		nItem: Number(m[1]),
		corpo: m[2],
		inteiro: m[0]
	}));
}
const UF_DO_CODIGO = {
	11: "RO",
	12: "AC",
	13: "AM",
	14: "RR",
	15: "PA",
	16: "AP",
	17: "TO",
	21: "MA",
	22: "PI",
	23: "CE",
	24: "RN",
	25: "PB",
	26: "PE",
	27: "AL",
	28: "SE",
	29: "BA",
	31: "MG",
	32: "ES",
	33: "RJ",
	35: "SP",
	41: "PR",
	42: "SC",
	43: "RS",
	50: "MS",
	51: "MT",
	52: "GO",
	53: "DF"
};
const ufDoMunicipio = (codigo) => UF_DO_CODIGO[String(codigo).slice(0, 2)] || "";
const soDigitos = (v) => String(v || "").replace(/\D/g, "");
function dataBr(s) {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
	return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}
function efetivo(sub) {
	const r = tag(sub, "gRed");
	return r ? num(r, "pAliqEfet") : null;
}
function lerGrupo(ibscbs) {
	const g = tag(ibscbs, "gIBSCBS");
	const uf = tag(g, "gIBSUF"), mun = tag(g, "gIBSMun"), cbs = tag(g, "gCBS");
	return {
		cst: texto(ibscbs, "CST"),
		cClassTrib: texto(ibscbs, "cClassTrib"),
		temValores: !!g,
		vBC: num(g, "vBC"),
		pIBSUF: num(uf, "pIBSUF"),
		vIBSUF: num(uf, "vIBSUF"),
		efetUF: efetivo(uf),
		pIBSMun: num(mun, "pIBSMun"),
		vIBSMun: num(mun, "vIBSMun"),
		efetMun: efetivo(mun),
		vIBS: num(g, "vIBS"),
		pCBS: num(cbs, "pCBS"),
		vCBS: num(cbs, "vCBS"),
		efetCBS: efetivo(cbs)
	};
}
const OUTROS_GRUPOS = [
	["gIBSCBSMono", "monofásico"],
	["gTransfCred", "transferência de crédito"],
	["gCredPresIBSZFM", "crédito presumido da ZFM"]
];
function componentesDaBase(det) {
	const prod = tag(det, "prod"), imp = tag(det, "imposto");
	const icms = tag(imp, "ICMS"), dest = tag(imp, "ICMSUFDest");
	const c = {
		vProd: num(prod, "vProd"),
		vFrete: num(prod, "vFrete"),
		vSeg: num(prod, "vSeg"),
		vOutro: num(prod, "vOutro"),
		vDesc: num(prod, "vDesc"),
		vII: num(tag(imp, "II"), "vII"),
		vIS: num(tag(imp, "IS"), "vIS"),
		vPIS: num(tag(imp, "PIS"), "vPIS"),
		vCOFINS: num(tag(imp, "COFINS"), "vCOFINS"),
		vICMS: num(icms, "vICMS"),
		vFCP: num(icms, "vFCP"),
		vICMSMono: num(icms, "vICMSMono"),
		vICMSUFDest: num(dest, "vICMSUFDest"),
		vFCPUFDest: num(dest, "vFCPUFDest")
	};
	return Object.fromEntries(Object.entries(c).filter(([, v]) => v > 0));
}
function notaParaConferir(xml, cnpj) {
	const m = /Id="NFe(\d{44})"/.exec(xml || "");
	if (!m) return null;
	const chave = m[1];
	const modelo = chave.slice(20, 22);
	if (modelo !== "55" && modelo !== "65") return null;
	const inf = tag(xml, "infNFe");
	const ide = tag(inf, "ide"), emit = tag(inf, "emit"), dest = tag(inf, "dest");
	const dhEmi = texto(ide, "dhEmi") || texto(ide, "dEmi");
	if (!/^\d{4}/.test(dhEmi) || Number(dhEmi.slice(0, 4)) < 2026) return null;
	const doc = soDigitos(cnpj);
	const docEmit = soDigitos(texto(emit, "CNPJ") || texto(emit, "CPF"));
	const docDest = soDigitos(texto(dest, "CNPJ") || texto(dest, "CPF"));
	const lado = doc && docEmit === doc ? "emitida" : doc && docDest === doc ? "recebida" : null;
	if (!lado) return null;
	const ano = Number(dhEmi.slice(0, 4));
	const municipio = texto(ide, "cMunFG");
	const itens = [];
	const daOperacao = [];
	const recortes = [];
	for (const d of dets(inf)) {
		const prod = tag(d.corpo, "prod"), imp = tag(d.corpo, "imposto");
		const ibscbs = tag(imp, "IBSCBS");
		const ncm = texto(prod, "NCM");
		const outro = OUTROS_GRUPOS.find(([g]) => tem(ibscbs, g))?.[1] || "";
		const grupo = ibscbs ? lerGrupo(ibscbs) : null;
		const comIs = tem(imp, "IS");
		const componentes = componentesDaBase(d.corpo);
		const conferirBase = !!grupo?.temValores && !outro && !comIs && Object.keys(componentes).length > 0;
		itens.push({
			nItem: d.nItem,
			ncm,
			descricao: texto(prod, "xProd"),
			grupo,
			outroGrupo: outro,
			conferirBase
		});
		if (ibscbs) recortes.push("<det nItem=\"" + d.nItem + "\"><imposto>" + tagInteira(imp, "IS") + tagInteira(imp, "IBSCBS") + "</imposto></det>");
		if (!grupo || outro || !grupo.cst || !grupo.cClassTrib) continue;
		const base = {
			numero: d.nItem,
			cst: grupo.cst,
			cClassTrib: grupo.cClassTrib,
			...ncm && !/^0+$/.test(ncm) ? { ncm } : {},
			quantidade: num(prod, "qCom") || 1,
			unidade: texto(prod, "uCom") || "UN",
			...ano >= 2027 && grupo.temValores ? { aliquotasNominais: {
				cbs: grupo.pCBS,
				ibsEstadual: grupo.pIBSUF,
				ibsMunicipal: grupo.pIBSMun
			} } : {}
		};
		daOperacao.push({
			...base,
			baseCalculo: grupo.vBC
		});
		if (conferirBase) daOperacao.push({
			...base,
			numero: NUMERO_DA_BASE + d.nItem,
			gComponentesBC: componentes
		});
	}
	const tot = tag(tag(inf, "total"), "IBSCBSTot");
	const operacao = daOperacao.length ? {
		id: chave,
		versao: "1.0.0",
		dhFatoGerador: dhEmi,
		municipio: Number(municipio) || 0,
		uf: ufDoMunicipio(municipio),
		tpDoc: Number(modelo),
		itens: daOperacao
	} : null;
	const compraGov = tagInteira(ide, "gCompraGov");
	const grupoXml = recortes.length ? "<infNFe xmlns=\"http://www.portalfiscal.inf.br/nfe\">" + (compraGov ? "<ide>" + compraGov + "</ide>" : "") + recortes.join("") + "<total>" + tagInteira(tag(inf, "total"), "ISTot") + tagInteira(tag(inf, "total"), "IBSCBSTot") + "</total></infNFe>" : "";
	return {
		chave,
		numero: texto(ide, "nNF"),
		serie: texto(ide, "serie"),
		tipo: modelo === "65" ? "NFC-e" : "NF-e",
		data: dataBr(dhEmi),
		lado,
		nome: lado === "emitida" ? texto(dest, "xNome") || (modelo === "65" ? "Consumidor" : "") : texto(emit, "xNome"),
		crt: texto(emit, "CRT"),
		itens,
		total: tot ? {
			vIBS: num(tag(tot, "gIBS"), "vIBS"),
			vCBS: num(tag(tot, "gCBS"), "vCBS")
		} : null,
		operacao,
		grupoXml,
		tipoXml: modelo === "65" ? "nfce" : "nfe"
	};
}
const obj = (v) => v && typeof v === "object" ? v : {};
const numero = (v) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};
function efetivoDaResposta(sub) {
	const r = obj(sub.gRed);
	return "pAliqEfet" in r ? numero(r.pAliqEfet) : null;
}
function grupoDaResposta(ibscbs) {
	const g = obj(ibscbs.gIBSCBS), uf = obj(g.gIBSUF), mun = obj(g.gIBSMun), cbs = obj(g.gCBS);
	return {
		cst: String(ibscbs.CST ?? ""),
		cClassTrib: String(ibscbs.cClassTrib ?? ""),
		temValores: "gIBSCBS" in ibscbs,
		vBC: numero(g.vBC),
		pIBSUF: numero(uf.pIBSUF),
		vIBSUF: numero(uf.vIBSUF),
		efetUF: efetivoDaResposta(uf),
		pIBSMun: numero(mun.pIBSMun),
		vIBSMun: numero(mun.vIBSMun),
		efetMun: efetivoDaResposta(mun),
		vIBS: numero(g.vIBS),
		pCBS: numero(cbs.pCBS),
		vCBS: numero(cbs.vCBS),
		efetCBS: efetivoDaResposta(cbs)
	};
}
const FOLGA_VALOR = .01;
const FOLGA_ALIQUOTA = 1e-4;
const reais = (v) => v.toLocaleString("pt-BR", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});
const pct = (v) => v.toLocaleString("pt-BR", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 4
}) + "%";
const efet = (v) => v == null ? "sem redução" : pct(v);
const CAMPOS = [
	[
		"alíquota do IBS da UF",
		(g) => g.pIBSUF,
		FOLGA_ALIQUOTA,
		(v) => pct(v ?? 0)
	],
	[
		"alíquota efetiva do IBS da UF (redução)",
		(g) => g.efetUF,
		FOLGA_ALIQUOTA,
		efet
	],
	[
		"IBS da UF",
		(g) => g.vIBSUF,
		FOLGA_VALOR,
		(v) => reais(v ?? 0)
	],
	[
		"alíquota do IBS do município",
		(g) => g.pIBSMun,
		FOLGA_ALIQUOTA,
		(v) => pct(v ?? 0)
	],
	[
		"alíquota efetiva do IBS do município (redução)",
		(g) => g.efetMun,
		FOLGA_ALIQUOTA,
		efet
	],
	[
		"IBS do município",
		(g) => g.vIBSMun,
		FOLGA_VALOR,
		(v) => reais(v ?? 0)
	],
	[
		"IBS (total do item)",
		(g) => g.vIBS,
		FOLGA_VALOR,
		(v) => reais(v ?? 0)
	],
	[
		"alíquota da CBS",
		(g) => g.pCBS,
		FOLGA_ALIQUOTA,
		(v) => pct(v ?? 0)
	],
	[
		"alíquota efetiva da CBS (redução)",
		(g) => g.efetCBS,
		FOLGA_ALIQUOTA,
		efet
	],
	[
		"CBS",
		(g) => g.vCBS,
		FOLGA_VALOR,
		(v) => reais(v ?? 0)
	]
];
const difere = (a, b, folga) => a == null || b == null ? a !== b : Math.abs(a - b) > folga + 1e-9;
const textoDoErro = (e) => [e.code, e.detail || e.title].filter(Boolean).join(" — ");
function conferirNota(nota, resposta, validacao) {
	const divergencias = [];
	const naoConferidos = [];
	const de2026 = nota.data.slice(6) === "2026";
	let baseDiferente2026 = false;
	const simples = nota.crt === "1" || nota.crt === "2" || nota.crt === "4";
	const base = {
		chave: nota.chave,
		numero: nota.numero,
		tipo: nota.tipo,
		data: nota.data,
		lado: nota.lado,
		nome: nota.nome,
		simples
	};
	const comGrupo = nota.itens.filter((i) => i.grupo);
	if (!comGrupo.length) return {
		...base,
		situacao: "semGrupo",
		divergencias,
		naoConferidos
	};
	if (!resposta && nota.operacao) return {
		...base,
		situacao: "naoConferida",
		divergencias,
		naoConferidos: [{
			item: 0,
			motivo: "a calculadora não respondeu"
		}]
	};
	if (validacao && !validacao.valido) divergencias.push({
		item: 0,
		campo: "leiaute do grupo IBSCBS (XSD)",
		naNota: validacao.mensagem,
		calculadora: "o grupo precisa seguir o leiaute"
	});
	const semGrupo = nota.itens.filter((i) => !i.grupo).map((i) => i.nItem);
	if (semGrupo.length) divergencias.push({
		item: 0,
		campo: "grupo IBSCBS",
		naNota: "falta no" + (semGrupo.length === 1 ? " item " : "s itens ") + semGrupo.join(", "),
		calculadora: "todo item da nota leva o grupo"
	});
	const porNumero = new Map((resposta?.objetos || []).map((o) => [Number(o.nObj), o]));
	for (const it of comGrupo) {
		const g = it.grupo;
		if (it.outroGrupo) {
			naoConferidos.push({
				item: it.nItem,
				motivo: "grupo " + it.outroGrupo
			});
			continue;
		}
		if (!g.cst || !g.cClassTrib) {
			divergencias.push({
				item: it.nItem,
				campo: "CST e cClassTrib",
				naNota: (g.cst || "sem CST") + " / " + (g.cClassTrib || "sem cClassTrib"),
				calculadora: "os dois são obrigatórios"
			});
			continue;
		}
		const o = porNumero.get(it.nItem);
		if (!o) {
			naoConferidos.push({
				item: it.nItem,
				motivo: "sem resposta da calculadora"
			});
			continue;
		}
		if (o.estadoItem === "INCONSISTENCIA_ENTRADA") {
			for (const e of o.erros || [{}]) divergencias.push({
				item: it.nItem,
				campo: "CST / cClassTrib / NCM",
				naNota: g.cst + " / " + g.cClassTrib + (it.ncm ? " / NCM " + it.ncm : ""),
				calculadora: textoDoErro(e) || "a calculadora recusou o item"
			});
			continue;
		}
		if (o.estadoItem !== "CALCULADO" && o.estadoItem !== "CALCULO_SIMULADO") {
			naoConferidos.push({
				item: it.nItem,
				motivo: (o.estadoItem === "NAO_IMPLEMENTADO" ? "a calculadora ainda não calcula este caso" : "falha na calculadora") + ((o.erros || []).length ? " (" + textoDoErro(o.erros[0]) + ")" : "")
			});
			continue;
		}
		const calc = grupoDaResposta(obj(o.tribCalc?.IBSCBS));
		if (calc.cst && calc.cst !== g.cst) divergencias.push({
			item: it.nItem,
			campo: "CST",
			naNota: g.cst,
			calculadora: calc.cst
		});
		if (calc.cClassTrib && calc.cClassTrib !== g.cClassTrib) divergencias.push({
			item: it.nItem,
			campo: "cClassTrib",
			naNota: g.cClassTrib,
			calculadora: calc.cClassTrib
		});
		if (calc.temValores !== g.temValores) {
			divergencias.push({
				item: it.nItem,
				campo: "grupo de valores (gIBSCBS)",
				naNota: g.temValores ? "preenchido" : "ausente",
				calculadora: calc.temValores ? "deve ter" : "não deve ter"
			});
			continue;
		}
		if (!g.temValores) continue;
		for (const [campo, valor, folga, formato] of CAMPOS) {
			const a = valor(g), b = valor(calc);
			if (difere(a, b, folga)) divergencias.push({
				item: it.nItem,
				campo,
				naNota: formato(a),
				calculadora: formato(b)
			});
		}
		const ob = it.conferirBase ? porNumero.get(NUMERO_DA_BASE + it.nItem) : void 0;
		if (ob && (ob.estadoItem === "CALCULADO" || ob.estadoItem === "CALCULO_SIMULADO")) {
			const bc = grupoDaResposta(obj(ob.tribCalc?.IBSCBS)).vBC;
			if (difere(g.vBC, bc, FOLGA_VALOR)) {
				if (de2026) baseDiferente2026 = true;
				else divergencias.push({
					item: it.nItem,
					campo: "base de cálculo (vBC)",
					naNota: reais(g.vBC),
					calculadora: reais(bc)
				});
			}
		} else if (ob && ob.estadoItem === "INCONSISTENCIA_ENTRADA") {
			if (de2026) {
				baseDiferente2026 = true;
				continue;
			}
			divergencias.push({
				item: it.nItem,
				campo: "base de cálculo (vBC)",
				naNota: reais(g.vBC),
				calculadora: textoDoErro((ob.erros || [{}])[0]) || "a calculadora recusou os componentes da base"
			});
		}
	}
	if (nota.total) {
		const soma = (f) => comGrupo.reduce((s, i) => s + (i.grupo.temValores ? f(i.grupo) : 0), 0);
		const vIBS = Math.round(soma((g) => g.vIBS) * 100) / 100, vCBS = Math.round(soma((g) => g.vCBS) * 100) / 100;
		if (difere(nota.total.vIBS, vIBS, FOLGA_VALOR)) divergencias.push({
			item: 0,
			campo: "total do IBS (IBSCBSTot)",
			naNota: reais(nota.total.vIBS),
			calculadora: "soma dos itens: " + reais(vIBS)
		});
		if (difere(nota.total.vCBS, vCBS, FOLGA_VALOR)) divergencias.push({
			item: 0,
			campo: "total da CBS (IBSCBSTot)",
			naNota: reais(nota.total.vCBS),
			calculadora: "soma dos itens: " + reais(vCBS)
		});
	}
	const situacao = divergencias.length ? "divergente" : naoConferidos.length === comGrupo.length ? "naoConferida" : "certa";
	return {
		...base,
		situacao,
		divergencias,
		naoConferidos,
		...baseDiferente2026 ? { baseDiferente2026 } : {}
	};
}
const MAX_NOTAS = 150;
const MAX_DIVERGENCIAS_POR_NOTA = 12;
const contagemVazia = () => ({
	conferidas: 0,
	certas: 0,
	divergentes: 0,
	semGrupo: 0,
	naoConferidas: 0,
	baseDiferente2026: 0
});
function resumoDaConferencia(notas, versao, em) {
	const emitidas = contagemVazia(), recebidas = contagemVazia();
	for (const n of notas) {
		const c = n.lado === "emitida" ? emitidas : recebidas;
		if (n.baseDiferente2026) c.baseDiferente2026++;
		if (n.situacao === "certa") {
			c.conferidas++;
			c.certas++;
		} else if (n.situacao === "divergente") {
			c.conferidas++;
			c.divergentes++;
		} else if (n.situacao === "semGrupo") c.semGrupo++;
		else c.naoConferidas++;
	}
	const divergentes = notas.filter((n) => n.situacao === "divergente").sort((a, b) => (a.lado === b.lado ? 0 : a.lado === "emitida" ? -1 : 1) || Number(a.numero) - Number(b.numero));
	return {
		em,
		versao,
		emitidas,
		recebidas,
		notas: divergentes.slice(0, 150).map((n) => ({
			...n,
			divergencias: n.divergencias.slice(0, 12),
			naoConferidos: n.naoConferidos.slice(0, 5)
		})),
		cortadas: Math.max(0, divergentes.length - 150)
	};
}
function lerConferenciaIbsCbs(v) {
	const d = obj(v);
	if (!d.em) return null;
	const cont = (x) => {
		const c = obj(x);
		return {
			conferidas: numero(c.conferidas),
			certas: numero(c.certas),
			divergentes: numero(c.divergentes),
			semGrupo: numero(c.semGrupo),
			naoConferidas: numero(c.naoConferidas),
			baseDiferente2026: numero(c.baseDiferente2026)
		};
	};
	const notas = Array.isArray(d.notas) ? d.notas.map(obj).map((n) => ({
		chave: String(n.chave ?? ""),
		numero: String(n.numero ?? ""),
		tipo: n.tipo === "NFC-e" ? "NFC-e" : "NF-e",
		data: String(n.data ?? ""),
		lado: n.lado === "recebida" ? "recebida" : "emitida",
		nome: String(n.nome ?? ""),
		situacao: "divergente",
		simples: !!n.simples,
		...n.baseDiferente2026 ? { baseDiferente2026: true } : {},
		divergencias: (Array.isArray(n.divergencias) ? n.divergencias : []).map(obj).map((x) => ({
			item: numero(x.item),
			campo: String(x.campo ?? ""),
			naNota: String(x.naNota ?? ""),
			calculadora: String(x.calculadora ?? "")
		})),
		naoConferidos: (Array.isArray(n.naoConferidos) ? n.naoConferidos : []).map(obj).map((x) => ({
			item: numero(x.item),
			motivo: String(x.motivo ?? "")
		}))
	})) : [];
	return {
		em: String(d.em),
		versao: String(d.versao ?? ""),
		emitidas: cont(d.emitidas),
		recebidas: cont(d.recebidas),
		notas,
		cortadas: numero(d.cortadas)
	};
}

//#endregion
exports.MAX_DIVERGENCIAS_POR_NOTA = MAX_DIVERGENCIAS_POR_NOTA;
exports.MAX_NOTAS = MAX_NOTAS;
exports.NUMERO_DA_BASE = NUMERO_DA_BASE;
exports.conferirNota = conferirNota;
exports.grupoDaResposta = grupoDaResposta;
exports.lerConferenciaIbsCbs = lerConferenciaIbsCbs;
exports.lerGrupo = lerGrupo;
exports.notaParaConferir = notaParaConferir;
exports.resumoDaConferencia = resumoDaConferencia;
exports.ufDoMunicipio = ufDoMunicipio;