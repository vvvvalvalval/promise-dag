// reiventing _.each() to iterate over objects
function objEach(obj, f){
  for(var key in obj){
    if(obj.hasOwnProperty(key)){
      var v = obj[key];
      f(v, key);
    }
  }
}

function allKeys(obj){
  var ret = [];
  objEach(obj, function (v, k) {
    ret.push(k);
  });
  return ret;
}

/**
 * Given an implementation of Promises, returns a function for running promise-dag graphs, which has the same behaviour as run().
 *
 * An implementation consists simply of 3 Promise operations:
 * - Promise.resolve()
 * - Promise.reject()
 * - Promise.all()
 *
 * @param {{resolve: Function, reject: Function, all: Function}} Promiz
 * @returns {Function}
 */
function implement(Promiz){
  function run(steps, required) {
    required = required || allKeys(steps);

    var UNVISITED = 0, VISITING = 1, VISITED = 2;

    var flags = {};
    var promises = {};

    objEach(steps, function (step, key) {
      flags[key] = UNVISITED;
    });

    function sourcePromise(step){
      var f = step[0];
      if(typeof f !== 'function'){
        throw new Error("The last element in a promiseDag step must be a function.");
      }

      var p;

      try {
        p = Promiz.resolve(f());
      } catch (err) {
        p = Promiz.reject(err);
      }

      return p;
    }

    function visit(key) {
      var step = steps[key];
      if(!step){
        throw new Error("Missing step in graph: [" + key + "]");
      }
      var p;
      if (flags[key] === VISITED) {
        p = promises[key];
      } else if (flags[key]  === VISITING) {
        throw new Error("Circular dependency around step [" + key + "]");
      } else {
        flags[key] = VISITING;

        var nDeps = step.length - 1;

        if (nDeps === 0) {
          p = sourcePromise(step);
        } else {
          var deps = [];
          for (var i = 0; i < nDeps; i++) { // with recursive, memoized calls, obtain the promises associated with the strings.
            var s = step[i];
            var dep = visit(s);
            deps.push(dep);
          }
          var handler = step[nDeps]; // handler is the last element.
          p = Promiz.all(deps).then(function (arr) {
            return handler.apply(null, arr);
          });
        }
        promises[key] = p;
        flags[key] = VISITED;
      }
      return p;
    }

    var ret = {};

    for(var i = 0, n = required.length; i < n; i++){
      var key = required[i];
      ret[key] = visit(key);
    }

    return ret;
  }

  return run;
}

var es6Factory = {
  resolve: function (v) {
    return Promise.resolve(v);
  },
  reject: function (v) {
    return Promise.reject(v);
  },
  all: function (arr) {
    return Promise.all(arr);
  }
};

/**
 * Given a data structure which specifies a computation as a DAG of named steps with dependencies,
 * performs the computation by assembling a matching DAG of Promises,
 * and returns an object mapping each step name to a Promise of the realized step.
 *
 * Optionally, an array of 'output' steps may be specified, in which case:
 * - only the computations associated to the output steps and their dependencies will be performed
 * - only the output steps Promises will be present in the returned object.
 *
 * A step specification consists of an array of length n+1 (n >= 0), in which:
 * - the first n elements are the names of the steps on which this step depends (as strings; there may be none of them!)
 * - the last element is an n-arity function, into which the realized dependencies will be injected,
 * which should return either the realized value for the current step, or a Promise of that realized value, or throw an Error.
 *
 * Note that the graph represented by `steps` may not have circular or missing dependencies.
 *
 * @param steps {{}} an object mapping step names to step specifications.
 * @param {Array.<string>|undefined} required
 * @returns {{}} an object mapping step names to Promises.
 */
var run = implement(es6Factory);

/**
 * A shorthand for 'constant' step specifications.
 * @param v {*}
 * @returns {*[]}
 */
function source(v){
  return [function () {
    return v;
  }];
}

exports.run = run;
exports.implement = implement;
exports.source = source;
