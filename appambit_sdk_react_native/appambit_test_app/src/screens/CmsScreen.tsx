import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { cms } from 'appambit';
import type { CmsPost } from '../CmsPost';

function formatViews(count?: number | string): string {
  const n = Number(count);
  if (isNaN(n)) return '–';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function stripHtml(html?: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

function extractPosts(raw: any): CmsPost[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.data && Array.isArray(raw.data)) return raw.data;
  if (typeof raw === 'object' && typeof raw.length === 'number') {
    const posts: CmsPost[] = [];
    for (let i = 0; i < raw.length; i++) posts.push(raw[i]);
    return posts;
  }
  return [];
}

function PostCard({ post }: { post: CmsPost }) {
  const authorName = post.author?.author ?? post.author_email ?? null;
  const bodyText = stripHtml(post.body);

  return (
    <View style={styles.card}>
      {post.featured_image ? (
        <Image
          source={{ uri: post.featured_image }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          {post.category ? (
            <Text style={styles.category}>{post.category.toUpperCase()}</Text>
          ) : null}
          <Text style={[styles.status, { color: post.is_published ? '#16a34a' : '#9ca3af' }]}>
            {post.is_published ? '● Published' : '○ Draft'}
          </Text>
        </View>

        <Text style={styles.title}>{post.title}</Text>

        {bodyText.length > 0 && (
          <Text style={styles.bodyPreview} numberOfLines={2}>{bodyText}</Text>
        )}

        <View style={styles.cardRow}>
          {authorName ? (
            <Text style={styles.meta} numberOfLines={1}>{authorName}</Text>
          ) : null}
          <View style={styles.cardRowRight}>
            <Text style={styles.metaSmall}>Views {formatViews(post.views_count)}</Text>
            {post.event_date ? (
              <Text style={styles.metaSmall}>Date {post.event_date}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function FilterButtons({ onFilter }: { onFilter: (query: any) => void }) {
  const [activeFilter, setActiveFilter] = useState("All Posts");
  const baseQuery = () => cms().content('blog_extended');

  const filters = [
    { label: "All Posts", apply: () => baseQuery() },
    { label: "Category = tech", apply: () => baseQuery().equals("category", "tech") },
    { label: "Category ≠ tech", apply: () => baseQuery().notEquals("category", "tech") },
    { label: "Search 'swift'", apply: () => baseQuery().search("swift") },
    { label: "Title contains 't1'", apply: () => baseQuery().contains("title", "t1") },
    { label: "Category starts with 'n'", apply: () => baseQuery().startsWith("category", "n") },
    { label: "Category IN [science, tech]", apply: () => baseQuery().inList("category", ["science", "tech"]) },
    { label: "Category NOT IN [tech, news]", apply: () => baseQuery().notInList("category", ["tech", "news"]) },
    { label: "Views > 1000", apply: () => baseQuery().greaterThan("views_count", 1000) },
    { label: "Views ≥ 555", apply: () => baseQuery().greaterThanOrEqual("views_count", 555) },
    { label: "Views < 15000", apply: () => baseQuery().lessThan("views_count", 15000) },
    { label: "Views ≤ 15000", apply: () => baseQuery().lessThanOrEqual("views_count", 15000) },
    { label: "Sort Title ↑", apply: () => baseQuery().orderByAscending("title") },
    { label: "Sort Title ↓", apply: () => baseQuery().orderByDescending("title") },
    { label: "Page 1 (2 per page)", apply: () => baseQuery().getPage(1).getPerPage(2) },
  ];

  return (
    <View style={styles.filtersWrapper}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {filters.map((f, i) => {
          const isActive = activeFilter === f.label;
          return (
            <TouchableOpacity 
              key={i} 
              style={[styles.filterBtn, isActive && styles.filterBtnActive]} 
              onPress={() => {
                setActiveFilter(f.label);
                onFilter(f.apply());
              }}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function CmsScreen() {
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load(cms().content('blog_extended'));
  }, []);

  const load = async (query: any) => {
    try {
      setLoading(true);
      setError(null);
      const raw = await query.getList();
      console.log(raw);
      const items = extractPosts(raw);
      console.log(items);
      setPosts(items);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CMS Posts</Text>
        <Text style={styles.headerCount}>{posts.length} posts</Text>
      </View>
      
      <FilterButtons onFilter={load} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(cms().content('blog_extended'))} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={posts}
          keyExtractor={(item, index) => item?.id ?? String(index)}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No posts found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filtersWrapper: {
    height: 44,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    justifyContent: 'center',
  },
  filtersContainer: {
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center',
  },
  filterBtn: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    height: 28,
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  filterTextActive: {
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  headerCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  list: {
    padding: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardBody: {
    padding: 12,
    gap: 6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  cardRowRight: {
    flexDirection: 'row',
    gap: 10,
  },
  category: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 0.6,
  },
  status: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    lineHeight: 21,
  },
  bodyPreview: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
  },
  meta: {
    fontSize: 12,
    color: '#9ca3af',
    flex: 1,
  },
  metaSmall: {
    fontSize: 11,
    color: '#9ca3af',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  retryBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
