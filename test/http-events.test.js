'use strict';
const DATUM1 = "Hello";
const DATUM2 = "GoodBye";
const TEST_VALUE = 0x1337;
const PORT = 55667;
const options = {
    host: "localhost",
    port: PORT,
    method: "POST"
};


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


    afterEach(function () {
        this.server.close();
        delete this.server;
    });


    it("client server", function (done) {
        const namespace = this.cls2.createNamespace('http1');
        namespace.run(() => {
            namespace.set('test', TEST_VALUE);
            this.server = this.http.createServer(function OnServerConnection(req, res) {
                expect(namespace.get('test')).equal(TEST_VALUE, "state has been mutated");
                req.on("data", function OnServerSocketData(data) {
                    expect(data.toString('utf-8')).equal(DATUM1, "should get DATUM1");
                    expect(namespace.get('test')).equal(TEST_VALUE, "state is still preserved");
                    res.end(DATUM2);
                });
            });
            this.server.listen(PORT);
            expect(namespace.get('test')).equal(TEST_VALUE, "state has been mutated");


            namespace.set("test-client", "MONKEY");
            const options = {
                host: "localhost",
                port: PORT,
                method: "POST"
            };
            const request = this.http.request(options, function OnClientConnect(res) {
                expect(namespace.get("test-client")).equal("MONKEY", "state preserved for client connection");
                res.on("data", function OnClientSocketData(data) {
                    expect(data.toString('utf-8')).equal(DATUM2, "should get DATUM1");
                    expect(namespace.get("test-client")).equal("MONKEY", "state preserved for client data");
                    done();
                });
            });
            request.write(DATUM1);
        });
    });



    it("client server", function (done) {
        const namespace = this.cls2.createNamespace('http2');
        namespace.run(() => {
            namespace.set('test', TEST_VALUE);

            this.server = this.http.createServer(function OnServerConnection(req, res) {
                expect(namespace.get('test')).equal(TEST_VALUE, "state has been mutated");
                req.on("data", function OnServerSocketData(data) {
                    expect(data.toString('utf-8')).equal(DATUM1, "should get DATUM1");
                    expect(namespace.get('test')).equal(TEST_VALUE, "state is still preserved");
                    res.end(DATUM2);
                });
            });
            this.server.listen(PORT);
            expect(namespace.get('test')).equal(TEST_VALUE, "state has been mutated");
        });


        const request = this.http.request(options, function OnClientConnect(res) {
            res.on("data", function OnClientSocketData(data) {
                expect(data.toString('utf-8')).equal(DATUM2, "should get DATUM1");
                done();
            });
        });
        request.write(DATUM1);
    });



    it("client", function (done) {
        this.server = this.http.createServer(function OnServerConnection(req, res) {
            req.on("data", function OnServerSocketData(data) {
                expect(data.toString('utf-8')).equal(DATUM1, "should get DATUM1");
                res.end(DATUM2);
            });
        });
        this.server.listen(PORT);

        const namespace = this.cls2.createNamespace('http3');
        namespace.run(() => {
            namespace.set("test", "MONKEY");
            const options = {
                host: "localhost",
                port: PORT,
                method: "POST"
            };
            const request = this.http.request(options, function OnClientConnect(res) {
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
});
