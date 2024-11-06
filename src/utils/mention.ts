import type { TAccountName } from "@hiveio/wax";

export const mentionedAccount = (accountName: TAccountName, message: string): boolean => {
  let lastIndexOf = -1;
  while((lastIndexOf = message.indexOf(`@${accountName}`, lastIndexOf + 1)) !== -1) {
    const nextChar = message[lastIndexOf + accountName.length + 1];
    switch(nextChar) {
    case "a": case "b": case "c": case "d": case "e": case "f": case "g": case "h":
    case "i": case "j": case "k": case "l": case "m": case "n": case "o": case "p":
    case "q": case "r": case "s": case "t": case "u": case "v": case "w": case "x":
    case "y": case "z":
    case "0": case "1": case "2": case "3": case "4": case "5": case "6": case "7":
    case "8": case "9":
    case "-": case ".":
      continue;
    default:
      return true; // - next char is not a possible username character, so we have a mention
    }
  }

  return false;
};
