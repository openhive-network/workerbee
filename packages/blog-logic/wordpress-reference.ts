export interface WPPost {
  id: number;
  date: string;
  date_gmt: string;
  guid: Rendered;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: "publish" | "future" | "draft" | "pending" | "private";
  type: string;
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
  format: string;
  meta: Record<string, any>;
  categories: number[];
  tags: number[];

  // Optional: Embedded or custom fields
  _links?: WPLinks;
  _embedded?: any; // Add specific types if using _embed
}

export interface Rendered {
  rendered: string;
}

export interface RenderedProtected extends Rendered {
  protected: boolean;
}

export interface WPLinks {
  self: WPLink[];
  collection: WPLink[];
  about: WPLink[];
  author: WPLink[];
  replies?: WPLink[];
  version_history?: WPLink[];
  "wp:featuredmedia"?: WPLink[];
  "wp:attachment"?: WPLink[];
  "wp:term"?: WPLink[];
  curies?: WPCurie[];
}

export interface WPLink {
  href: string;
}

export interface WPCurie {
  name: string;
  href: string;
  templated: boolean;
}

export interface WPComment {
  id: number;
  post: number; // Post ID this comment is attached to
  parent: number; // Parent comment ID (if it's a reply)
  author: number; // User ID (0 if anonymous)
  author_name: string;
  author_email: string;
  author_url: string;
  date: string;
  date_gmt: string;
  content: Rendered;
  link: string;
  status: string; // Usually 'approved' or 'hold'
  type: string; // Usually '' (empty string for normal comment)
  author_ip: string;
  author_user_agent: string;
  meta: Record<string, any>;

  _links?: WPLinks;
}
