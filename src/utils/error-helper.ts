import { IEvaluationContextClass } from "../chain-observers/classifiers/collector-classifier-base";
import { AnyCollectorClass, EClassifierOrigin } from "../chain-observers/factories/factory-base";

export const createFactoryUnsupportedClassifierErrorMessage = (
  factoryName: string,
  classifierClass: IEvaluationContextClass | AnyCollectorClass,
  origin: EClassifierOrigin | string = "(unknown)",
  stack?: IEvaluationContextClass[]
): string => {
  const stringifiedStack = stack ? stack.map((cls) => cls.name).join("\" -> \"")
    : (new Error()).stack?.split("\n").map(node => node.split("@")[0]).filter(Boolean).join("\" -> \"") || "unknown";

  let errorMessage = `Classifier "${classifierClass.name}" required by ${origin}`;
  errorMessage += ` is not supported by factory "${factoryName}"\nStack: "${stringifiedStack}"\n\n`;
  errorMessage += "Possible causes:\n";
  errorMessage += "  - You are using WorkerBee interface incorrectly, ignoring type declarations. This may happen when you try to"
  errorMessage += " observe actions that require providers and filters not supported by the factory - e.g. account filter in history data.\n";
  errorMessage += `  - You are a developer, creating new factory named "${factoryName}" and forgot to add collector binding for`
  errorMessage += ` "${classifierClass.name}". See "collectors" property in "FactoryBase"\n`;
  errorMessage += "  - You are a developer, creating new provider or filter and tried to use them to observe actions with"
  errorMessage += ` "${factoryName}" factory, which does not provide binding for "${classifierClass.name}". See "collectors" property in "FactoryBase"\n`;

  return errorMessage;
};

export const createFactoryCircularDependencyErrorMessage = (
  factoryName: string,
  classifierClass: IEvaluationContextClass | AnyCollectorClass,
  origin: EClassifierOrigin | string = "(unknown)",
  stack?: IEvaluationContextClass[]
): string => {
  const stringifiedStack = stack ? stack.map((cls) => cls.name).join("\" -> \"")
    : (new Error()).stack?.split("\n").map(node => node.split("@")[0]).filter(Boolean).join("\" -> \"") || "unknown";

  let errorMessage = `Circular dependency detected in ${origin} collected by "${factoryName}"\nStack: "${stringifiedStack}"\n\n`;
  errorMessage += "Possible causes:\n";
  errorMessage += `  - You are a developer, creating new ${origin} and tried to depend on a classifier`;
  errorMessage += ` which created circular dependency starting at ${origin} with dependency: "${classifierClass.name}"\n`;

  return errorMessage;
};
