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
 *
 * @param {{resolve: Function, reject: Function, all: Function}} Promiz
 * @returns {Function}
 */
function implement(Promiz){
  return function run(steps, required) {
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
      var p;
      if (flags[key] === VISITED) {
        p = promises[key];
      } else if (flags[key]  === VISITING) {
        throw new Error("Circular dependency in steps graph.");
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
  };
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

var run = implement(es6Factory);

function source(v){
  return [function () {
    return v;
  }];
}

exports.run = run;
exports.implement = implement;
exports.source = source;
