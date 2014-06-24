'use strict';

it("asynchronously propagating state with local-context-domains", function (done) {
    var namespace = createNamespace('namespace');
    expect(process.namespaces.namespace, "namespace has been created");

    namespace.run(function () {
        namespace.set('test', 1337);
        expect(namespace.get('test')).equal(1337, "namespace is working");
        done();
    });
});
