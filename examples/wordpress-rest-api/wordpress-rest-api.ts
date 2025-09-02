import express, { Request, Response } from "express";
import cors from "cors";
import { categoryHive } from "./mocks/categories";
import { comments1, comments2, comments3 } from "./mocks/comments";
import { allPosts, post1, post2, post3 } from "./mocks/posts";
import { tagMock } from "./mocks/tags";
import { userWordPress } from "./mocks/users";
import { createHiveChain } from "@hiveio/wax";
import { ExtendedNodeApi } from "./hive";
import { mapHivePostToWpPost } from "./hiveToWpMap";

const hiveChain = await createHiveChain();
const extendedHiveChain = hiveChain.extend<ExtendedNodeApi>();

const app = express();
const PORT = 4000;

// Middleware to parse JSON
app.use(express.json());
app.use(cors());

let lastAuthorPermlinkId: number  = -1; 
const authorPermlinkToId = new Map<string, number>();

let lastAccountId: number = -1;
const accountToId = new Map<string, number>();

const getAuthorPermlinkFromSlug = (slug: string): {author: string, permlink: string} => {
  const splitedSlug = slug.split("-");
  const author = splitedSlug[0];
  splitedSlug.shift();
  const permlink = splitedSlug.join("-");
  lastAuthorPermlinkId = lastAuthorPermlinkId + 1;
  authorPermlinkToId.set(slug, lastAuthorPermlinkId);
  lastAccountId = lastAccountId + 1;
  accountToId.set(author, lastAccountId); 
  return {
    author,
    permlink
  }
}

const apiRouter = express.Router();


apiRouter.get("/posts", async (req: Request, res: Response) => {
  if (req.query.page === "1")
    res.json(allPosts);
  else {
    const {author, permlink} = getAuthorPermlinkFromSlug(req.query.slug as string);
    const result = await extendedHiveChain.api.bridge.get_post({author, permlink, observer: "hive.blog"});
    if (result) {
      res.json(mapHivePostToWpPost(result, 1, 1));
    } else {
      res.status(404).json({ error: "Post not found" });
    }
    
  }

});

apiRouter.get("/comments", (req: Request, res: Response) => {
  if (req.query.post === "1")
    res.json(comments1);
  else if (req.query.post === "6")
    res.json(comments2);
  else if (req.query.post === "9")
    res.json(comments3);
});

apiRouter.get("/tags", (req: Request, res: Response) => {
  res.json(tagMock);
});

apiRouter.get("/categories", (req: Request, res: Response) => {
  res.json(categoryHive);
});

apiRouter.get("/users", (req: Request, res: Response) => {
  res.json(userWordPress);
});

apiRouter.get("/media", (req: Request, res: Response) => {
  res.json([]);
});

apiRouter.get("/pages", (req: Request, res: Response) => {
  res.json([]);
});

// Mount router with prefix
app.use("/wp-json/wp/v2", apiRouter);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
