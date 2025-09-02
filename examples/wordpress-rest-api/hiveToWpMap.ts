import { Entry } from "./hive";
import { WPPost } from "./wp-reference";

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
