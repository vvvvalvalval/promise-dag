# promise-dag

Declarative, modular, minimal-latency asynchronous computations usings graphs of Promises.

**Features:**

* Express complex async workflows using a high-level data structure (instead of wiring promises by hand using `Promise.all()` etc.)
* **No dependencies**. In particular, no dependency to a concrete implementation of Promises;
 you can plug in any Promise implementation (es6-promise, Q, bluebird, when.js, Angular's $q...)
* Lightweight (<1k minified and gzipped)
* *Lazyness:* the only steps which are computed are those you require (and those on which they depend).
* *Automatic minimum latency:* chaining promises by hand often yields suboptimal performance,
 because some steps are run serially which could be run in parallel. `promise-dag` always chains promises so as to minimize latency.

## Installation

This library is available on NPM as [`promise-dag`](https://www.npmjs.com/package/promise-dag):

```
$ npm install promise-dag --save
```

### Node / ES6

```javascript
var promiseDag = require('promise-dag');
```

### Browser

A browser version is available in `js/browser/promise-dag(.min).js`. 
It exports a global `promiseDag` in `window`.

## Usage

```javascript
var promiseDag = require('promise-dag');

// describe the computation as steps which depend on previous steps.
// in this cooking example, functions which return a promise are prefixed with `p_`.
var mushroomPastaRecipe = {
  hotWater: [function(){
    return p_boilWater("1L");
  }],
  rawPasta: [function(){ return p_pickIngredient("pasta"); }],
  cookedPasta: ['hotWater','rawPasta', function(hotWater, rawPasta){
    return p_boil(hotWater, rawPasta, "10 minutes");
  }],
  
  slicedOnion: [function(){ return p_pickIngredient("onion").then(slice); }],
  slicedMushroom: [function(){ return p_pickIngredient("mushroom").then(slice); }],
  friedOnionAndMushroom: ['slicedOnion','slicedMushroom', function(slicedOnion, slicedMushroom){
    return p_fry([slicedOnion, slicedMushroom], "3 min");
  }],
  cream: [function() { return p_pickIngredient("cream"); }],
  
  sauce: ['friedOnionAndMushroom','cream', function(friedOnionAndMushroom, cream){
    return mix(friedOnionAndMushroom, cream);
  }],
  
  meal: ['cookedPasta', 'sauce', mix]
};

// returns an object mapping each step name to a promise of the completed step
promiseDag.run(mushroomPastaRecipe);
// {hotWater: Promise{...}, rawPasta: Promise{...}, ...}

// you can specify which output steps you want to return. Only the dependencies of those steps will be run.
promiseDag.run(mushroomPastaRecipe, ['cookedPasta', 'sauce']);
// {cookedPasta: Promise{...}, sauce: Promise{...}}

// Example 1: eating the whole meal
promiseDag.run(mushroomPastaRecipe, ['meal']).meal.then(eat);

// Example 2: if you are lazy, you can just cook the pasta. The rest of the cooking won't occur.
promiseDag.run(mushroomPastaRecipe, ['cookedPasta']).cookedPasta.then(eat);

// Example 3: if you don't feel like cooking the sauce yourself, you can buy it at the store instead
var lazyRecipe = _.extend({},mushroomPastaRecipe, {
  sauce: [function(){ return p_buyAtStore('mushroomSauce'); }]
});
promiseDag.run(lazyRecipe, ['meal']).meal.then(eat);

```

## Using with non-standard Promise implementations

`promiseDag.run()` will look for a standard Promise implementation by assuming a global `Promise` object.

In environments where this implementation is not available / desirable, you can plug in any other Promise implementation using `promiseDag.implement()`;
all you have to do is provide the `Promise.resolved()`, `Promise.reject()` and `Promise.all()` functions.
`promiseDag.implement()` returns a function which has the same behaviour as `promiseDag.run`.

Here are some examples:

#### Bluebird

```javascript
var Promise = require('bluebird');

var runBluebird = promiseDag.implement({
  resolve: function(v){
    return Promise.resolve(v);
  },
  reject: function(err){
    return Promise.reject(err);
  },
  all: function(ps){
    return Promise.all(ps);
  }
}) 
```

#### Angular 1.x `$q`

```javascript
var run$q = promiseDag.implement({
  resolve: function(v){
    return $q.when(v);
  },
  reject: function(err){
    var d = $q.defer();
    d.reject(err);
    return d.promise;
  },
  all: function(ps){
    return Promise.all(ps);
  }
});
```

#### Q

```javascript
var Q = require('q');

var runQ = promiseDag.implement({
  resolve: Q,
  reject: function(err){
    return Q.reject(err);
  },
  all: function(ps){
    return Q.all(ps);
  }
});
```

#### when.js

```javascript
var when = require('when');

var runWhen = promiseDag.implement({
  resolve: when,
  reject: function(err){
    return when.reject(err);
  },
  all: function(ps){
    return when.all(ps);
  }
});
```

## Why a new library?

Prior to `promise-dag`, a few libraries already existed which let you express async workflows as DAGs of promises,
 see for example [dagmise](https://www.npmjs.com/package/dagmise) and [qryq](https://github.com/bguiz/qryq).
 
I was dissatisfied with these alternatives for the following reasons:

* They impose a concrete Promise implementation.
 `promise-dag` is compatible with any Promise implementation, without any code dependency.
* They provide a fluent API (chaining methods).
 I prefer a data-oriented API, which is more programmable and transparent, making it easy to combine computation graphs using ordinary
 data-structure functions (`_.extend()`, `_.pick()`, ...), as well as add custom instrumentation (profiling / tracing / logging / etc.).


## Inspiration

* `ngRoute`'s [resolve clauses](https://docs.angularjs.org/api/ngRoute/provider/$routeProvider)
* Plumatic's [Graph](https://github.com/plumatic/plumbing#graph-the-functional-swiss-army-knife)
