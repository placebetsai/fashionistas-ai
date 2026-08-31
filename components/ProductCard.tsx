interface ProductCardProps {
  name: string;
  brand: string;
  price: string;
  originalPrice?: string;
  image?: string;
  affiliateUrl: string;
  category?: string;
  tag?: string;
}

export default function ProductCard({ name, brand, price, originalPrice, affiliateUrl, category, tag }: ProductCardProps) {
  return (
    <a
      href={affiliateUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
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
        e.currentTarget.style.borderColor = 'rgba(212,165,116,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      <div style={{
        width: '100%',
        height: 200,
        backgroundColor: 'var(--bg-card-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {tag && (
          <span style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'linear-gradient(135deg, var(--accent-gold), #c49464)',
            color: 'var(--bg-primary)',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
          }}>{tag}</span>
        )}
        <span style={{
          color: 'var(--text-muted)',
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
        }}>{brand}</span>
      </div>
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {category && (
          <p style={{ color: 'var(--accent-gold)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4, fontFamily: 'system-ui, sans-serif' }}>{category}</p>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontFamily: 'system-ui, sans-serif' }}>{brand}</p>
        <p style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 12, flex: 1 }}>{name}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent-blush)', fontWeight: 700, fontSize: 16 }}>{price}</span>
            {originalPrice && (
              <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: 13 }}>{originalPrice}</span>
            )}
          </div>
          <span style={{
            background: 'linear-gradient(135deg, var(--accent-gold), #c49464)',
            color: 'var(--bg-primary)',
            padding: '6px 14px',
            borderRadius: 16,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
          }}>Shop Now</span>
        </div>
      </div>
    </a>
  );
}
