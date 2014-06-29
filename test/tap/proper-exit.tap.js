'use strict';

process.once('uncaughtException', function (err) {
  if (err.message === 'oops') {
    console.log("ok got expected message: %s", err.message);
  }
  else {
    throw err;
  }
});

var cls = require('../../cls.js');
var ns = cls.createNamespace('x');
ns.run(function () { throw new Error('oops'); });
