export class Resolver<T extends object = any> {
  private forceReject = () => {};

  public constructor(
    public readonly nextFns: Array<(data?: Record<string, any>) => Promise<Record<string, any>>> = []
  ) {}

  public push(fn: (data?: Record<string, any>) => Promise<Record<string, any>>) {
    this.forceReject();

    this.nextFns.push(fn);
  }

  public startResolve(data: Record<string, any>) {
    return Promise.race([
      new Promise<T>((_resolve, reject) => {
        this.forceReject = reject;
      }),
      new Promise<T>(async(resolve) => {
        const results = await Promise.all(this.nextFns.map(fn => fn(data)));

        resolve(results.reduce((acc, val) => ({ ...acc, ...val }), {}) as T);
      })
    ]);
  }

  public reset() {
    this.forceReject();
  }
}
