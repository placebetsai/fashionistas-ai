interface ArticleCardProps {
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  date?: string;
  href: string;
  image?: string;
}

export default function ArticleCard({ title, excerpt, category, readTime, date, href }: ArticleCardProps) {
  return (
    <a
      href={href}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{
        width: '100%',
        height: 180,
        backgroundColor: 'var(--bg-card-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{
          position: 'absolute',
          top: 12,
          left: 12,
          backgroundColor: 'rgba(10,10,10,0.7)',
          backdropFilter: 'blur(8px)',
          color: 'var(--accent-gold)',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
          textTransform: 'uppercase' as const,
          letterSpacing: '1px',
          border: '1px solid rgba(212,165,116,0.2)',
        }}>{category}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 24 }}>📰</span>
      </div>
      <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: 17, lineHeight: 1.4, marginBottom: 8, fontWeight: 600 }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 14, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{excerpt}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>{readTime}</span>
          {date && <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>{date}</span>}
          <span style={{ color: 'var(--accent-gold)', fontSize: 12, fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>Read More →</span>
        </div>
      </div>
    </a>
  );
}
