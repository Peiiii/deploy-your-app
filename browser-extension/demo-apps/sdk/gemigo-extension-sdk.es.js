var MessageType;
(function(e) {
	e.Call = "call", e.Reply = "reply", e.Syn = "syn", e.SynAck = "synAck", e.Ack = "ack";
})(MessageType ||= {});
var Resolution;
(function(e) {
	e.Fulfilled = "fulfilled", e.Rejected = "rejected";
})(Resolution ||= {});
var ErrorCode;
(function(e) {
	e.ConnectionDestroyed = "ConnectionDestroyed", e.ConnectionTimeout = "ConnectionTimeout", e.NoIframeSrc = "NoIframeSrc";
})(ErrorCode ||= {});
var NativeErrorName;
(function(e) {
	e.DataCloneError = "DataCloneError";
})(NativeErrorName ||= {});
var NativeEventType;
(function(e) {
	e.Message = "message";
})(NativeEventType ||= {});
var createDestructor_default = (e, v) => {
	let y = [], b = !1;
	return {
		destroy(x) {
			b || (b = !0, v(`${e}: Destroying connection`), y.forEach((e) => {
				e(x);
			}));
		},
		onDestroy(e) {
			b ? e() : y.push(e);
		}
	};
}, createLogger_default = (e) => (...v) => {
	e && console.log("[Penpal]", ...v);
};
const serializeError = ({ name: e, message: v, stack: y }) => ({
	name: e,
	message: v,
	stack: y
}), deserializeError = (e) => {
	let v = /* @__PURE__ */ Error();
	return Object.keys(e).forEach((y) => v[y] = e[y]), v;
};
var connectCallReceiver_default = (y, S, C) => {
	let { localName: T, local: E, remote: D, originForSending: O, originForReceiving: k } = y, A = !1, j = (y) => {
		if (y.source !== D || y.data.penpal !== MessageType.Call) return;
		if (k !== "*" && y.origin !== k) {
			C(`${T} received message from origin ${y.origin} which did not match expected origin ${k}`);
			return;
		}
		let { methodName: x, args: E, id: j } = y.data;
		C(`${T}: Received ${x}() call`);
		let M = (y) => (S) => {
			if (C(`${T}: Sending ${x}() reply`), A) {
				C(`${T}: Unable to send ${x}() reply due to destroyed connection`);
				return;
			}
			let E = {
				penpal: MessageType.Reply,
				id: j,
				resolution: y,
				returnValue: S
			};
			y === Resolution.Rejected && S instanceof Error && (E.returnValue = serializeError(S), E.returnValueIsError = !0);
			try {
				D.postMessage(E, O);
			} catch (y) {
				if (y.name === NativeErrorName.DataCloneError) {
					let b = {
						penpal: MessageType.Reply,
						id: j,
						resolution: Resolution.Rejected,
						returnValue: serializeError(y),
						returnValueIsError: !0
					};
					D.postMessage(b, O);
				}
				throw y;
			}
		};
		new Promise((e) => e(S[x].apply(S, E))).then(M(Resolution.Fulfilled), M(Resolution.Rejected));
	};
	return E.addEventListener(NativeEventType.Message, j), () => {
		A = !0, E.removeEventListener(NativeEventType.Message, j);
	};
}, id = 0, generateId_default = () => ++id, KEY_PATH_DELIMITER = ".", keyPathToSegments = (e) => e ? e.split(KEY_PATH_DELIMITER) : [], segmentsToKeyPath = (e) => e.join(KEY_PATH_DELIMITER), createKeyPath = (e, v) => {
	let y = keyPathToSegments(v || "");
	return y.push(e), segmentsToKeyPath(y);
};
const setAtKeyPath = (e, v, y) => {
	let b = keyPathToSegments(v);
	return b.reduce((e, v, x) => (e[v] === void 0 && (e[v] = {}), x === b.length - 1 && (e[v] = y), e[v]), e), e;
}, serializeMethods = (e, v) => {
	let y = {};
	return Object.keys(e).forEach((b) => {
		let x = e[b], S = createKeyPath(b, v);
		typeof x == "object" && Object.assign(y, serializeMethods(x, S)), typeof x == "function" && (y[S] = x);
	}), y;
}, deserializeMethods = (e) => {
	let v = {};
	for (let y in e) setAtKeyPath(v, y, e[y]);
	return v;
};
var connectCallSender_default = (b, S, C, w, E) => {
	let { localName: D, local: k, remote: A, originForSending: j, originForReceiving: M } = S, N = !1;
	E(`${D}: Connecting call sender`);
	let P = (b) => (...S) => {
		E(`${D}: Sending ${b}() call`);
		let C;
		try {
			A.closed && (C = !0);
		} catch {
			C = !0;
		}
		if (C && w(), N) {
			let e = /* @__PURE__ */ Error(`Unable to send ${b}() call due to destroyed connection`);
			throw e.code = ErrorCode.ConnectionDestroyed, e;
		}
		return new Promise((y, C) => {
			let w = generateId_default(), N = (S) => {
				if (S.source !== A || S.data.penpal !== MessageType.Reply || S.data.id !== w) return;
				if (M !== "*" && S.origin !== M) {
					E(`${D} received message from origin ${S.origin} which did not match expected origin ${M}`);
					return;
				}
				let O = S.data;
				E(`${D}: Received ${b}() reply`), k.removeEventListener(NativeEventType.Message, N);
				let j = O.returnValue;
				O.returnValueIsError && (j = deserializeError(j)), (O.resolution === Resolution.Fulfilled ? y : C)(j);
			};
			k.addEventListener(NativeEventType.Message, N);
			let P = {
				penpal: MessageType.Call,
				id: w,
				methodName: b,
				args: S
			};
			A.postMessage(P, j);
		});
	}, F = C.reduce((e, v) => (e[v] = P(v), e), {});
	return Object.assign(b, deserializeMethods(F)), () => {
		N = !0;
	};
}, startConnectionTimeout_default = (e, v) => {
	let b;
	return e !== void 0 && (b = window.setTimeout(() => {
		let b = /* @__PURE__ */ Error(`Connection timed out after ${e}ms`);
		b.code = ErrorCode.ConnectionTimeout, v(b);
	}, e)), () => {
		clearTimeout(b);
	};
}, handleSynAckMessageFactory_default = (v, y, b, x) => {
	let { destroy: S, onDestroy: C } = b;
	return (b) => {
		if (!(v instanceof RegExp ? v.test(b.origin) : v === "*" || v === b.origin)) {
			x(`Child: Handshake - Received SYN-ACK from origin ${b.origin} which did not match expected origin ${v}`);
			return;
		}
		x("Child: Handshake - Received SYN-ACK, responding with ACK");
		let w = b.origin === "null" ? "*" : b.origin, T = {
			penpal: MessageType.Ack,
			methodNames: Object.keys(y)
		};
		window.parent.postMessage(T, w);
		let D = {
			localName: "Child",
			local: window,
			remote: window.parent,
			originForSending: w,
			originForReceiving: b.origin
		};
		C(connectCallReceiver_default(D, y, x));
		let O = {};
		return C(connectCallSender_default(O, D, b.data.methodNames, S, x)), O;
	};
}, areGlobalsAccessible = () => {
	try {
		clearTimeout();
	} catch {
		return !1;
	}
	return !0;
}, connectToParent_default = (v = {}) => {
	let { parentOrigin: y = "*", methods: b = {}, timeout: w, debug: T = !1 } = v, E = createLogger_default(T), D = createDestructor_default("Child", E), { destroy: O, onDestroy: k } = D, A = handleSynAckMessageFactory_default(y, serializeMethods(b), D, E), j = () => {
		E("Child: Handshake - Sending SYN");
		let v = { penpal: MessageType.Syn }, b = y instanceof RegExp ? "*" : y;
		window.parent.postMessage(v, b);
	};
	return {
		promise: new Promise((v, y) => {
			let b = startConnectionTimeout_default(w, O), S = (y) => {
				if (areGlobalsAccessible() && !(y.source !== parent || !y.data) && y.data.penpal === MessageType.SynAck) {
					let e = A(y);
					e && (window.removeEventListener(NativeEventType.Message, S), b(), v(e));
				}
			};
			window.addEventListener(NativeEventType.Message, S), j(), k((e) => {
				window.removeEventListener(NativeEventType.Message, S), e && y(e);
			});
		}),
		destroy() {
			O();
		}
	};
}, connectionPromise = null;
function isInIframe() {
	try {
		return window.self !== window.top;
	} catch {
		return !0;
	}
}
function getHost(e) {
	if (connectionPromise) return connectionPromise;
	isInIframe() || console.warn("[GemiGo SDK] Not running in iframe. SDK calls will not work.");
	let v = {};
	return e && Object.assign(v, e), connectionPromise = connectToParent_default({ methods: v }).promise, connectionPromise;
}
function initConnection(e) {
	getHost(e).catch((e) => {
		console.debug("[GemiGo SDK] Auto-connect waiting...", e);
	});
}
var handlers = {
	contextMenu: [],
	selectionChange: []
};
function on(e, v) {
	return handlers[e].push(v), () => {
		let y = handlers[e].indexOf(v);
		y > -1 && handlers[e].splice(y, 1);
	};
}
function emit(e, v) {
	handlers[e].forEach((y) => {
		try {
			y(v);
		} catch (v) {
			console.error(`[GemiGo SDK] Error in ${e} handler:`, v);
		}
	});
}
function getChildMethods() {
	return {
		onContextMenuEvent(e) {
			emit("contextMenu", e);
		},
		onSelectionChange(e, v, y) {
			handlers.selectionChange.forEach((b) => {
				try {
					b(e, v, y);
				} catch (e) {
					console.error("[GemiGo SDK] Error in selectionChange handler:", e);
				}
			});
		}
	};
}
const extensionAPI = {
	getPageInfo: () => getHost().then((e) => e.getPageInfo()),
	getPageHTML: () => getHost().then((e) => e.getPageHTML()),
	getPageText: () => getHost().then((e) => e.getPageText()),
	getSelection: () => getHost().then((e) => e.getSelection()),
	extractArticle: () => getHost().then((e) => e.extractArticle()),
	highlight: (e, v) => getHost().then((y) => y.highlight(e, v)),
	removeHighlight: (e) => getHost().then((v) => v.removeHighlight(e)),
	insertWidget: (e, v = "bottom-right") => getHost().then((y) => y.insertWidget({
		html: e,
		position: v
	})),
	updateWidget: (e, v) => getHost().then((y) => y.updateWidget(e, v)),
	removeWidget: (e) => getHost().then((v) => v.removeWidget(e)),
	injectCSS: (e) => getHost().then((v) => v.injectCSS(e)),
	removeCSS: (e) => getHost().then((v) => v.removeCSS(e)),
	extractLinks: () => getHost().then((e) => e.extractLinks()),
	extractImages: () => getHost().then((e) => e.extractImages()),
	queryElement: (e, v) => getHost().then((y) => y.queryElement(e, v)),
	captureVisible: () => getHost().then((e) => e.captureVisible()),
	getContextMenuEvent: () => getHost().then((e) => e.getContextMenuEvent()),
	onContextMenu: (e) => (getHost(), on("contextMenu", e)),
	onSelectionChange: (e) => (getHost(), on("selectionChange", e))
};
function createSDK() {
	return {
		notify: (e, v) => getHost().then((y) => y.notify({
			title: e,
			message: v
		})),
		extension: extensionAPI
	};
}
var sdk = createSDK();
initConnection(getChildMethods());
var sdk_default = sdk;
export { sdk_default as default };
