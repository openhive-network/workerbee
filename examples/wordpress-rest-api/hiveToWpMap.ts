import { simpleHash } from "./hash-utils";
import { Entry } from "./hive";
import { WPComment, WPPost } from "./wp-reference";

export const mapHivePostToWpPost = (hivePost: Entry, wpId: number, accountId: number): WPPost => {
  const slug = `${hivePost.author}_${hivePost.permlink}`;
  const wpPost: WPPost = {
    id:wpId,
    slug,  
    date: new Date(hivePost.created).toISOString(),
    date_gmt: new Date(hivePost.created).toISOString(),
    modified: new Date(hivePost.updated).toISOString(),
    modified_gmt: new Date(hivePost.updated).toISOString(),
    status: "publish",
    type: "post",
    link: `http://host/${slug}/`,
    title: { rendered: hivePost.title },
    content: { rendered: hivePost.body, protected: false },
    excerpt: { rendered: hivePost.body.substring(0, 100), protected: false },
    author: accountId,
    featured_media: 0,
    comment_status: "open",
    ping_status: "open",
    sticky: false,
    template: "",
    format: "standard",
    meta: {},
    categories: [],
    tags: [],
    guid: { rendered: `http://host/?p=${wpId}` },
    class_list: []
  };

  return wpPost
}

export const mapHiveCommentToWPComment = (hiveComment: Entry, commentId: number, mainPostId: number, authorId: number): WPComment => {
  const parentId = simpleHash(`${hiveComment.parent_author}_${hiveComment.parent_permlink}`);
  const wpComment: WPComment = {
    id: commentId,
    post: mainPostId,
    parent: parentId === mainPostId ? 0 : parentId, // There is no id for parent post 
    author: authorId,
    author_name: hiveComment.author,
    author_url: `https://hive.blog/@${hiveComment.author}`,
    date: new Date(hiveComment.created).toISOString(),
    date_gmt: new Date(hiveComment.created).toISOString(),
    content: { rendered: hiveComment.body },
    link: `http://host/${hiveComment.parent_author}_${hiveComment.parent_permlink}/#comment-${commentId}`,
    status: "approved",
    type: "comment",
    meta: [],
    author_avatar_urls: {
      24: `https://images.hive.blog/u/${hiveComment.author}/avatar`,
      48: `https://images.hive.blog/u/${hiveComment.author}/avatar`,
      96: `https://images.hive.blog/u/${hiveComment.author}/avatar`
    }
  }
return wpComment;
}
