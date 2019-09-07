# About

[Babel macro](https://github.com/kentcdodds/babel-plugin-macros) to build pipeline of expressions for more readable left-to-right composition chains.

This plugin supports many niceties like support for awaiting on pipeline steps, support for [railway oriented programming](https://fsharpforfunandprofit.com/rop/), side-effect steps etc. Go through the Features section below for detailed examples.

## Example

Source:

```js
import Pipe from '@ts-delight/pipe.macro';

const increment = i => i + 1;
const add = (i, j) => i + j;

const result = Pipe(20)
  .thru(increment)
  .thru(add, 2)();

// Transpiles to:

const increment = i => i + 1;
const add = (i, j) => i + j;

const result = add(increment(20), 2);
```

Note that the left-to-right composition chain was transpiled to right-to-left composition of plain javascript functions.

Also note that there is no runtime dependency. The import to Pipe macro was entirely compiled away.

## Why ?

1. Left-to-right (or top-to-bottom) logic flow is more readable.
2. It is nice being able to compose much of logic through expressions (as opposed to a ton of intermediate variables).

This plugin may become obsolete once [pipeline-proposal](https://github.com/tc39/proposal-pipeline-operator/) become supported by typescript ([Relevant issue](https://github.com/microsoft/TypeScript/issues/17718)).
If you don't care about type checking, then you can try out [this babel-plugin](https://babeljs.io/docs/en/babel-plugin-proposal-pipeline-operator).

## Installation

This utility is implemented as a [babel-macro](https://github.com/kentcdodds/babel-plugin-macros).

Refer babel's [setup instructions](https://babeljs.io/setup) to learn how to setup your project to use [babel](https://babeljs.io) for compilation.

1. Install `babel-plugin-macros` and `@ts-delight/pipe.macro`:

```js
npm install --save-dev babel-plugin-macros @ts-delight/pipe.macro
```

2. Add babel-plugin-macros to .babelrc (if not already preset):

```js
// .babelrc

module.exports = {
  presets: [
    // ... other presets
  ],
  plugins: [
    'babel-plugin-macros', // <-- REQUIRED
    // ... other plugins
  ],
};
```

## Features

### Multi-step chaining:

  Multiple levels of invocation can be chained together

  ```js
  Pipe(value)
    .thru(increment) // <- Executed 1st
    .thru(
      i => i - 1 // <- Executed 2nd
    )(); // <- Get result
  ```

  Predicates which are specified as arrow functions (with implicit returns) will get inlined.

  So the example above compiles to something like:

  ```js
  (function() {
    const tmp = increment(value);
    return tmp - 1; // The arrow function was compiled away
  })()
  ```

  So, even if we have multiple thru invocations, if their arguments are arrow functions without block
  body, then the compiled output will have just one top level function invocation.

### Pipeline functions:

  If Pipe is not passed a value, it will return a function.

  ```js
  const fn = Pipe().thru(increment).thru(decrement)();

  fn(10) // Returns 10
  ```

### `tap` for side-effects:

  ```js
  Pipe(value)
    .thru(increment)
    .tap(i => {
      console.log(i);
    }) // Intercept value without modifying result
    .thru(increment)();
  ```

### `await` support:

  We can await on results of one step before passing them to another

  ```js
  await Pipe(1) // The pipeline will result in a promise if await is used as a step
    .thru(async i => i + 1)
    .await()
    .thru(j => j + 2)(); // Step after await receives a resolved value and not a promise
  ```

  await invocations can only be used in contexts where ES7 await is allowed. So following is illegal (and will fail to compile):

  ```js
  const foo = () =>
    Pipe(1)
      .thru(async i => i + 1)
      .await()(); // Await can not be used in a non-async function
  ```

### Use object methods with tap and thru:

  ```js
  Pipe(new User({id: 1}))
    .tap.register()          // Delegate to method register of User for side effect
    .await()
    .thru.enroll()           // Delegate to method enroll and continue chain with returned value
    .await()
    .thru.assignCourses()
  ```

  Equivalent to:

  ```
  (function() {
      const user = new User({id: 1});
      await user.register();                   // Return value discarded            (tap)
      const enrollment = await user.enroll();  // Return value used for next step   (thru)
      return enrollment.assignCourses();
  })()
  ```

  This feature enables you to use third party classes in a fluent manner even if the original author didn't implement a fluent API.

  There is atmost one immediately executed function expression generated per pipe, that too is only when side-effects / branching is involved.

### Bailing early:

  It is possible to have an early-return using `bailIf`:

  ```js
  Pipe(1)
    .thru(increment)
    .bailIf(i => i === 2) // Predicate to determine if chain should exit early
    .thru(increment) // Operations below are not executed
    .thru(increment)(); // Result is 2
  ```

### Reconcile bailed results:

  We can unify bailed branches and restore pipeline processing through `reconcile`:

  ```js
  Pipe(1)
    .thru(increment)
    .bailIf(i => i === 2)
    .thru(increment) // Not executed
    .reconcile() // Subsequent pipeline operations will get executed
    .thru(increment)(); // Result is 3
  ```

  Reconcile can take a function that receives the value (from primary chain or wherever we bailed) and returns a
  value to be used for subsequent processing

  ```js
  Pipe(1)
    .thru(increment)
    .bailIf(i => i === 2)
    .thru(increment)
    .reconcile(i => ` ${i} `)
    .thru(i => i.trim())(); // Result is "2"
  ```

## Usage with TypeScript

This library is type-safe and comes with type definitions.

All code must be processed through babel. Compilation through tsc (only) is not supported.

Recommended babel configuration:

```js
// .babelrc

module.exports = {
  presets: [
    '@babel/preset-typescript',
    // ... other presets
  ],
  plugins: [
    'babel-plugin-macros',
    // ... other plugins
  ],
};
```

When creating pipeline functions it is required to pass the argument type as a generic parameter to
Pipe:

```ts
const fn = Pipe<Student>()
  .tap.register()
  .await()
  .thru.enroll()
  .await()
  .thru.assignCourses()()

// Later

fn(new Student());
```

## Caveats

Every Pipe chain must end with a final function invocation without interruptions.

For example:

```js
const a = 10;
const intermediate = Pipe(a === 10);
const result = intermediate.thru(increment)();
```

Above code will fail to compile.

Because the entire Pipe chain is compiled away, anything return by Pipe, thru etc. can not be assigned, referenced, or used in any computation.

## You may also like:

1. **[if-expr.macro](https://github.com/ts-delight/if-expr.macro):** Similar utility, providing a fluent expression-oriented macro replacement for if statement.
2. **[switch-expr.macro](https://github.com/ts-delight/switch-expr.macro):** Similar utility, providing a fluent expression-oriented macro replacement for switch statement

## License

MIT
