export interface CmsAuthor {
    id: string;
    author: string;
    published_at?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CmsPost {
    id: string;
    title: string;
    body: string;
    category?: string;
    author?: CmsAuthor | null;
    likes?: number;
    rating?: number;
    reading_time?: number;
    meta_data?: Record<string, any> | any[];
    event_date?: string;
    views_count?: number | string;
    author_email?: string | null;
    is_published?: boolean;
    featured_image?: string | null;
    scheduled_publish_at?: string | null;
    published_at?: string;
    created_at?: string;
    updated_at?: string;
}
