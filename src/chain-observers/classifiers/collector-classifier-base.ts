export interface IEvaluationContextClass {
  name: string;

  new(): CollectorClassifierBase;
}

export type TRegisterEvaluationContext = IEvaluationContextClass | {
  options?: Record<string, any>;
  class: IEvaluationContextClass;
}

export class CollectorClassifierBase<TDataType = any> {
  public type!: TDataType;

  public static forOptions(options?: Record<string, any>): TRegisterEvaluationContext {
    return {
      class: this,
      options
    };
  }
}
