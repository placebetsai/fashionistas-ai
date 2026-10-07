/**
 * fashionistas.ai category table — ONE row per subcategory, the single source
 * of truth for the listing form, the AI vision prompt, eBay, Etsy and the
 * extension. Stored value on a listing is "Dept/Sub" (e.g. "Women/Tops").
 *
 * ebay.id     US leaf category id. verified:true = checked against eBay's own
 *             category file (ir.ebaystatic.com US_CategoryChanges_Oct2019 /
 *             fashion_item_specifics). verified:false = best known id; the eBay
 *             route asks eBay's Taxonomy API for a suggestion first and only
 *             falls back to this id.
 * etsy        Etsy seller-taxonomy path (names). The Etsy route resolves the
 *             numeric taxonomy_id from Etsy's live tree by name at post time.
 * shops       per-marketplace category path, as the shop's own picker labels
 *             it. null = that shop has no such category: skip it, never guess.
 * size        size system for the per-category size picker.
 * place       buyer preview mode: clothing (Try it on) | wall | floor | none.
 *
 * Regenerate the browser + extension copies after editing:
 *   node scripts/gen-categories.mjs
 */
const R = (dept, sub, group, size, place, ebayId, ebayVerified, depop, poshmark, mercari, vinted, grailed, etsy) => ({
  dept, sub, path: dept + "/" + sub, group, size, place,
  ebay: { id: String(ebayId), verified: !!ebayVerified },
  etsy,
  shops: { depop, poshmark, mercari, vinted, grailed },
});

export const DEPARTMENTS = ["Women", "Men", "Kids", "Home", "Art"];

