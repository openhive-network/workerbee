import express, { Request, Response } from "express";
import cors from "cors";
import { BlogPostOperation, createHiveChain } from "@hiveio/wax";
import { Entry, ExtendedNodeApi } from "./hive";
import { mapHiveCommentToWPComment, mapHivePostToWpPost, mapHiveTagsToWpTags, mapIPostToWpPost, mapIReplyToWPComment } from "./hiveToWpMap";
import { WPComment, WPPost } from "./wp-reference";
import { simpleHash } from "./hash-utils";
import { wordPressExampleConfig } from "./example-config";
import { IPost, IReply } from "../../packages/blog-logic/interfaces";
import { BloggingPlaform } from "../../packages/blog-logic/BloggingPlatform";

const hiveChain = await createHiveChain();
const extendedHiveChain = hiveChain.extend<ExtendedNodeApi>();

const app = express();
const PORT = wordPressExampleConfig.defaultPort;

// Middleware to parse JSON
app.use(express.json());
app.use(cors());
const apiRouter = express.Router();

const idToStringMap = new Map<number, string>();

const posts: IPost[] = [];
const bloggingPlatform: BloggingPlaform = new BloggingPlaform();

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


const mapAndAddtoMapPosts = async (posts: IPost[]): Promise<WPPost[]> => { 
  const mappedPosts: WPPost[] = [];
  posts.forEach(async (post) => {
    const postId = simpleHash(`${post.author.name}_${post.permlink}`);
    const authorId = simpleHash(post.author.name);
    idToStringMap.set(postId, `${post.author.name}_${post.permlink}`).set(authorId, post.author.name);
    posts.push(post);
    mappedPosts.push(await mapIPostToWpPost(post, postId, authorId));
  });
  return await mappedPosts;
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
    const post = await bloggingPlatform.getPost({author: {name: author}, permlink});
    posts.push(post);
    if (post) {
      res.json(await mapIPostToWpPost(post, authorPermlinkHash, authorHash));
    } else {
      res.status(404).json({ error: "Post not found" });
    }
    // Posts list
  } else {
    const posts = await bloggingPlatform.enumPosts({
      limit: wordPressExampleConfig.postLimit, 
      sort: wordPressExampleConfig.sort, 
      startAuthor: wordPressExampleConfig.startAuthor, 
      startPermlink: wordPressExampleConfig.startPermlink, 
      tag: wordPressExampleConfig.postTag
    }, {
      page: 1,
      pageSize: 10
    }) as IPost[];
    if (posts) {
      res.json(await mapAndAddtoMapPosts(posts));
    }
  }

});

apiRouter.get("/comments", async (req: Request, res: Response) => {
  const postId = Number(req.query.post);
  const postParent = idToStringMap.get(postId);
  if (postParent) {
    const {author, permlink} = getAuthorPermlinkFromSlug(postParent);
    const post = posts.find((post) => post.author.name === author && post.permlink === permlink);
    if (post) {
      const replies = await post.enumReplies({}, {page: 1, pageSize: 10}) as IReply[];
      if (replies) {
        const wpComments: WPComment[] = []
        Object.entries(replies).forEach( async ([authorPermlink, reply]) => {
          if (reply.author.name && reply.permlink) {
            const wpAuthorPermlink = authorPermlink.replace("/", "_");
            const wpComment = await mapIReplyToWPComment(reply, simpleHash(wpAuthorPermlink), postId, simpleHash(reply.author.name));
            wpComments.push(wpComment)
          }
        });
        res.json(wpComments)
      }
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
