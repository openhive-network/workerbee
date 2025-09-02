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
  class_list: string[];
}