import express, { Request, Response } from "express";
import cors from "cors";
import { createHiveChain } from "@hiveio/wax";
import { Entry, ExtendedNodeApi } from "./hive";
import { mapHiveCommentToWPComment, mapHivePostToWpPost, mapHiveTagsToWpTags } from "./hiveToWpMap";
import { WPComment, WPPost } from "./wp-reference";
import { simpleHash } from "./hash-utils";
import { wordPressExampleConfig } from "./example-config";

const hiveChain = await createHiveChain();
const extendedHiveChain = hiveChain.extend<ExtendedNodeApi>();

const app = express();
const PORT = wordPressExampleConfig.defaultPort;

// Middleware to parse JSON
app.use(express.json());
app.use(cors());
const apiRouter = express.Router();

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

const mapAndAddPostsToMap = (posts: Entry[]): WPPost[] => { 
  const mappedPosts: WPPost[] = []
  posts.forEach((post) => {
    const postId = simpleHash(`${post.author}_${post.permlink}`);
    const authorId = simpleHash(post.author);
    idToStringMap.set(postId, `${post.author}_${post.permlink}`).set(authorId, post.author);
    mappedPosts.push(mapHivePostToWpPost(post, postId, authorId));
  });
  return mappedPosts;
}


apiRouter.get("/posts", async (req: Request, res: Response) => {
  // Default WP call for devtools
  if (req.query.slug === "com.chrome.devtools.json") res.json([]);
  // Single post
  else if (!!req.query.slug) {
    const {author, permlink} = getAuthorPermlinkFromSlug(req.query.slug as string);
    const authorPermlinkHash = simpleHash(req.query.slug);
    const authorHash = simpleHash(author);
    idToStringMap.set(authorPermlinkHash, req.query.slug as string).set(authorHash, author);
    const result = await extendedHiveChain.api.bridge.get_post({author, permlink, observer: "hive.blog"});
    if (result) {
      res.json(mapHivePostToWpPost(result, authorPermlinkHash, authorHash));
    } else {
      res.status(404).json({ error: "Post not found" });
    }
    // Posts list
  } else {
    const result = await extendedHiveChain.api.bridge.get_ranked_posts({
      limit: wordPressExampleConfig.postLimit, 
      sort: wordPressExampleConfig.sort, 
      observer: wordPressExampleConfig.observer, 
      start_author: wordPressExampleConfig.startAuthor, 
      start_permlink: wordPressExampleConfig.startPermlink, 
      tag: wordPressExampleConfig.postTag
    });
    if (result) {
      res.json(mapAndAddPostsToMap(result));
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
      res.json(wpComments)
    }
  } else {
    res.json([]);
  }
});

apiRouter.get("/tags", (req: Request, res: Response) => {
  res.json([]);
});

apiRouter.get("/categories", (req: Request, res: Response) => {
  res.json([]);
});

apiRouter.get("/users", (req: Request, res: Response) => {
  res.json([]);
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
