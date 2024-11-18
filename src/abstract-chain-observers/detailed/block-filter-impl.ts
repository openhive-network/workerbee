import { IBlockData, IBlockHeaderData } from "../../interfaces";
import { IBlockFilter, IBlockHeaderFilter } from "../filter";
import { AFilter } from "./filter-impl";
import { IDataEvaluationContext, TReferencedDataCollectors } from "../data-collectors/collector";
import { dateFromString, TAccountName } from "@hiveio/wax";

abstract class ABlockHeaderFilter extends AFilter implements IBlockHeaderFilter {

  public async evaluate(context: IDataEvaluationContext): Promise<boolean> {
    const data = await context.header();
    return this.match(data);
  }

  public referencedCollectors(): TReferencedDataCollectors {
    return new Set(["header"]);
  }

  /**
   * This method should be implemented in derived classes, where are handled specific filters.
   * @param data Already received block header data.
   */
  public abstract match(data: IBlockHeaderData): Promise<boolean>;
};

/**
 * Common class implementing data acquisition part specific to block contents
 */
export abstract class ABlockFilter extends AFilter implements IBlockFilter {

  public async evaluate(context: IDataEvaluationContext): Promise<boolean> {
    const blockData = await context.block();
    return this.match(blockData);
  }

  public referencedCollectors(): TReferencedDataCollectors {
    return new Set(["block"]);
  }

  /**
   * This method should be implemented in derived classes, where are handled specific filters.
   * @param data Already received block data.
   */
  public abstract match(data: IBlockData): Promise<boolean>;
};

export class TBlockNumFilter extends ABlockHeaderFilter {
  public constructor(private readonly num: number) {
    super();
  }

  public async match(collectedData: IBlockHeaderData): Promise<boolean> {
    return collectedData.number === this.num;
  }
};

export class TBlockTimeFilter extends ABlockHeaderFilter {
  public constructor(private readonly blockTime: Date) {
    super();
  }

  public async match(collectedData: IBlockHeaderData): Promise<boolean> {
    const blockDate = dateFromString(collectedData.timestamp);
    return blockDate === this.blockTime;
  }
};

export class TBlockProducerFilter extends ABlockHeaderFilter {
  public constructor(private readonly witnessName: TAccountName) {
    super();
  }

  public async match(collectedData: IBlockHeaderData): Promise<boolean> {
    return collectedData.witness === this.witnessName;
  }
};
