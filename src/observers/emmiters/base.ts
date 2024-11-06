import { WorkerBeeRegister } from "../register";

export abstract class AbstractBaseEmitter {
  public constructor(
    protected readonly register: WorkerBeeRegister
  ) {}

  public abstract emit(data: any): void;
  public abstract registerEvent(listener: (...data: any[]) => void, options?: Record<string, any>): void;
  public abstract unregisterEvent(listener: (...data: any[]) => void, options?: Record<string, any>): void;
}

export type TListener<EmitterData extends object> = (data: EmitterData) => void;

export class BaseEmitter<EmitterData extends object> extends AbstractBaseEmitter {
  private listeners: Array<TListener<EmitterData>> = [];

  public emit(data: EmitterData): void {
    for(const listener of this.listeners)
      listener(data);
  }

  private getIndex(listener: TListener<EmitterData>): number {
    return this.listeners.findIndex(data => data === listener);
  }

  public registerEvent(listener: TListener<EmitterData>): void {
    const existing = this.getIndex(listener);
    if(existing === -1)
      this.listeners.push(listener);
  }

  public unregisterEvent(listener: TListener<EmitterData>): void {
    const existing = this.getIndex(listener);

    if(existing !== -1)
      this.listeners = this.listeners.splice(existing, 1);
  }
}
