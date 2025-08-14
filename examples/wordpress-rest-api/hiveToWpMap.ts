import { simpleHash } from "./hash-utils";
import { Entry } from "./hive";
import { WPComment, WPPost, WPTag, WPTerm } from "./wp-reference";
import { DefaultRenderer } from "@hiveio/content-renderer";

const renderer = new DefaultRenderer({
    baseUrl: "https://hive.blog/",
    breaks: true,
    skipSanitization: false,
    allowInsecureScriptTags: false,
    addNofollowToLinks: true,
    doNotShowImages: false,
    assetsWidth: 640,
    assetsHeight: 480,
    imageProxyFn: (url: string) => url,
    usertagUrlFn: (account: string) => "https://hive.blog/@" + account,
    hashtagUrlFn: (hashtag: string) => "https://hive.blog/trending/" + hashtag,
    isLinkSafeFn: (url: string) => true,
    addExternalCssClassToMatchingLinksFn: (url: string) => true,
    ipfsPrefix: "https://ipfs.io/ipfs/" // IPFS gateway to display ipfs images
});

const mapWpTerm = (termName: string, type: "tag" | "category"): WPTerm => {
  const termId = simpleHash(termName);
  const taxonomy: string = type === "tag" ? "post_tag" : "category";
  const wpTerm: WPTerm = {
    id: termId,
    link: `http://localhost/${type}/${termName}/`,
    name: termName,
    slug: termName.toLocaleLowerCase(),
    taxonomy,
  };
  return wpTerm;
}


export const mapHivePostToWpPost = (hivePost: Entry, wpId: number, accountId: number): WPPost => {
  const slug = `${hivePost.author}_${hivePost.permlink}`;
  const tags  = hivePost.json_metadata?.tags || [];
  const wpTermTags = tags.map((tag) => mapWpTerm(tag, "tag"));
  const community = hivePost.community_title;
  const wpTermCategory = community ? [mapWpTerm(community, "category")] : [];
  const renderedBody = renderer.render(hivePost.body);
  const wpExcerpt = renderedBody.replace(/<[^>]+>/g, '').substring(0, 100);
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
    content: { rendered: renderedBody, protected: false },
    excerpt: { rendered: wpExcerpt, protected: false },
    author: accountId,
    featured_media: 0,
    comment_status: "open",
    ping_status: "open",
    sticky: false,
    template: "",
    format: "standard",
    meta: {},
    categories: [community ? simpleHash(community) : 0],
    tags: tags.map((tags) => simpleHash(tags)),
    guid: { rendered: `http://host/?p=${wpId}` },
    class_list: [`category-${community}`],
    _embedded: {
      replies: [],
      author: [{
        id: accountId,
        name: hivePost.author,
        url: `https://hive.blog/@${hivePost.author}`,
        description: "",
        link: `https://hive.blog/@${hivePost.author}`,
        slug: hivePost.author,
        avatar_urls: {
          24: `https://images.hive.blog/u/${hivePost.author}/avatar`,
          48: `https://images.hive.blog/u/${hivePost.author}/avatar`,
          96: `https://images.hive.blog/u/${hivePost.author}/avatar`
        }
      }],
      "wp:term": [...wpTermTags.map((wpTerm) => [wpTerm]), ...wpTermCategory.map((wpTerm) => [wpTerm])]
    }
  };
  return wpPost
}

export const mapHiveCommentToWPComment = (hiveComment: Entry, commentId: number, mainPostId: number, authorId: number): WPComment => {
  const parentId = simpleHash(`${hiveComment.parent_author}_${hiveComment.parent_permlink}`);
  const renderedBody = renderer.render(hiveComment.body);
  const wpComment: WPComment = {
    id: commentId,
    post: mainPostId,
    parent: parentId === mainPostId ? 0 : parentId, // There is no id for parent post 
    author: authorId,
    author_name: hiveComment.author,
    author_url: `https://hive.blog/@${hiveComment.author}`,
    date: new Date(hiveComment.created).toISOString(),
    date_gmt: new Date(hiveComment.created).toISOString(),
    content: { rendered: renderedBody },
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

// For later use
export const mapHiveTagsToWpTags = (tagSlug: string): WPTag => {
  return {
    id: 1,
    count: 1,
    description: "",
    link: `http://localhost/tag/${tagSlug}/`,
    name: tagSlug,
    slug: tagSlug,
    taxonomy: "post_tag",
    meta: []
  }
}
