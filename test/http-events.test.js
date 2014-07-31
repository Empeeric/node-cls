'use strict';

var DATUM1 = "Hello";
var DATUM2 = "GoodBye";
var TEST_VALUE = 0x1337;
var PORT = 55667;

describe("continuation-local state with http connection", function () {
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
        var namespace = this.cls2.createNamespace('http');
        namespace.run(function () {
            namespace.set('test', TEST_VALUE);
            var server = http.createServer();
            server.on('request', function OnServerConnection(req, res) {
                expect(namespace.get('test')).equal(TEST_VALUE, "state has been mutated");
                req.on("data", function OnServerSocketData(data) {
                    expect(data.toString('utf-8')).equal(DATUM1, "should get DATUM1");
                    expect(namespace.get('test')).equal(TEST_VALUE, "state is still preserved");
                    server.close();
                    res.end(DATUM2);
                });
            });

            server.listen(PORT, function OnServerListen() {
                namespace.run(function () {
                    namespace.set("test", "MONKEY");
                    var request = http.request({host: "localhost", port: PORT, method: "POST"}, function OnClientConnect(res) {
                        expect(namespace.get("test")).equal("MONKEY", "state preserved for client connection");
                        res.on("data", function OnClientSocketData(data) {
                            expect(data.toString('utf-8')).equal(DATUM2, "should get DATUM1");
                            expect(namespace.get("test")).equal("MONKEY", "state preserved for client data");
                            done();
                        });
                    });
                    request.write(DATUM1);
                });

            });

            expect(namespace.get('test')).equal(TEST_VALUE, "state has been mutated");
        });
    });
});
