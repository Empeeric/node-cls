'use strict';

const EE = require('events').EventEmitter;
const assert = require('assert');
const wrapEmitter = require('emitter-listener');
const shimmer = require('shimmer');

/*
 *
 * CONSTANTS
 *
 */
const CONTEXTS_SYMBOL = 'cls@contexts';
const ERROR_SYMBOL = 'error@context';


if (!process.env.NO_CLS_FOR_EMMITERS && !EE.usingCLS) {
    EE.usingCLS = true;
    shimmer.wrap(EE, 'init', function (original) {
        return function () {
            original.apply(this, arguments);
            filteredEEBind(this, Namespace._active);
        };
    });
}


// load polyfill if native support is unavailable
if (!process.addAsyncListener) require('async-listener');


function Namespace(name) {
    this.name = name;
    // changed in 2.7: no default context
    this.active = null;
    this._set = [];
    this.id = null;
}

Namespace.prototype.set = function (key, value) {
    if (!this.active) {
        throw new Error("No context available. ns.run() or ns.bind() must be called first.");
    }

    this.active[key] = value;
    return value;
};

Namespace.prototype.get = function (key) {
    if (!this.active) return undefined;

    return this.active[key];
};

Namespace.prototype.createContext = function () {
    return Object.create(this.active);
};

Namespace.prototype.run = function (fn) {
    var context = this.createContext();
    this.enter(context);
    try {
        fn(context);
        return context;
    }
    catch (exception) {
        if (exception) {
            exception[ERROR_SYMBOL] = context;
        }
        throw exception;
    }
    finally {
        this.exit(context);
    }
};
Namespace.prototype.runAndReturn = function (fn) {
    var value;
    this.run(function (context) {
        value = fn(context);
    });
    return value;
};

Namespace.prototype.bind = function (fn, context) {
    if (!context) {
        if (!this.active) {
            context = Object.create(this.active);
        }
        else {
            context = this.active;
        }
    }

    const self = this;
    return function () {
        self.enter(context);
        try {
            return fn.apply(this, arguments);
        }
        catch (exception) {
            if (exception) {
                exception[ERROR_SYMBOL] = context;
            }
            throw exception;
        }
        finally {
            self.exit(context);
        }
    };
};


Namespace.prototype.enter = function (context) {
    assert.ok(context, "context must be provided for entering");

    this._set.push(this.active);
    this.active = context;
    Namespace._active = this;
};


Namespace.prototype.exit = function (context) {
    assert.ok(context, "context must be provided for exiting");

    // Fast path for most exits that are at the top of the stack
    if (this.active === context) {
        assert.ok(this._set.length, "can't remove top context");
        this.active = this._set.pop();
        Namespace._active = (this.active) ? this : null;
        return;
    }

    // Fast search in the stack using lastIndexOf
    var index = this._set.lastIndexOf(context);

    assert.ok(index >= 0, "context not currently entered; can't exit");
    assert.ok(index, "can't remove top context");

    this._set.splice(index, 1);
};


Namespace.prototype.bindEmitter = function (emitter) {
    assert.ok(emitter.on && emitter.addListener && emitter.emit, "can only bind real EEs");

    var namespace = this;
    var thisSymbol = 'context@' + this.name;

    // Capture the context active at the time the emitter is bound.
    function attach(listener) {
        if (!listener) return;
        if (!listener[CONTEXTS_SYMBOL]) listener[CONTEXTS_SYMBOL] = Object.create(null);

        listener[CONTEXTS_SYMBOL][thisSymbol] = {
            namespace: namespace,
            context: namespace.active
        };
    }

    // At emit time, bind the listener within the correct context.
    function bind(unwrapped) {
        if (!(unwrapped && unwrapped[CONTEXTS_SYMBOL])) return unwrapped;

        var wrapped = unwrapped;
        var contexts = unwrapped[CONTEXTS_SYMBOL];
        var thunk;
        Object.keys(contexts).forEach(function (name) {
            thunk = contexts[name];
            wrapped = thunk.namespace.bind(wrapped, thunk.context);
        });
        const patched = function () {
            for (let i = 0; i < arguments.length; ++i) {
                const arg = arguments[0];
                filteredEEBind(arg, thunk.context);
            }
            wrapped.apply(this, arguments);
        };
        return patched;
    }

    wrapEmitter(emitter, attach, bind);
};


function filteredEEBind(target, ctx) {
    if (!(target instanceof EE)) return;
    if (!ctx) return;
    if ('wrap@before' in target) return;

    const name = Object.getPrototypeOf(target).constructor.name;
    switch (name) {
        case  'ClientRequest':
        case  'IncomingMessage':
        case  'Server':
            Namespace._active.bindEmitter(target);
            break;

        case  'Socket':
            const server = target.server;
            if (server && 'wrap@before' in server)
                Namespace._active.bindEmitter(target);
            break;
    }
}


/**
 * If an error comes out of a namespace, it will have a context attached to it.
 * This function knows how to find it.
 *
 * @param {Error} exception Possibly annotated error.
 */
Namespace.prototype.fromException = function (exception) {
    return exception[ERROR_SYMBOL];
};

function get(name) {
    return process.namespaces[name];
}

function create(name) {
    assert.ok(name, "namespace must be given a name!");

    var namespace = new Namespace(name);
    namespace.id = process.addAsyncListener({
        create: function () {
            return namespace.active;
        },
        before: function (context, storage) {
            if (storage) namespace.enter(storage);
        },
        after: function (context, storage) {
            if (storage) namespace.exit(storage);
        },
        error: function (storage) {
            if (storage) namespace.exit(storage);
        }
    });

    process.namespaces[name] = namespace;
    return namespace;
}

function destroy(name) {
    var namespace = get(name);

    assert.ok(namespace, "can't delete nonexistent namespace!");
    assert.ok(namespace.id, "don't assign to process.namespaces directly!");

    process.removeAsyncListener(namespace.id);
    process.namespaces[name] = null;
}

function reset() {
    // must unregister async listeners
    if (process.namespaces) {
        Object.keys(process.namespaces).forEach(function (name) {
            destroy(name);
        });
    }
    process.namespaces = Object.create(null);
}
if (!process.namespaces) reset(); // call immediately to set up

module.exports = {
    getNamespace: get,
    createNamespace: create,
    destroyNamespace: destroy,
    reset: reset
};
