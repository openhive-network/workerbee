import express, { Request, Response } from "express";
import cors from "cors";
import { categoryHive } from "./mocks/categories";
import { comments1, comments2, comments3 } from "./mocks/comments";
import { allPosts, post1, post2, post3 } from "./mocks/posts";
import { tagMock } from "./mocks/tags";
import { userWordPress } from "./mocks/users";

const app = express();
const PORT = 4000;

// Middleware to parse JSON
app.use(express.json());
app.use(cors())

// ✅ All routes inside this router will start with /wp-json/wp/v2
const apiRouter = express.Router();

apiRouter.get("/posts", (req: Request, res: Response) => {
  if (req.query.slug === "hello-world")
    res.json(post1);
  else if (req.query.slug === "test-post")
    res.json(post2);
  else if (req.query.slug === "best-mock-post")
    res.json(post3);
  else if (req.query.page === "1")
    res.json(allPosts);

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
