export interface Rendered {
  rendered: string;
}

export interface RenderedProtected extends Rendered {
  protected: boolean;
}

export interface WPPost {
  id: number;
  date: string; // Date
  date_gmt: string; // Date
  guid: Rendered;
  modified: string; // Date
  modified_gmt: string; // Date
  slug: string;
  status: "publish" | "future" | "draft" | "pending" | "private";
  type:  "post";
  link: string;
  title: Rendered;
  content: RenderedProtected;
  excerpt: RenderedProtected;
  author: number;
  featured_media: number;
  comment_status: "open" | "closed";
  ping_status: "open" | "closed";
  sticky: boolean;
  template: string;
  format: "standard" | "aside" | "chat" | "gallery" | "link" | "image" | "quote" | "status" | "video" | "audio";
  meta: Record<string, any>;
  categories: number[];
  tags: number[];
  class_list: string[];
  _embed?: {
    author: Array<{
      id: number;
      name: string;
      url: string;
      description: string;
      link: string;
      slug: string;
      avatar_urls: {
        24: string;
        48: string;
        96: string;
      },
    }>
  }
}

// export interface WPComment {
//   id: number;
//   post: number; // Post ID this comment is attached to
//   parent: number; // Parent comment ID (if it's a reply)
//   author: number; // User ID (0 if anonymous)
//   author_name: string;
//   author_email: string;
//   author_url: string;
//   date: string; // Date
//   date_gmt: string; // Date
//   content: Rendered;
//   link: string;
//   status: "approved";
//   type: "comment";
//   author_ip: string;
//   author_user_agent: string;
//   meta: string[];
//   author_avatar_urls: {
//     36: string;
//     48: string;
//     96: string; 
//   }
// }
export interface WPComment {
  id: number;
  post: number;
  parent: number;
  author: number;
  author_name: string;
  author_url: string;
  date: string; // Date
  date_gmt: string; // Date
  content: {
    rendered: string
  };
  link: string;
  status: "approved";
  type: "comment";
  author_avatar_urls: {
    24: string;
    48: string;
    96: string
  };
  meta: [];
}

export interface Content {
  rendered: string
}

export interface WPTag {
  id: number,
  count: number,
  description: string,
  link: string,
  name: string,
  slug: string,
  taxonomy: string,
  meta: []

}