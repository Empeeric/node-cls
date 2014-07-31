'use strict';

var SENTINEL_SOCKET_DATA = 'data\n';
var SENTINEL_CLS_DATA = 0xabad1dea;

describe.only("continuation-local state with http connection 2", function () {
    it("client server", function (done) {
        var http = require('http'),
            createNamespace = require('../').createNamespace;

        var namespace = createNamespace('http');
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
                    expect(e).property('code').equal('ECONNRESET');
                    done();
                });

                // write data to request body
                req.write(SENTINEL_SOCKET_DATA);
                req.end();
            }
        );
    });
});
