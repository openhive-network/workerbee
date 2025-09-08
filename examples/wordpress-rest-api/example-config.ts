export interface WordPressConfig {
  postLimit: number;
  observer: string;
  sort: "trending" | "hot" | "created" | "promoted" | "payout" | "payout_comments" | "muted";
  startAuthor: string;
  startPermlink: string;
  postTag: string;
  defaultPort: number;
}

export const wordPressExampleConfig: WordPressConfig = {
  postLimit: 10,
  observer: "hive.blog",
  sort: "created", // "trending" / "hot" / "created" / "promoted" / "payout" / "payout_comments" / "muted"
  startAuthor: "",
  startPermlink: "",
  postTag: "hive-148441",
  defaultPort: 4000,
}