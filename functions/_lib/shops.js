/** Where each shop's "new listing" page lives, and how we can post there today. */
export const SHOPS = [
  { id: "fashionistas", name: "fashionistas.ai", mode: "instant" },
  { id: "ebay", name: "eBay", mode: "api_when_keys", sell: "https://www.ebay.com/sl/prelist/suggest" },
  { id: "etsy", name: "Etsy", mode: "api_when_keys", sell: "https://www.etsy.com/your/shops/me/listing-editor/create" },
  { id: "shopify", name: "Shopify (your store)", mode: "api_when_keys", sell: "https://admin.shopify.com/products/new" },
  { id: "poshmark", name: "Poshmark", mode: "guided", sell: "https://poshmark.com/create-listing" },
  { id: "mercari", name: "Mercari", mode: "guided", sell: "https://www.mercari.com/sell/" },
  { id: "depop", name: "Depop", mode: "guided", sell: "https://www.depop.com/products/create/" },
  { id: "vinted", name: "Vinted", mode: "guided", sell: "https://www.vinted.com/items/new" },
  { id: "grailed", name: "Grailed", mode: "guided", sell: "https://www.grailed.com/sell/new" },
  { id: "facebook", name: "Facebook Marketplace", mode: "guided", sell: "https://www.facebook.com/marketplace/create/item" },
  { id: "vestiaire", name: "Vestiaire Collective (incl. ex-Tradesy)", mode: "guided", sell: "https://www.vestiairecollective.com/sell-clothes-online/" },
  { id: "kidizen", name: "Kidizen", mode: "guided", sell: "https://www.kidizen.com/sell" },
  { id: "curtsy", name: "Curtsy (app only)", mode: "guided", sell: "https://curtsyapp.com/" },
  { id: "whatnot", name: "Whatnot", mode: "guided", sell: "https://www.whatnot.com/sell" },
  { id: "amazon", name: "Amazon (Seller Central)", mode: "guided", sell: "https://sellercentral.amazon.com/" },
  { id: "walmart", name: "Walmart Marketplace", mode: "guided", sell: "https://seller.walmart.com/" },
  { id: "thredup", name: "ThredUp (consign: send a bag)", mode: "consign", sell: "https://www.thredup.com/cleanout" },
  { id: "therealreal", name: "The RealReal (consign)", mode: "consign", sell: "https://www.therealreal.com/consign" },
];
export const STATUSES = ["not_started", "copied", "listed", "sold", "delisted"];
