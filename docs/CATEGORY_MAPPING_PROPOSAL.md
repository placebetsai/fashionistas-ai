# Category mapping proposal (local branch only, not deployed)

Current: AI + schema support 6 flat categories (Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories).
No department (Women/Men/Kids), no subcategory, no per-shop category IDs, no item specifics.
eBay maps to 6 rough leaf IDs (fallback 11450 root, rejected by Inventory API); Etsy hardcodes taxonomy 2078.
Extension types category text into autocomplete and clicks first suggestion.

## Proposed internal taxonomy: department > category > subcategory
Departments: Women, Men, Kids, Unisex, Home, Art, Beauty, Electronics.
Each subcategory row carries: depop, poshmark, mercari, vinted, grailed(Men/Women only), ebay_leaf_id, etsy_taxonomy_id, size_system, required_specifics.

## Fields to add
department, subcategory, size_system (US letter/numeric/shoe/one-size), material, style,
pattern, sleeve/length (eBay specifics), dimensions + weight (shipping, home/art), quantity,
gender for Grailed (menswear/womenswear), Etsy who_made/when_made/is_supply, Vinted package size,
Poshmark original price, Mercari shipping weight class.
