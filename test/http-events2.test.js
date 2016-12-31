'use strict';
const SENTINEL_SOCKET_DATA = 'data\n';
const SENTINEL_CLS_DATA = 0xabad1dea;


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
        const http = this.http;
        const namespace = this.cls2.createNamespace('http2');
        namespace.run(
            function () {
                namespace.set('test', SENTINEL_CLS_DATA);

                const options = {
                    hostname: '127.0.0.2',
                    port: 8080,
                    method: 'GET'
                };


                const req = http.request(options, (res) => {
                    console.log(`STATUS: ${res.statusCode}`);
                    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => {
                        expect(chunk).eqaul(SENTINEL_SOCKET_DATA);
                    });
                    res.on('end', () => {
                        expect(namespace.get('test')).equal(SENTINEL_CLS_DATA);
                    });
                });

                // namespace.bindEmitter(req);
                req.setTimeout(1000, function () {
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