export const CATEGORIES = [
  // ---------------- WOMEN ----------------
  R("Women","Tops","clothing","women_alpha","clothing",53159,1,"Womenswear > Tops","Women > Tops","Women > Tops & blouses","Women > Clothing > Tops & t-shirts","Womenswear > Tops","Clothing > Women's Clothing > Tops & Tees"),
  R("Women","Sweaters","clothing","women_alpha","clothing",63866,1,"Womenswear > Tops > Jumpers","Women > Sweaters","Women > Sweaters","Women > Clothing > Jumpers & sweaters","Womenswear > Tops > Sweaters","Clothing > Women's Clothing > Sweaters"),
  R("Women","Dresses","clothing","women_alpha","clothing",63861,1,"Womenswear > Dresses","Women > Dresses","Women > Dresses","Women > Clothing > Dresses","Womenswear > Dresses","Clothing > Women's Clothing > Dresses"),
  R("Women","Jumpsuits & Rompers","clothing","women_alpha","clothing",3009,1,"Womenswear > Jumpsuits & playsuits","Women > Pants & Jumpsuits","Women > Jumpsuits & rompers","Women > Clothing > Jumpsuits & playsuits","Womenswear > Jumpsuits","Clothing > Women's Clothing > Jumpsuits & Rompers"),
  R("Women","Coats & Jackets","clothing","women_alpha","clothing",63862,1,"Womenswear > Coats & jackets","Women > Jackets & Coats","Women > Coats & jackets","Women > Clothing > Outerwear","Womenswear > Outerwear","Clothing > Women's Clothing > Jackets & Coats"),
  R("Women","Jeans","clothing","women_numeric","clothing",11554,1,"Womenswear > Bottoms > Jeans","Women > Jeans","Women > Jeans","Women > Clothing > Jeans","Womenswear > Bottoms > Jeans","Clothing > Women's Clothing > Jeans"),
  R("Women","Pants","clothing","women_numeric","clothing",63863,1,"Womenswear > Bottoms > Trousers","Women > Pants & Jumpsuits","Women > Pants","Women > Clothing > Trousers","Womenswear > Bottoms > Pants","Clothing > Women's Clothing > Pants & Capris"),
  R("Women","Skirts","clothing","women_alpha","clothing",63864,1,"Womenswear > Bottoms > Skirts","Women > Skirts","Women > Skirts","Women > Clothing > Skirts","Womenswear > Bottoms > Skirts","Clothing > Women's Clothing > Skirts"),
  R("Women","Shorts","clothing","women_alpha","clothing",11555,1,"Womenswear > Bottoms > Shorts","Women > Shorts","Women > Shorts","Women > Clothing > Shorts","Womenswear > Bottoms > Shorts","Clothing > Women's Clothing > Shorts"),
  R("Women","Activewear","clothing","women_alpha","clothing",185098,0,"Womenswear > Activewear","Women > Activewear","Women > Athletic apparel","Women > Clothing > Activewear","Womenswear > Activewear","Clothing > Women's Clothing > Activewear"),
  R("Women","Swimwear","clothing","women_alpha","clothing",63867,1,"Womenswear > Swimwear","Women > Swim","Women > Swimwear","Women > Clothing > Swimwear","Womenswear > Swimwear","Clothing > Women's Clothing > Swimwear"),
  R("Women","Heels","shoes","women_shoe","clothing",55793,1,"Womenswear > Footwear > Heels","Women > Shoes > Heels","Women > Shoes > Heels","Women > Shoes > Heels","Womenswear > Footwear > Heels","Shoes > Women's Shoes > Heels"),
  R("Women","Flats","shoes","women_shoe","clothing",45333,1,"Womenswear > Footwear > Flats","Women > Shoes > Flats & Loafers","Women > Shoes > Flats","Women > Shoes > Flats","Womenswear > Footwear > Flats","Shoes > Women's Shoes > Flats"),
  R("Women","Boots","shoes","women_shoe","clothing",53557,1,"Womenswear > Footwear > Boots","Women > Shoes > Ankle Boots & Booties","Women > Shoes > Boots","Women > Shoes > Boots","Womenswear > Footwear > Boots","Shoes > Women's Shoes > Boots"),
  R("Women","Sneakers","shoes","women_shoe","clothing",95672,1,"Womenswear > Footwear > Trainers","Women > Shoes > Sneakers","Women > Shoes > Athletic","Women > Shoes > Trainers","Womenswear > Footwear > Sneakers","Shoes > Women's Shoes > Sneakers & Athletic Shoes"),
  R("Women","Sandals","shoes","women_shoe","clothing",62107,1,"Womenswear > Footwear > Sandals","Women > Shoes > Sandals","Women > Shoes > Sandals","Women > Shoes > Sandals","Womenswear > Footwear > Sandals","Shoes > Women's Shoes > Sandals"),
  R("Women","Bags & Handbags","bags","one_size","clothing",169291,1,"Womenswear > Accessories > Bags & purses","Women > Bags","Women > Women's handbags","Women > Bags","Womenswear > Bags & Luggage","Bags & Purses > Handbags"),
  R("Women","Jewelry","jewelry","ring_or_one","clothing",155101,0,"Womenswear > Accessories > Jewellery","Women > Jewelry","Women > Jewelry","Women > Accessories > Jewellery","Womenswear > Jewelry","Jewelry"),
  R("Women","Watches","jewelry","one_size","clothing",31387,0,"Womenswear > Accessories > Watches","Women > Accessories > Watches","Women > Women's accessories > Watches","Women > Accessories > Watches","Womenswear > Accessories > Watches","Jewelry > Watches"),
  R("Women","Hats","accessory","one_size","clothing",45230,1,"Womenswear > Accessories > Hats","Women > Accessories > Hats","Women > Women's accessories > Hats","Women > Accessories > Hats & caps","Womenswear > Accessories > Hats","Accessories > Hats & Caps"),
  R("Women","Belts","accessory","belt","clothing",3003,1,"Womenswear > Accessories > Belts","Women > Accessories > Belts","Women > Women's accessories > Belts","Women > Accessories > Belts","Womenswear > Accessories > Belts","Accessories > Belts & Suspenders"),
  R("Women","Scarves","accessory","one_size","clothing",45238,1,"Womenswear > Accessories > Scarves","Women > Accessories > Scarves & Wraps","Women > Women's accessories > Scarves & wraps","Women > Accessories > Scarves & shawls","Womenswear > Accessories > Scarves","Accessories > Scarves & Wraps"),
  R("Women","Sunglasses","accessory","one_size","clothing",179247,0,"Womenswear > Accessories > Sunglasses","Women > Accessories > Sunglasses","Women > Women's accessories > Sunglasses","Women > Accessories > Sunglasses","Womenswear > Accessories > Sunglasses","Accessories > Sunglasses & Eyewear"),
  R("Women","Wallets","accessory","one_size","none",45258,1,"Womenswear > Accessories > Purses & wallets","Women > Bags > Wallets","Women > Women's accessories > Wallets","Women > Bags > Wallets & purses","Womenswear > Accessories > Wallets","Bags & Purses > Wallets & Money Clips"),
  // ---------------- MEN ----------------
  R("Men","T-Shirts","clothing","men_alpha","clothing",15687,1,"Menswear > Tops > T-shirts","Men > Shirts > Tees - Short Sleeve","Men > Tops > T-shirts","Men > Clothing > Tops & t-shirts","Menswear > Tops > Short Sleeve T-Shirts","Clothing > Men's Clothing > Shirts & Tees"),
  R("Men","Button-Down Shirts","clothing","men_alpha","clothing",57990,1,"Menswear > Tops > Shirts","Men > Shirts > Casual Button Down Shirts","Men > Tops > Button-front shirts","Men > Clothing > Shirts","Menswear > Tops > Shirts (Button Ups)","Clothing > Men's Clothing > Shirts & Tees"),
  R("Men","Polos","clothing","men_alpha","clothing",185101,0,"Menswear > Tops > Polo shirts","Men > Shirts > Polos","Men > Tops > Polos","Men > Clothing > Tops & t-shirts","Menswear > Tops > Polos","Clothing > Men's Clothing > Shirts & Tees"),
  R("Men","Sweaters","clothing","men_alpha","clothing",11484,1,"Menswear > Tops > Jumpers","Men > Sweaters","Men > Sweaters","Men > Clothing > Jumpers & sweaters","Menswear > Tops > Sweaters & Knitwear","Clothing > Men's Clothing > Sweaters"),
  R("Men","Hoodies & Sweatshirts","clothing","men_alpha","clothing",155183,1,"Menswear > Tops > Hoodies","Men > Shirts > Sweatshirts & Hoodies","Men > Sweats & hoodies","Men > Clothing > Hoodies & sweatshirts","Menswear > Tops > Sweatshirts & Hoodies","Clothing > Men's Clothing > Hoodies & Sweatshirts"),
  R("Men","Coats & Jackets","clothing","men_alpha","clothing",57988,1,"Menswear > Coats & jackets","Men > Jackets & Coats","Men > Coats & jackets","Men > Clothing > Outerwear","Menswear > Outerwear","Clothing > Men's Clothing > Jackets & Coats"),
  R("Men","Suits & Blazers","clothing","men_suit","clothing",3001,1,"Menswear > Suits","Men > Suits & Blazers","Men > Suits","Men > Clothing > Suits & blazers","Menswear > Tailoring","Clothing > Men's Clothing > Suits"),
  R("Men","Jeans","clothing","men_waist","clothing",11483,1,"Menswear > Bottoms > Jeans","Men > Jeans","Men > Jeans","Men > Clothing > Jeans","Menswear > Bottoms > Denim","Clothing > Men's Clothing > Jeans"),
  R("Men","Pants","clothing","men_waist","clothing",57989,1,"Menswear > Bottoms > Trousers","Men > Pants","Men > Pants","Men > Clothing > Trousers","Menswear > Bottoms > Casual Pants","Clothing > Men's Clothing > Pants"),
  R("Men","Shorts","clothing","men_waist","clothing",15689,1,"Menswear > Bottoms > Shorts","Men > Shorts","Men > Shorts","Men > Clothing > Shorts","Menswear > Bottoms > Shorts","Clothing > Men's Clothing > Shorts"),
  R("Men","Activewear","clothing","men_alpha","clothing",185099,0,"Menswear > Activewear","Men > Athletic","Men > Athletic apparel","Men > Clothing > Activewear","Menswear > Tops > Sweatshirts & Hoodies","Clothing > Men's Clothing > Activewear"),
  R("Men","Swimwear","clothing","men_alpha","clothing",15690,1,"Menswear > Swimwear","Men > Swim","Men > Swimwear","Men > Clothing > Swimwear","Menswear > Bottoms > Swimwear","Clothing > Men's Clothing > Swimwear"),
  R("Men","Sneakers","shoes","men_shoe","clothing",15709,1,"Menswear > Footwear > Trainers","Men > Shoes > Sneakers","Men > Shoes > Athletic","Men > Shoes > Trainers","Menswear > Footwear > Low-Top Sneakers","Shoes > Men's Shoes > Sneakers & Athletic Shoes"),
  R("Men","Boots","shoes","men_shoe","clothing",11498,1,"Menswear > Footwear > Boots","Men > Shoes > Boots","Men > Shoes > Boots","Men > Shoes > Boots","Menswear > Footwear > Boots","Shoes > Men's Shoes > Boots"),
  R("Men","Casual Shoes","shoes","men_shoe","clothing",24087,1,"Menswear > Footwear > Casual shoes","Men > Shoes > Loafers & Slip-Ons","Men > Shoes > Loafers & slip-ons","Men > Shoes > Casual shoes","Menswear > Footwear > Slip Ons","Shoes > Men's Shoes > Loafers & Slip Ons"),
  R("Men","Dress Shoes","shoes","men_shoe","clothing",53120,1,"Menswear > Footwear > Formal shoes","Men > Shoes > Oxfords & Derbys","Men > Shoes > Oxfords","Men > Shoes > Formal shoes","Menswear > Footwear > Formal Shoes","Shoes > Men's Shoes > Oxfords & Wingtips"),
  R("Men","Sandals","shoes","men_shoe","clothing",11504,1,"Menswear > Footwear > Sandals","Men > Shoes > Sandals & Flip-Flops","Men > Shoes > Sandals","Men > Shoes > Sandals","Menswear > Footwear > Sandals","Shoes > Men's Shoes > Sandals"),
  R("Men","Bags & Backpacks","bags","one_size","clothing",52357,1,"Menswear > Accessories > Bags","Men > Bags","Men > Men's accessories > Bags","Men > Accessories > Bags & backpacks","Menswear > Accessories > Bags & Luggage","Bags & Purses > Backpacks"),
  R("Men","Jewelry","jewelry","ring_or_one","clothing",155101,0,"Menswear > Accessories > Jewellery","Men > Jewelry","Men > Men's accessories > Jewelry","Men > Accessories > Jewellery","Menswear > Accessories > Jewelry & Watches","Jewelry"),
  R("Men","Watches","jewelry","one_size","clothing",31387,0,"Menswear > Accessories > Watches","Men > Accessories > Watches","Men > Men's accessories > Watches","Men > Accessories > Watches","Menswear > Accessories > Jewelry & Watches","Jewelry > Watches"),
  R("Men","Hats","accessory","one_size","clothing",52365,1,"Menswear > Accessories > Hats","Men > Accessories > Hats","Men > Men's accessories > Hats","Men > Accessories > Hats & caps","Menswear > Accessories > Hats","Accessories > Hats & Caps"),
  R("Men","Belts","accessory","belt","clothing",2993,1,"Menswear > Accessories > Belts","Men > Accessories > Belts","Men > Men's accessories > Belts","Men > Accessories > Belts","Menswear > Accessories > Belts","Accessories > Belts & Suspenders"),
  R("Men","Sunglasses","accessory","one_size","clothing",179239,0,"Menswear > Accessories > Sunglasses","Men > Accessories > Sunglasses","Men > Men's accessories > Sunglasses","Men > Accessories > Sunglasses","Menswear > Accessories > Sunglasses","Accessories > Sunglasses & Eyewear"),
  R("Men","Wallets","accessory","one_size","none",2996,1,"Menswear > Accessories > Wallets","Men > Accessories > Wallets","Men > Men's accessories > Wallets","Men > Accessories > Wallets","Menswear > Accessories > Wallets","Bags & Purses > Wallets & Money Clips"),
  // ---------------- KIDS (Grailed has no kids) ----------------
  R("Kids","Girls' Tops","clothing","kids","clothing",175529,1,"Kidswear > Tops","Kids > Girls > Shirts & Tops","Kids > Girls tops & t-shirts","Kids > Girls > Tops & t-shirts",null,"Clothing > Girls' Clothing > Shirts & Tees"),
  R("Kids","Girls' Dresses","clothing","kids","clothing",51581,1,"Kidswear > Dresses","Kids > Girls > Dresses","Kids > Girls dresses","Kids > Girls > Dresses",null,"Clothing > Girls' Clothing > Dresses"),
  R("Kids","Girls' Bottoms","clothing","kids","clothing",51568,1,"Kidswear > Bottoms","Kids > Girls > Bottoms","Kids > Girls pants","Kids > Girls > Trousers & shorts",null,"Clothing > Girls' Clothing > Pants"),
  R("Kids","Girls' Outerwear","clothing","kids","clothing",51580,1,"Kidswear > Coats & jackets","Kids > Girls > Jackets & Coats","Kids > Girls coats & jackets","Kids > Girls > Outerwear",null,"Clothing > Girls' Clothing > Jackets & Coats"),
  R("Kids","Boys' Tops","clothing","kids","clothing",175521,1,"Kidswear > Tops","Kids > Boys > Shirts & Tops","Kids > Boys tops & t-shirts","Kids > Boys > Tops & t-shirts",null,"Clothing > Boys' Clothing > Shirts & Tees"),
  R("Kids","Boys' Bottoms","clothing","kids","clothing",11452,0,"Kidswear > Bottoms","Kids > Boys > Bottoms","Kids > Boys pants","Kids > Boys > Trousers & shorts",null,"Clothing > Boys' Clothing > Pants"),
  R("Kids","Boys' Outerwear","clothing","kids","clothing",11452,0,"Kidswear > Coats & jackets","Kids > Boys > Jackets & Coats","Kids > Boys coats & jackets","Kids > Boys > Outerwear",null,"Clothing > Boys' Clothing > Jackets & Coats"),
  R("Kids","Baby & Toddler","clothing","baby","clothing",1070,0,"Kidswear > Baby","Kids > Baby","Kids > Baby clothing","Kids > Baby",null,"Clothing > Baby & Toddler"),
  R("Kids","Girls' Shoes","shoes","kids_shoe","clothing",57974,1,"Kidswear > Footwear","Kids > Girls > Shoes","Kids > Girls shoes","Kids > Girls > Shoes",null,"Shoes > Girls' Shoes"),
  R("Kids","Boys' Shoes","shoes","kids_shoe","clothing",57929,1,"Kidswear > Footwear","Kids > Boys > Shoes","Kids > Boys shoes","Kids > Boys > Shoes",null,"Shoes > Boys' Shoes"),
  R("Kids","Kids' Bags & Backpacks","bags","one_size","clothing",57917,1,"Kidswear > Accessories","Kids > Accessories > Bags","Kids > Kids' accessories","Kids > Accessories",null,"Bags & Purses > Backpacks"),
  // ---------------- HOME (See it in my room) ----------------
  R("Home","Mirrors","home","dims","wall",20563,0,"Home > Decor","Home > Wall Decor > Mirrors","Home > Home decor > Mirrors","Home > Decor > Mirrors",null,"Home & Living > Home Decor > Mirrors"),
  R("Home","Rugs","home","dims","floor",175752,0,"Home > Decor","Home > Rugs","Home > Rugs","Home > Textiles > Rugs",null,"Home & Living > Floor & Rugs > Rugs"),
  R("Home","Lamps & Lighting","home","dims","floor",112581,0,"Home > Lighting","Home > Lighting & Lamps","Home > Lamps & lighting","Home > Decor > Lighting",null,"Home & Living > Lighting > Lamps"),
  R("Home","Furniture","home","dims","floor",3197,0,"Home > Furniture","Home > Furniture","Home > Furniture","Home > Furniture",null,"Home & Living > Furniture"),
  R("Home","Home Accents","home","dims","floor",10033,0,"Home > Decor","Home > Accents","Home > Home decor","Home > Decor",null,"Home & Living > Home Decor"),
  // ---------------- ART (See it on my wall). Grailed: none ----------------
  R("Art","Paintings","art","dims","wall",551,0,"Home > Art","Home > Wall Art","Home > Home decor > Wall art","Home > Decor > Wall art",null,"Art & Collectibles > Painting"),
  R("Art","Prints","art","dims","wall",360,0,"Home > Art","Home > Wall Art","Home > Home decor > Wall art","Home > Decor > Wall art",null,"Art & Collectibles > Prints"),
  R("Art","Posters","art","dims","wall",28009,0,"Home > Art","Home > Wall Art","Home > Home decor > Posters & prints","Home > Decor > Posters",null,"Art & Collectibles > Prints > Posters"),
  R("Art","Photographs","art","dims","wall",2211,0,"Home > Art","Home > Wall Art","Home > Home decor > Wall art","Home > Decor > Wall art",null,"Art & Collectibles > Photography"),
  R("Art","Sculptures","art","dims","floor",553,0,"Home > Art","Home > Accents","Home > Home decor > Figurines","Home > Decor > Figurines",null,"Art & Collectibles > Sculpture"),
];

