import type { Subscribable, Unsubscribable } from "rxjs";

export class Resolver<T extends object = any> {
  private forceReject = () => {};

  private nextFns: Array<{ next?: (data: Record<string, any>) => void }> = [];
  private unsubscribable: Array<Unsubscribable> = [];

  private promises: Array<Promise<any>> = [];

  public constructor(
    public readonly subscribables: Array<Subscribable<Record<string, any>>> = []
  ) {}

  public push(fn: Subscribable<Record<string, any>>) {
    this.forceReject();

    this.subscribables.push(fn);
  }

  public get hasSubscribables() {
    return this.subscribables.length > 0;
  }

  public subscribe() {
    for(let i = 0; i < this.subscribables.length; ++i)
      this.unsubscribable[i] = this.subscribables[i].subscribe(this.nextFns[i] = {});

    this.initPromises();
  }

  public unsubscribe() {
    for(let i = 0; i < this.unsubscribable.length; ++i)
      this.unsubscribable[i].unsubscribe();
  }

  private initPromises() {
    for(let i = 0; i < this.subscribables.length; ++i) {
      this.promises.push(new Promise(resolve => {
        this.nextFns[i].next = resolve;
      }));
    }
  }

  public startResolve(): Promise<Record<string, any>> {
    return Promise.race([
      new Promise<T>((_resolve, reject) => {
        this.forceReject = reject;
      }),
      new Promise<T>(async(resolve) => {
        const results = await Promise.all(this.promises);

        resolve(results.reduce((acc, val) => ({ ...acc, ...val }), {}) as T);
      })
    ]).then(data => {
      this.initPromises();

      return data;
    });
  }

  public cancel() {
    this.forceReject();
  }
}
