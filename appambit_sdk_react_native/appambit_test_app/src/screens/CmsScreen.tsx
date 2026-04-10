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
  Modal,
  TextInput,
} from 'react-native';
import { AppAmbitCms } from 'appambit';
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
            <Text style={styles.category}>
              {Array.isArray(post.category)
                ? post.category.join(", ").toUpperCase()
                : typeof post.category === 'string'
                  ? post.category.toUpperCase()
                  : String(post.category).toUpperCase()}
            </Text>
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
            {post.likes !== undefined && <Text style={styles.metaSmall}>❤️ {post.likes}</Text>}
            {post.rating !== undefined && <Text style={styles.metaSmall}>⭐ {post.rating}/5</Text>}
            {post.reading_time !== undefined && <Text style={styles.metaSmall}>📖 {post.reading_time} min</Text>}
          </View>
        </View>
      </View>
    </View>
  );
}

function FilterButtons({ onFilter }: { onFilter: (query: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchText, setSearchText] = useState("");

  const options = [
    "All Posts",
    "Title = first",
    "Title ≠ first",
    "Is Published = true",
    "Is Published = false",
    "Title contains 'st'",
    "Title starts with 'f'",
    "Category IN [science]",
    "Category NOT IN [tech, news]",
    "Likes > 500",
    "Rating ≥ 2.1",
    "Reading Time < 15m",
    "Reading Time ≤ 15m",
    "Sort Title ↑",
    "Sort Title ↓",
    "Sort Likes ↑",
    "Sort Likes ↓",
    "Page 1 (2 per page)",
    "Page 2 (2 per page)"
  ];

  const handleRun = () => {
    let query = AppAmbitCms.content("blog_posts");

    if (searchText.trim().length > 0) {
      query = query.search(searchText.trim());
    }

    switch (selectedIndex) {
      case 1: query = query.equals("title", "first"); break;
      case 2: query = query.notEquals("title", "first"); break;
      case 3: query = query.equals("is_published", "true"); break;
      case 4: query = query.equals("is_published", "false"); break;
      case 5: query = query.contains("title", "st"); break;
      case 6: query = query.startsWith("title", "f"); break;
      case 7: query = query.inList("category", ["science"]); break;
      case 8: query = query.notInList("category", ["technology", "news"]); break;
      case 9: query = query.greaterThan("likes", 500); break;
      case 10: query = query.greaterThanOrEqual("rating", 2.1); break;
      case 11: query = query.lessThan("reading_time", 15); break;
      case 12: query = query.lessThanOrEqual("reading_time", 15); break;
      case 13: query = query.orderByAscending("title"); break;
      case 14: query = query.orderByDescending("title"); break;
      case 15: query = query.orderByAscending("likes"); break;
      case 16: query = query.orderByDescending("likes"); break;
      case 17: query = query.getPage(1).getPerPage(2); break;
      case 18: query = query.getPage(2).getPerPage(2); break;
    }
    
    onFilter(query);
  };

  return (
    <View style={styles.filterContainer}>
      <View style={styles.filterRow}>
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity 
            style={styles.dropdownBtn} 
            onPress={() => setExpanded(true)}
          >
            <Text style={styles.dropdownBtnText} numberOfLines={1}>
              {options[selectedIndex]}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          value={searchText}
          onChangeText={(val) => {
            setSearchText(val);
            if (val.length > 0 && selectedIndex !== 0) {
              setSelectedIndex(0);
            }
          }}
        />

        <TouchableOpacity style={styles.runBtn} onPress={handleRun}>
          <Text style={styles.runBtnText}>Run</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={expanded}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setExpanded(false)}
        >
          <View style={styles.modalContent}>
            <ScrollView>
              {options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedIndex(i);
                    setSearchText("");
                    setExpanded(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function CmsScreen() {
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load(AppAmbitCms.content('blog_posts'));
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
          <TouchableOpacity onPress={() => load(AppAmbitCms.content('blog_posts'))} style={styles.retryBtn}>
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
  filterContainer: {
    padding: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownWrapper: {
    flex: 1,
  },
  dropdownBtn: {
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dropdownBtnText: {
    fontSize: 14,
    color: '#374151',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  runBtn: {
    height: 40,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  runBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#111',
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
