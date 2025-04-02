/* eslint-disable no-fallthrough */
import { WorkerBeeError } from "../errors";

export const dateFromString = (dateTimeString: string): Date => {
  if (dateTimeString.endsWith("Z"))
    return new Date(dateTimeString);
  return new Date(`${dateTimeString}Z`);
};

export const calculateRelativeTime = (expirationTime: number | string | Date): Date => {
  let expiration: Date;
  if(typeof expirationTime === "string") {
    if (expirationTime[0] !== "-")
      return dateFromString(expirationTime);

    let mul = 1000;

    switch(expirationTime[expirationTime.length - 1]) {
    case "d":
      mul *= 24;
    case "h":
      mul *= 60;
    case "m":
      mul *= 60;
    case "s":
      break;
    default:
      throw new WorkerBeeError("Invalid expiration time offset");
    }

    const num = Number.parseInt((/\d+/).exec(expirationTime)?.[0] as string);
    if(Number.isNaN(num))
      throw new WorkerBeeError("Invalid expiration time offset");

    expiration = new Date(Date.now() - (num * mul));
  } else
    expiration = new Date(expirationTime);


  return expiration;
};