/** Size systems for the per-category size picker. "Other" free text is always allowed. */
export const SIZES = {
  women_alpha: ["XXS","XS","S","M","L","XL","XXL","1X","2X","3X"],
  women_numeric: ["00","0","2","4","6","8","10","12","14","16","18","20","24","25","26","27","28","29","30","31","32"],
  men_alpha: ["XS","S","M","L","XL","XXL","3XL"],
  men_waist: ["28","29","30","31","32","33","34","36","38","40","42","44"],
  men_suit: ["36S","36R","38S","38R","38L","40S","40R","40L","42R","42L","44R","44L","46R","48R"],
  women_shoe: ["5","5.5","6","6.5","7","7.5","8","8.5","9","9.5","10","10.5","11","12"],
  men_shoe: ["6","7","7.5","8","8.5","9","9.5","10","10.5","11","11.5","12","13","14","15"],
  kids: ["2T","3T","4T","4","5","6","7","8","10","12","14","16"],
  baby: ["Newborn","0-3M","3-6M","6-9M","9-12M","12-18M","18-24M"],
  kids_shoe: ["4C","5C","6C","7C","8C","9C","10C","11C","12C","13C","1Y","2Y","3Y","4Y","5Y","6Y","7Y"],
  ring_or_one: ["One size","4","5","6","7","8","9","10","11","12"],
  belt: ["XS","S","M","L","XL","28","30","32","34","36","38","40"],
  one_size: ["One size"],
  dims: [],
};

