const BinanceExchange = Symbol("Binance");
const HTXExchange = Symbol("HTX");
const MEXCExchange = Symbol("MEXC");
const ProBitExchange = Symbol("ProBit");
const UpbitExchange = Symbol("Upbit");

export type Exchange = typeof BinanceExchange | typeof HTXExchange | typeof MEXCExchange | typeof ProBitExchange | typeof UpbitExchange;

export const KnownExchanges = Object.freeze({
  "bdhivesteem": BinanceExchange,
  "binance-hot2": BinanceExchange,
  "deepcrypto8": BinanceExchange,
  "huobi-pro": HTXExchange,
  "huobi-withdrawal": HTXExchange,
  "mxchive": MEXCExchange,
  "probithive": ProBitExchange,
  "probitred": ProBitExchange,
  "user.dunamu": UpbitExchange
});

export const isExchange = (account: string): (false | Exchange) => KnownExchanges[account] || false;
