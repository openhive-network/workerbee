import { createFilterFactory } from "./detailed/filter-factory-impl";
import { AFilter } from "./detailed/filter-impl";
import { IDataEvaluationContext, TReferencedDataCollectors } from "./data-collectors/collector";
import { TLogicalOrFilter } from "./detailed/composite-filter-impl";

import {IBlockData, IBlockHeaderData, IAccountData, IImpactedAccountData, IOperationData, IRcAccountData, ITransactionDataBase as ITransactionBaseData  } from "../interfaces";

class TDummyEvalContext implements IDataEvaluationContext {
  public async header(): Promise<IBlockHeaderData> { throw Error('Not implemented');}
  public async block(): Promise<IBlockData> { throw Error('Not implemented');}
  public async transaction(): Promise<ITransactionBaseData> { throw Error('Not implemented');}
  public async operation(): Promise<IOperationData> { throw Error('Not implemented');}
  public async account(): Promise<IAccountData> { throw Error('Not implemented');}
  public async rcAccount(): Promise<IRcAccountData> { throw Error('Not implemented');}
  public async impactedAccounts(): Promise<IImpactedAccountData> { throw Error('Not implemented');}
};

class TTestFilter extends AFilter {
  public constructor(private readonly evalResult: boolean, private readonly evalDelay: number, private readonly description: string) {
    super();
  }

  public async evaluate(_: IDataEvaluationContext): Promise<boolean> {
    console.log(`Starting evaluation of ${this.description}`);

    return new Promise<boolean>((resolve, _) => {
      setTimeout(() => {
        console.log(`Finishing evaluation of ${this.description}`);
        resolve(this.evalResult);
      }, this.evalDelay);
    });
  }

  public referencedCollectors(): TReferencedDataCollectors {
    return new Set();
  }
};

const factoryTest = (): void => {
  const factory = createFilterFactory();

  factory.onBlock(10).onBlock('gtg');
};

const compositeFilterTest = async (): Promise<void> => {

  const evalContext = new TDummyEvalContext();

  const filter1 = new TTestFilter(true, 100, 'It should be chosen');
  const filter2 = new TTestFilter(false, 110, 'It should be evaluated (ineffective)');
  const filter3 = new TTestFilter(true, 150, 'It should be cancelled');

  const orFilter = new TLogicalOrFilter([filter1, filter2, filter3]);
  const result = await orFilter.evaluate(evalContext);
  console.log(`Evaluation result is: ${result}`);
}

const main = async (): Promise<void> => {
  await compositeFilterTest();

  factoryTest();
};

const x = await main();
console.log(x);

