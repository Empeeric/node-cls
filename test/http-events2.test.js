'use strict';

var SENTINEL_SOCKET_DATA = 'data\n';
var SENTINEL_CLS_DATA = 0xabad1dea;

describe("`http` connection - 2", function () {
    before(function () {
        require.cache = {};
        this.http = require('http');
        this.cls2 = require('../');
    });

    after(function () {
        this.cls2.reset();
        delete this.cls2;
        delete this.http;
        require.cache = {};
    });

    it("client server", function (done) {
        var http = this.http;
        var namespace = this.cls2.createNamespace('http2');
        namespace.run(
            function () {
                namespace.set('test', SENTINEL_CLS_DATA);
                var req = http.get('http://127.0.0.2:8080', function (res) { // TIMEOUT
                    res.on('data', function (chunk) {
                        expect(chunk).eqaul(SENTINEL_SOCKET_DATA);
                    });
                    res.on('end', function () {
                        expect(namespace.get('test')).equal(SENTINEL_CLS_DATA);
                    });
                });

                // namespace.bindEmitter(req);
                req.setTimeout(500, function () {
                    expect(namespace.get('test')).equal(SENTINEL_CLS_DATA);
                    req.abort();
                });

                req.on('error', function (e) {
                    expect(namespace.get('test')).equal(SENTINEL_CLS_DATA);
                    expect(e).property('code').match(/ECONNRESET|ECONNREFUSED/);
                    done();
                });

                // write data to request body
                req.write(SENTINEL_SOCKET_DATA);
                req.end();
            }
        );
    });
});