/** Old flat values and pre-table paths -> current path. Old rows must still load. */
export const LEGACY = {
  "tops":"Women/Tops","top":"Women/Tops","shirt":"Women/Tops","t-shirt":"Men/T-Shirts",
  "bottoms":"Women/Pants","bottom":"Women/Pants","jeans":"Women/Jeans","trousers":"Women/Pants","skirt":"Women/Skirts","shorts":"Women/Shorts",
  "dresses":"Women/Dresses","dress":"Women/Dresses",
  "outerwear":"Women/Coats & Jackets","jacket":"Women/Coats & Jackets","coat":"Women/Coats & Jackets",
  "shoes":"Women/Sneakers","shoe":"Women/Sneakers","sneakers":"Women/Sneakers","boots":"Women/Boots","heels":"Women/Heels","sandals":"Women/Sandals",
  "accessories":"Women/Bags & Handbags","accessory":"Women/Bags & Handbags","bags":"Women/Bags & Handbags","bag":"Women/Bags & Handbags","handbag":"Women/Bags & Handbags","purse":"Women/Bags & Handbags",
  "jewelry":"Women/Jewelry","jewellery":"Women/Jewelry","watch":"Women/Watches","hat":"Women/Hats","belt":"Women/Belts","scarf":"Women/Scarves",
  "painting":"Art/Paintings","paintings":"Art/Paintings","print":"Art/Prints","prints":"Art/Prints","poster":"Art/Posters","posters":"Art/Posters","wall art":"Art/Paintings",
  "furniture":"Home/Furniture","rug":"Home/Rugs","rugs":"Home/Rugs","lamp":"Home/Lamps & Lighting","mirror":"Home/Mirrors",
  // two-level tree that shipped before this table (app.js TAX)
  "women's clothing":"Women/Tops","women's clothing/tops & shirts":"Women/Tops","women's clothing/bottoms":"Women/Pants","women's clothing/dresses":"Women/Dresses",
  "women's clothing/outerwear":"Women/Coats & Jackets","women's clothing/activewear":"Women/Activewear","women's clothing/swimwear":"Women/Swimwear","women's clothing/lingerie & sleepwear":"Women/Tops",
  "men's clothing":"Men/T-Shirts","men's clothing/tops & shirts":"Men/T-Shirts","men's clothing/bottoms":"Men/Pants","men's clothing/outerwear":"Men/Coats & Jackets",
  "men's clothing/suits & formal":"Men/Suits & Blazers","men's clothing/activewear":"Men/Activewear","men's clothing/underwear & sleepwear":"Men/T-Shirts",
  "kids & baby":"Kids/Girls' Tops","kids & baby/girls' clothing":"Kids/Girls' Tops","kids & baby/boys' clothing":"Kids/Boys' Tops","kids & baby/baby & toddler":"Kids/Baby & Toddler","kids & baby/kids' shoes":"Kids/Girls' Shoes","kids & baby/school uniform":"Kids/Girls' Tops",
  "shoes/women's shoes":"Women/Sneakers","shoes/men's shoes":"Men/Sneakers","shoes/kids' shoes":"Kids/Girls' Shoes","shoes/athletic shoes":"Women/Sneakers","shoes/boots":"Women/Boots","shoes/sandals & flip flops":"Women/Sandals",
  "bags & luggage":"Women/Bags & Handbags","bags & luggage/handbags":"Women/Bags & Handbags","bags & luggage/backpacks":"Men/Bags & Backpacks","bags & luggage/totes & shoppers":"Women/Bags & Handbags","bags & luggage/crossbody bags":"Women/Bags & Handbags","bags & luggage/luggage & suitcases":"Men/Bags & Backpacks",
  "accessories/jewellery":"Women/Jewelry","accessories/watches":"Women/Watches","accessories/hats & caps":"Women/Hats","accessories/belts":"Women/Belts","accessories/scarves & wraps":"Women/Scarves","accessories/sunglasses":"Women/Sunglasses","accessories/wallets & cardholders":"Women/Wallets",
  "vintage & designer":"Women/Tops","vintage & designer/vintage":"Women/Tops","vintage & designer/designer":"Women/Bags & Handbags","vintage & designer/streetwear":"Men/T-Shirts","vintage & designer/band merch":"Men/T-Shirts",
  "sports & outdoor":"Women/Activewear","sports & outdoor/activewear":"Women/Activewear",
  "home & decor":"Home/Home Accents","home & decor/wall art & paintings":"Art/Paintings","home & decor/posters & prints":"Art/Posters","home & decor/mirrors":"Home/Mirrors","home & decor/rugs":"Home/Rugs","home & decor/furniture":"Home/Furniture","home & decor/lamps & lighting":"Home/Lamps & Lighting","home & decor/home accents":"Home/Home Accents",
};

