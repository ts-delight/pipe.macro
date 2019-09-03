import Pipe from '../../pipe.macro';

export const r1 = Pipe(10)();

export const r2 = Pipe(10).thru((i) => i + 1)();

const r3 = Pipe(20)
  .thru((i, j) => i + j, 1)
  .thru((i, j) => i + j, 2)();

export { r3 }

const r4 = Pipe(30)
  .thruEnd((i) => i + 1)
  .thru((i: number, msg: string) => `${msg}: ${i}`, "Hello")();

const r5 = Pipe(30)
  .tap((i) => {
    console.log('i: ', i)
  })
  .thruEnd((i) => i + 1)
  .tap((j) => {
    console.log('j: ', j)
  })
  .thruEnd((msg: string, i: number) => `${msg}: ${i}`, "Hello")();

const r6 = async () => Pipe(30)
  .tap((i) => {
    console.log('i: ', i)
  })
  .thruEnd(async (i) => i + 1)
  .await()
  .tap((j) => {
    console.log('j: ', j)
  })
  .await()
  .thruEnd(async function transform(msg: string, i: number) {
    return `${msg}: ${i}`;
  }, "Hello")();

const r7 = async () => Pipe(30)
  .tap((i) => {
    console.log('i: ', i)
  })
  .thruEnd(async (i) => i + 1)
  .await()();

const r8 = Pipe(10)
  .thru(i => i + 1)
  .bailIf(i => i === 11)
  .thru(i => i + 2)
  .reconcile()();

const increment = (i: number) => i + 1;

const r9 = (i: number) => Pipe(i)
  .thru(increment)
  .bailIf(i => i === 11)
  .thru(increment)
  .bailIf(i =>
    Pipe(i).thru(i => i === 10)()
  )
  .reconcile(i => i + 1)
  .thru(increment)()

const r10 = async () => Pipe(1)
  .thru(async (i) => i + 1)
  .await()
  .thru((j) => j + 2)()

export { r4, r5, r6, r7, r8, r9, r10 };

class User {
  first: string;
  last: string;

  constructor() {
    this.first = "Jane";
    this.last = "Doe";
  }

  getFirst() {
    return this.first;
  }
  getLast() {
    return this.last;
  }
  getName(count: "first" | "last" | "full") {
    switch (count) {
      case "first":
        return this.getFirst();
      case "last":
        return this.getLast();
      case "full":
        return this.getFirst() + " " + this.getLast();
    }
  }
}

const r11 = Pipe(new User())
  .tap.getFirst()
  .tap.getLast()
  .thru.getFirst()
  .thru.trim()();

class Enrollment {
  async assignCourses() {
    return Promise.resolve(true);
  }
}

class Student {
  id: number;
  constructor(params: { id: number }) {
    this.id = params.id;
  }
  async register() {
    return this;
  }
  enroll() {
    return Promise.resolve(new Enrollment());
  }
}

const r13 = async () => Pipe(new Student({ id: 1 }))
  .tap.register()
  .await()
  .thru.enroll()
  .await()
  .thru.assignCourses()()

export { r11, r13 };
