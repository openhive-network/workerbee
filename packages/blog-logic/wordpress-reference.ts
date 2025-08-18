// https://developer.wordpress.org/rest-api/reference/

// REST API docs for wordpress

export interface WPPost {
  id: number;
  date: Date;
  date_gmt: Date;
  guid: Rendered;
  modified: Date;
  modified_gmt: Date;
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
  format: "standard" | "aside" | "chat" | "gallery" | "link" | "image" | "quote" | "status" | "video" | "audio";
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
  date: Date;
  date_gmt: Date;
  content: Rendered;
  link: string;
  status: "publish" | "future" | "draft" | "pending" | "private";
  type: string; // Usually '' (empty string for normal comment)
  author_ip: string;
  author_user_agent: string;
  meta: Record<string, any>;

  _links?: WPLinks;
}

export interface WPGetPostsParams {
  context?: "view" | "embed" | "edit";
  page?: number;
  per_page?: number;
  search?: string;
  after?: Date;                   // ISO 8601 date
  modified_after?: Date;          // ISO 8601 date
  before?: Date;                  // ISO 8601 date
  modified_before?: Date;         // ISO 8601 date
  author?: number | number[];
  author_exclude?: number | number[];
  exclude?: number | number[];
  include?: number | number[];
  offset?: number;
  order?: "asc" | "desc";
  orderby?: "author" | "date" | "id" | "include" | "modified" | "parent" | "relevance" | "slug" | "include_slugs" | "title";
  search_columns?: string[];
  slug?: string | string[];
  status?: string | string[];
  _fields?: string[];
}

export interface WPUser {
  id: number;
  username?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string
  url?: string;
  description?: string;
  link: string;
  locale?: string;
  nickname?: string;
  slug?: string;
  registered_date: string;
  roles?: string[];
  capabilities?: Record<string, boolean>;
  extra_capabilities?: Record<string, boolean>;
  avatar_urls: WPLink;
  meta?: Record<string, any>;
}

export interface WPGetCommentsParams {
  /**
   * Scope under which the request is made; determines which fields appear in the response.
   * One of: 'view', 'embed', 'edit'
   * Default: 'view'
   */
  context?: "view" | "embed" | "edit";

  /** Current page of pagination. Default: 1 */
  page?: number;

  /** Maximum number of items per page. Default: 10 */
  per_page?: number;

  /** Limit results to comments matching this search string */
  search?: string;

  /** Limit response to comments published after this ISO-8601 date-time */
  after?: string;

  /** Limit response to comments published before this ISO-8601 date-time */
  before?: string;

  /** Limit result set to comments assigned to specific user IDs (requires authorization) */
  author?: number[];

  /** Exclude comments assigned to specific user IDs (requires authorization) */
  author_exclude?: number[];

  /** Limit result set to comments from a specific author email (requires authorization) */
  author_email?: string;

  /** Ensure result set excludes specific comment IDs */
  exclude?: number[];

  /** Limit result set to specific comment IDs */
  include?: number[];

  /** Offset the result set by a specific number of items */
  offset?: number;

  /** Order by ascending or descending. Default: 'desc' */
  order?: "asc" | "desc";

  /**
   * Attribute to sort by.
   * Default: 'date_gmt'
   * One of: 'date', 'date_gmt', 'id', 'include', 'post', 'parent', 'type'
   */
  orderby?: "date" | "date_gmt" | "id" | "include" | "post" | "parent" | "type";

  /** Limit result set to comments with specific parent IDs */
  parent?: number[];

  /** Exclude comments with specific parent IDs */
  parent_exclude?: number[];

  /** Limit result set to comments assigned to specific post IDs */
  post?: number[];

  /**
   * Limit result set to comments with a specific status (requires authorization).
   * Example statuses include: 'approve'
   * Default: 'approve'
   */
  status?: string;

  /**
   * Limit result set to comments of a specific type (requires authorization).
   * Example: 'comment'
   * Default: 'comment'
   */
  type?: string;

  /** Password for password-protected posts */
  password?: string;
}