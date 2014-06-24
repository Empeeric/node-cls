'use strict';

var net = require('net');

describe("continuation-local state with net connection", function () {
    it.skip("client server", function (done) {
        var DATUM1 = "Hello";
        var DATUM2 = "GoodBye";
        var TEST_VALUE = 0x1337;

        var namespace = createNamespace('net');
        namespace.run(function () {
            namespace.set('test', 0xabad1dea);

            var server;
            namespace.run(function () {
                namespace.set('test', TEST_VALUE);
                server = net.createServer();
                server.on('connection', function OnServerConnection(socket) {
                    expect(namespace.get('test')).equal(TEST_VALUE, "state has been mutated");
                    socket.on("data", function OnServerSocketData(data) {
                        expect(data.toString('utf-8')).equal(DATUM1, "should get DATUM1");
                        expect(namespace.get('test')).equal(TEST_VALUE, "state is still preserved");
                        server.close();
                        socket.end(DATUM2);
                    });
                });

                server.listen(function OnServerListen() {
                    var address = server.address();

                    namespace.run(function () {
                        namespace.set("test", "MONKEY");
                        var client = net.connect(address.port, function OnClientConnect() {
                            expect(namespace.get("test")).equal("MONKEY", "state preserved for client connection");
                            client.on("data", function OnClientSocketData(data) {
                                expect(data.toString('utf-8')).equal(DATUM2, "should get DATUM1");
                                expect(namespace.get("test")).equal("MONKEY", "state preserved for client data");
                                done();
                            });
                            client.write(DATUM1);
                        });
                    });

                });
            });
        });
    });
});
