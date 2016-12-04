var assert = require('assert');
var _ = require('lodash');
var bluebird = require('bluebird');

var pDag = require('../index');

describe('promise-dag', function () {
  describe('.link()', function () {
    this.timeout(5000);

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

    it("Nominal case with explicit output", function (done) {
      var linked = pDag.link(nominalSteps, ['z']);
      assert(_.isEqual(_.keys(linked).sort(), ['z']));
      linked.z.then(function (z) {
          assert.equal(z, 3);
          done();
        })
    });

    it("Nominal case with no explicit output", function (done) {
      var linked = pDag.link(nominalSteps);
      assert(_.isEqual(_.keys(linked).sort(), ['x','y','z']));
      linked.z.then(function (z) {
          assert.equal(z, 3);
          done();
        })
    });

    it('works on empty graphs', function () {
      assert(_.isEqual(pDag.link({}), {}));
    });

    it("runs all steps if no output steps specified", function (done) {
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

      pDag.link(steps);

      Promise.all(promises.map(_.property('p'))).then(function () {
        done();
      })

    });

    it("if outputs are specified, runs only the necessary steps", function (done) {
      var ran = [];

      function reportRun(name){
        ran.push(name);
        return name;
      }

      pDag.link({
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

      bluebird.delay(50).then(function () {
        assert(_.isEqual(ran.sort(), ['a0','a1','b0','b1']));
        done();
      })
    })
  });
});
