import express, { Request, Response } from "express";
import cors from "cors";
import { categoryHive } from "./mocks/categories";
import { comments1, comments2, comments3 } from "./mocks/comments";
import { allPosts, post1, post2, post3 } from "./mocks/posts";
import { tagMock } from "./mocks/tags";
import { userWordPress } from "./mocks/users";
import { createHiveChain } from "@hiveio/wax";
import { ExtendedNodeApi } from "./hive";
import { mapHiveCommentToWPComment, mapHivePostToWpPost } from "./hiveToWpMap";
import { WPComment } from "./wp-reference";
import { simpleHash } from "./hash-utils";

const hiveChain = await createHiveChain();
const extendedHiveChain = hiveChain.extend<ExtendedNodeApi>();

const app = express();
const PORT = 4000;

// Middleware to parse JSON
app.use(express.json());
app.use(cors());

const idToStringMap = new Map<number, string>();

const getAuthorPermlinkFromSlug = (slug: string): {author: string, permlink: string} => {
  const splitedSlug = slug.split("_");
  const author = splitedSlug[0];
  splitedSlug.shift();
  const permlink = splitedSlug.join("_");
  return {
    author,
    permlink
  }
}

const apiRouter = express.Router();


apiRouter.get("/posts", async (req: Request, res: Response) => {
  if (req.query.page === "1")
    res.json(allPosts);
  else if (req.query.slug === "com.chrome.devtools.json") res.json([]);
  else {
    const {author, permlink} = getAuthorPermlinkFromSlug(req.query.slug as string);
    const authorPermlinkHash = simpleHash(req.query.slug);
    const authorHash = simpleHash(author);
    idToStringMap.set(authorPermlinkHash, req.query.slug as string);
    idToStringMap.set(authorHash, author);
    const result = await extendedHiveChain.api.bridge.get_post({author, permlink, observer: "hive.blog"});
    if (result) {
      res.json(mapHivePostToWpPost(result, authorPermlinkHash, authorHash));
    } else {
      res.status(404).json({ error: "Post not found" });
    }
    
  }

});

apiRouter.get("/comments", async (req: Request, res: Response) => {
  const postId = Number(req.query.post);
  const postParent = idToStringMap.get(postId);
  if (postParent) {
    const result = await extendedHiveChain.api.bridge.get_discussion({author: postParent.split("_")[0], permlink: postParent.split("_").slice(1).join("_")});
    if (result) {
      const wpComments: WPComment[] = []
      Object.entries(result).forEach(([authorPermlink, comment]) => {
        if (comment.parent_author && comment.parent_permlink) {
          const wpAuthorPermlink = authorPermlink.replace("/", "_");
          const wpComment = mapHiveCommentToWPComment(comment, simpleHash(wpAuthorPermlink), postId, simpleHash(comment.author));
          wpComments.push(wpComment)
        }
      });
      res.json(wpComments);
    }
  }
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