const BY_PATH = new Map(CATEGORIES.map((c) => [c.path.toLowerCase(), c]));

/** Any stored category value -> table row, or null. Never throws. */
export function resolveCategory(raw, title = "") {
  if (raw && typeof raw === "object" && raw.path) raw = raw.path;
  const v = String(raw || "").trim().replace(/^\/+/, "").replace(/\s*\/\s*/g, "/");
  if (!v) return null;
  const k = v.toLowerCase();
  if (BY_PATH.has(k)) return BY_PATH.get(k);
  if (LEGACY[k]) return BY_PATH.get(LEGACY[k].toLowerCase()) || null;
  // "Dept/Sub" where only the department is known -> first row of that dept
  const dept = DEPARTMENTS.find((d) => d.toLowerCase() === k.split("/")[0]);
  const sub = k.split("/").slice(1).join("/");
  if (dept && sub) {
    const hit = CATEGORIES.find((c) => c.dept === dept && c.sub.toLowerCase() === sub);
    if (hit) return hit;
  }
  // bare subcategory name, e.g. "Sneakers" -> Women/Sneakers (first match)
  const bare = CATEGORIES.find((c) => c.sub.toLowerCase() === k);
  if (bare) return bare;
  const legacyHead = LEGACY[k.split("/")[0]];
  if (legacyHead) return BY_PATH.get(legacyHead.toLowerCase()) || null;
  if (dept) return CATEGORIES.find((c) => c.dept === dept) || null;
  return null;
}

/** Category path for one shop, or null when that shop has no such category. */
export function shopCategory(raw, shop) {
  const c = resolveCategory(raw);
  if (!c) return null;
  if (shop === "ebay") return c.ebay.id;
  if (shop === "etsy") return c.etsy;
  return c.shops[shop] ?? null;
}

/** Leaf label the extension types into a shop's category search box. */
export function shopLeaf(raw, shop) {
  const p = shopCategory(raw, shop);
  if (!p || shop === "ebay") return p;
  return String(p).split(">").pop().trim();
}

/** Compact list for the AI vision prompt: "Women/Tops | Women/Sweaters | …". */
export function promptList() {
  return CATEGORIES.map((c) => c.path).join(" | ");
}
