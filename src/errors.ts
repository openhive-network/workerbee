/**
 * @internal
 */
export class AutoBeeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AutoBeeError";
  }
}
