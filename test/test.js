var assert = require('assert');
var _ = require('lodash');
var bluebird = require('bluebird');

var pDag = require('../index');

describe('promise-dag', function () {

  var nominalSteps = {
    x: pDag.source(1),
    y: ['x', function (x) {
      return bluebird.delay(10).then(function () {
        return x + 1;
      });
    }],
    z: ['x', 'y', function (x, y) {
      return x + y
    }]
  };

  describe('.run()', function () {
    this.timeout(5000);

    it("Nominal case with explicit output", function () {
      var linked = pDag.run(nominalSteps, ['z']);
      assert(_.isEqual(_.keys(linked).sort(), ['z']));
      return linked.z.then(function (z) {
          assert.equal(z, 3);
      });
    });

    it("Nominal case with no explicit output", function () {
      var linked = pDag.run(nominalSteps);
      assert(_.isEqual(_.keys(linked).sort(), ['x','y','z']));
      return linked.z.then(function (z) {
          assert.equal(z, 3);
      });
    });

    it('works on empty graphs', function () {
      assert(_.isEqual(pDag.run({}), {}));
    });

    it("runs all steps if no output steps specified", function () {
      var promises = _.chain(_.range(0,3))
        .map(function (i) {
          var p, resolve;
          p = new Promise(function (res, rej) {
            resolve = res;
          });
          return {p: p, resolve: resolve};
        }).value();

      var steps = {
        'init': pDag.source('dummy'),
        0: ['init', function (init) {
          promises[0].resolve(0);
        }],
        1: ['init', function (init) {
          promises[1].resolve(1);
        }],
        2: [function () {
          promises[2].resolve(2);
        }]
      };

      pDag.run(steps);

      return Promise.all(promises.map(_.property('p')));

    });

    it("if outputs are specified, runs only the steps depending on them.", function () {
      var ran = [];

      function reportRun(name){
        ran.push(name);
        return name;
      }

      pDag.run({
        a0: [function () {
          return reportRun('a0');
        }],
        a1: ['a0', function (a0) {
          return reportRun('a1');
        }],
        a2: ['a0', function (a0) {
          return reportRun('a2');
        }],

        b0: [function () {
          return reportRun('b0');
        }],
        b1: ['b0', function (b0) {
          return reportRun('b1');
        }],

        c0: [function () {
          return reportRun('c0');
        }]
      }, ['a1','b1']);

      return bluebird.delay(10).then(function () {
        assert(_.isEqual(ran.sort(), ['a0','a1','b0','b1']));
      });
    });

    it("fails immediately if there's a cyclic dependency in the required steps", function () {

      var steps = {
        x: ['z', function (z) {
          return z;
        }],
        y: ['x', function (x) {
          return x;
        }],
        z: ['y', function (y) {
          return y;
        }],

        a: pDag.source(1)
      };

      assert.throws(function () {
        pDag.run(steps);
      }, /Circular dependency/i);

      assert.throws(function () {
        pDag.run(steps, ['x']);
      }, /Circular dependency/i);

    });

    var missingSteps = {
      y: ['x', function (x) {
        return x;
      }],

      a: pDag.source(42)
    };

    it("fails immediately if there's a missing required step", function () {

      assert.throws(function () {
        pDag.run(missingSteps);
      }, /Missing/i);

      assert.throws(function () {
        pDag.run(missingSteps, ['y']);
      }, /Missing/i)

      assert.throws(function () {
        pDag.run(missingSteps, ['x']);
      }, /Missing/i)

    });

    it("but will tolerate missing steps on non-required portions of the graph", function () {

      assert.doesNotThrow(function () {
        pDag.run(missingSteps, ['a']);
      });

      assert.doesNotThrow(function () {
        pDag.run(missingSteps, []);
      });

    })
  });

  describe('.source()', function () {
    this.timeout(1000);
    it("realizes the step as the value passed in", function () {
      return pDag.run({
        a: pDag.source(42)
      }, ['a']).a.then(function (v) {
          assert.equal(v, 42);
      });
    });
  });

  describe('.implement()', function () {
    it("works with bluebird", function () {
      var runBluebird = pDag.implement({
        resolve: function(v){
          return bluebird.resolve(v);
        },
        reject: function(err){
          return bluebird.reject(err);
        },
        all: function(ps){
          return bluebird.all(ps);
        }
      });

      return runBluebird(nominalSteps, ['z']).z.then(function (z) {
        assert.equal(z, 3);
      });
    });
  })
});
