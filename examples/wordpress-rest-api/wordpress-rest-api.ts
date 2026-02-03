import express, { Request, Response } from "express";
import cors from "cors";
import { createHiveChain } from "@hiveio/wax";
import { ExtendedNodeApi } from "./hive";
import { mapIPostToWpPost, mapIReplyToWPComment } from "./hiveToWpMap";
import { WPComment, WPPost } from "./wp-reference";
import { simpleHash } from "./hash-utils";
import { wordPressExampleConfig } from "./example-config";
import { IPost, IReply } from "../../packages/blog-logic/interfaces";
import { BloggingPlatform } from "../../packages/blog-logic/BloggingPlatform";
import { DataProvider } from "../../packages/blog-logic/DataProvider";
import { getWax } from "../../packages/blog-logic/wax";

const hiveChain = await createHiveChain();

const app = express();
const PORT = wordPressExampleConfig.defaultPort;

// Middleware to parse JSON
app.use(express.json());
app.use(cors());
const apiRouter = express.Router();

const idToStringMap = new Map<number, string>();

const chain = await getWax()
const dataProvider = new DataProvider(chain);
dataProvider.bloggingPlatform.configureViewContext({name: wordPressExampleConfig.observer});

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

const mapAndAddtoMapPosts = async (posts: IPost[]): Promise<WPPost[]> => { 
  const mappedPosts: WPPost[] = [];
  await Promise.all(posts.map(async (post) => {
    const postId = simpleHash(`${post.author}_${post.permlink}`);
    const authorId = simpleHash(post.author);
    idToStringMap.set(postId, `${post.author}_${post.permlink}`).set(authorId, post.author);
    posts.push(post);
    mappedPosts.push(await mapIPostToWpPost(post, postId, authorId));
  })); 
  return mappedPosts;
}


const mapReplies = async (replies: IReply[], postId: number) : Promise<WPComment[]> => {
  const wpComments: WPComment[] = [];
  await Promise.all(  replies.map( async (reply) => {
    if (reply.author && reply.permlink) {
      const wpAuthorPermlink = reply.getSlug();
      const wpComment = await mapIReplyToWPComment(reply, simpleHash(wpAuthorPermlink), postId, simpleHash(reply.author));
      wpComments.push(wpComment)
    }
  }));
  return await wpComments;
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
    const post = await dataProvider.bloggingPlatform.getPost({author: author, permlink});
    if (post) {
      res.json(await mapIPostToWpPost(post, authorPermlinkHash, authorHash));
    } else {
      res.status(404).json({ error: "Post not found" });
    }
    // Posts list
  } else {
    const newPosts = await dataProvider.bloggingPlatform.enumPosts({
      sort: wordPressExampleConfig.sort,
      tag: wordPressExampleConfig.postTag
    }, {
      page: 1,
      pageSize: wordPressExampleConfig.postLimit
    }) as IPost[];
    res.json(await mapAndAddtoMapPosts(newPosts));
  }

});

apiRouter.get("/comments", async (req: Request, res: Response) => {
  const postId = Number(req.query.post);
  const postParent = idToStringMap.get(postId);
  if (postParent) {
    const {author, permlink} = getAuthorPermlinkFromSlug(postParent);
    // Delete array of posts, get replies here.
    const post = await dataProvider.bloggingPlatform.getPost({author, permlink})
    if (post) {
      const replies = await post.enumReplies({}, {page: 1, pageSize: 1000}) as IReply[];
      if (replies) {
        res.json(await mapReplies(replies, postId))
      }
    }
  } else {
    res.json([]);
  }
});

apiRouter.get("/test-votes", async (req: Request, res: Response) => {
  const voteTestId = {author: "theycallmedan", permlink: "i-have-returned"};
  const post = await dataProvider.bloggingPlatform.getPost(voteTestId);
  const votes = await post.enumVotes({limit: 1000, votesSort: "by_comment_voter"}, {page: 1, pageSize: 1000});
  res.json(votes);
})

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
