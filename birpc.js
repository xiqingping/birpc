
function BirpcSocket(url) {
	this.ws = new WebSocket(url);
	this.pendingCalls = {};
	this.handlers = {};
	this.sequence = 0;
	this.onReady = undefined;


	this.onMethodsGot = (function (reply, err) {
		if (err) {
			console.log('getMethod error:' + err.msg);
		} else {
			console.log('support methods:' + reply);
			for (var method of reply) {
				let thisMethod = method;
				var objAndFunc = method.split(".");
				if (objAndFunc.length != 2) {
					return;
				}
				var obj = objAndFunc[0];
				var func = objAndFunc[1];

				if (!this[obj]) {
					this[obj] = new Object()
				}

				this[obj]['async' + func] = (function (args, cbk, timeout) {
					this.call(thisMethod, args, cbk, timeout);
				}).bind(this);
			};

			if (this.onReady) {
				this.onReady()
			}
		}
	}).bind(this)

	this.ws.onopen = (function (e) {
		this.call('getMethods', null, this.onMethodsGot, 1000);
	}).bind(this);

	this.ws.onmessage = (function (e) {
		//console.log(e);
		var rpc = JSON.parse(e.data);

		if (rpc.fn) {
			var ret = { id: rpc.id };
			if (rpc.fn == 'eval') {
				if (typeof (rpc.args) == 'string') {
					console.log('eval by remote: ' + rpc.args);
					ret.result = eval(rpc.args);
				} else {
					ret.error = 'eval none string type';
				}
			} else {
				var func = this.handlers[rpc.fn]
				if (func == undefined) {
					ret.error = 'Unknown method'
				} else {
					ret.result = func(rpc.args);
				}
			}
			//console.log("JS->:" + JSON.stringify(ret))
			this.ws.send(JSON.stringify(ret));
		} else {
			var call = this.pendingCalls[rpc.id];
			if (call != undefined) {
				clearTimeout(call.timer);
				if (call.cbk != undefined) {
					call.cbk(rpc.result, rpc.error);
				}
				delete this.pendingCalls[rpc.id]
			}
		}
	}).bind(this);

	this.registerMethod = (function (method, fn) {
		this.handlers[method] = fn;
	}).bind(this);

	this.onRpcTimeout = (function (seq) {
		var call = this.pendingCalls[seq];
		if (call != undefined) {
			if (call.cbk != undefined) {
				call.cbk(undefined, 'timeout');
			}
			delete this.pendingCalls[seq];
		}
	}).bind(this);

	this.call = (function (method, args, cbk, timeout) {
		var call = { cbk: cbk };
		var callmsg = { id: this.sequence, fn: method, args: args };

		this.ws.send(JSON.stringify(callmsg));
		//console.log("JS<-:" + JSON.stringify(callmsg));
		call.timer = setTimeout(this.onRpcTimeout, timeout, this.sequence);
		this.pendingCalls[this.sequence] = call;
		this.sequence++;
	}).bind(this);
}

export { BirpcSocket };


