'use strict';

it("minimized test case that caused #6011 patch to fail", function (done) {

    console.log('+');
    // when the flaw was in the patch, commenting out this line would fix things:
    process.nextTick(function () { console.log('!'); });

    var n = createNamespace("test");
    expect(!n.get('state'), "state should not yet be visible");

    n.run(function () {
        n.set('state', true);
        expect(n.get('state'), "state should be visible");

        process.nextTick(function () {
            expect(n.get('state'), "state should be visible");
            done();
        });
    });
});