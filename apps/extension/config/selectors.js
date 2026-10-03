// config/selectors.js — THE single source of truth for every DOM selector,
// create/signup URL and listing-URL pattern used by the extension.
//
// When a marketplace changes its layout, THIS is the only file you touch:
// adapters/*.js contain zero selectors (they read them from the SEL object).
//
// Every field is a LIST of candidate selectors, tried in order, so one
// markup change does not break the whole adapter.

export const SHOPS = {
  poshmark: {
    label: "Poshmark",
    origin: "https://www.poshmark.com",
    createUrl: "https://www.poshmark.com/create_listing",
    signupUrl: "https://www.poshmark.com/signup",
    listingPattern: "^https://www\\.poshmark\\.com/listing/",
    postsPerHour: 4,
    minGapMs: 45000,
    sessionCookies: ["SPJ", "gps", "csrftoken", "client"],
    autocomplete: ["brand", "category"],
    captcha: [
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
      ".g-recaptcha",
      "[data-testid='captcha-container']"
    ],
    fields: {
      photos: ["input[type='file'][accept*='image']", "input[type='file']"],
      title: ["#title", "input[name='title']", "input[placeholder*='title' i]"],
      description: ["textarea[name='description']", "#description", "textarea[placeholder*='descript' i]"],
      category: ["#category", "input[name='category']", "select[name='category']"],
      brand: ["#brand", "input[name='brand']", "input[placeholder*='brand' i]"],
      size: ["#size", "select[name='size']", "input[name='size']"],
      condition: ["#condition", "select[name='condition']", "input[name='condition']"],
      color: ["input[name='color']", "#color"],
      material: ["input[name='material']", "#material"],
      price: ["#price", "input[name='price']", "input[placeholder*='price' i]"],
      quantity: ["#quantity", "input[name='quantity']"]
    },
    suggestions: [".ps-omnibox__suggestion", ".autocomplete-suggestion", "[role='option']"],
    buttons: {
      submit: ["#listing-form-submit", "button[type='submit']", "button[data-testid='submit-listing']", "button:enabled"],
      next: ["button[data-testid='next-button']", ".listing-flow__next"],
      menu: ["button[aria-label*='More' i]", ".ListingDropdown button", "button[data-testid='listing-menu']"],
      delete: ["button[data-testid='delete-listing']", ".ListingDropdown__item--delete", "button[aria-label*='Delete' i]"],
      deleteConfirm: ["button[data-testid='confirm-delete']", ".Confirm button", "button[data-testid='modal-confirm']"]
    },
    signup: {
      firstName: ["input[name='first_name']", "#first_name", "input[placeholder*='first' i]"],
      lastName: ["input[name='last_name']", "#last_name"],
      email: ["input[name='email']", "#email", "input[type='email']"],
      username: ["input[name='username']", "#username"]
    }
  },

  mercari: {
    label: "Mercari",
    origin: "https://www.mercari.com",
    createUrl: "https://www.mercari.com/sell/",
    signupUrl: "https://www.mercari.com/signup/",
    listingPattern: "^https://(www\\.)?mercari\\.com/(jp/)?item/",
    postsPerHour: 4,
    minGapMs: 50000,
    sessionCookies: ["sid", "user_token", "_processin_session"],
    autocomplete: ["category", "brand"],
    captcha: [
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
      ".g-recaptcha",
      "[data-testid='captcha']"
    ],
    fields: {
      photos: ["input[type='file'][accept*='image']", "input[type='file']"],
      title: ["input[data-testid='item-name-input']", "input[name='name']", "input[name='item[name]']", "#item-name"],
      description: ["textarea[data-testid='item-description-input']", "textarea[name='description']", "#item-description"],
      category: ["input[name='category']", "[data-testid='category-select']", "select[name='category']"],
      brand: ["input[name='brand']", "input[placeholder*='brand' i]"],
      size: ["input[name='size']", "[data-testid='size-select']"],
      condition: ["input[name='condition']", "[data-testid='condition-select']"],
      price: ["input[data-testid='price-input']", "input[name='price']", "#item-price"],
      quantity: ["input[name='quantity']"]
    },
    suggestions: ["[data-testid='suggestion-item']", ".autosuggest__suggestion-item", "[role='option']"],
    buttons: {
      submit: ["button[data-testid='submit-button']", "button[type='submit']", "button[data-testid='listing-submit']"],
      next: ["button[data-testid='next-button']", "button.gh-border-btn"],
      menu: ["button[aria-label*='More' i]", "[data-testid='listing-actions']"],
      delete: ["[data-testid='delete-listing']", "button[aria-label*='Delete' i]"],
      deleteConfirm: ["button[data-testid='confirm-delete']", "[role='dialog'] button[type='button']"]
    },
    signup: {
      firstName: ["input[name='first_name']", "#first-name"],
      lastName: ["input[name='last_name']", "#last-name"],
      email: ["input[name='email']", "input[type='email']", "#email"],
      username: ["input[name='username']", "#username"]
    }
  },

  depop: {
    label: "Depop",
    origin: "https://www.depop.com",
    createUrl: "https://www.depop.com/products/add/",
    signupUrl: "https://www.depop.com/onboarding/interests/",
    listingPattern: "^https://www\\.depop\\.com/products/",
    postsPerHour: 4,
    minGapMs: 45000,
    sessionCookies: ["csrftoken", "sessionid", "dpid"],
    autocomplete: ["category", "brand"],
    captcha: [
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
      ".g-recaptcha",
      "[data-cy='captcha']"
    ],
    fields: {
      photos: ["input[type='file'][accept*='image']", "input[type='file']"],
      title: ["input[name='title']", "#product-name", "input[placeholder*='title' i]"],
      description: ["textarea[name='description']", "#product-description"],
      category: ["select[name='category']", "[data-cy='category-select']", "input[name='category']"],
      brand: ["input[name='brand']", "[data-cy='brand-select']"],
      size: ["[data-cy='size-select']", "input[name='size']"],
      condition: ["[data-cy='condition-select']", "select[name='condition']"],
      color: ["input[name='color']"],
      price: ["input[name='price']", "#product-price", "input[aria-label*='price' i]"],
      quantity: ["input[name='quantity']"]
    },
    suggestions: ["[role='option']", ".autocomplete-suggestion", "[data-cy='suggestion']"],
    buttons: {
      submit: ["button[type='submit']", "[data-cy='save-product']", "button[data-testid='save-button']"],
      next: ["button[data-cy='next']", "button[type='button'][aria-label*='Next' i]"],
      menu: ["button[aria-label*='More' i]", "[data-testid='listing-menu']"],
      delete: ["[data-testid='delete-listing']", "button[aria-label*='Delete' i]"],
      deleteConfirm: ["[role='dialog'] button[type='button']", "[data-testid='confirm-delete']"]
    },
    signup: {
      firstName: ["input[name='first_name']", "#first_name"],
      lastName: ["input[name='last_name']", "#last_name"],
      email: ["input[name='email']", "input[type='email']"],
      username: ["input[name='username']", "#username"]
    }
  },

  vinted: {
    label: "Vinted",
    origin: "https://www.vinted.com",
    createUrl: "https://www.vinted.com/items/new",
    signupUrl: "https://www.vinted.com/signup",
    listingPattern: "^https://www\\.vinted\\.com/items/",
    postsPerHour: 4,
    minGapMs: 50000,
    sessionCookies: ["_vinted_fr_session", "optli_guid"],
    autocomplete: ["category", "brand"],
    captcha: [
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
      ".g-recaptcha",
      "[data-testid='captcha-widget']"
    ],
    fields: {
      photos: ["input[type='file'][accept*='image']", "input[type='file']"],
      title: ["#review-title", "input[name='title']", "input[data-testid='title-input']"],
      description: ["#review-description", "textarea[name='description']", "textarea[data-testid='description-input']"],
      category: ["input[name='catalog']", "[data-testid='category-selector']", "#catalog"],
      brand: ["input[name='brand_input']", "[data-testid='brand-selector']"],
      size: ["[data-testid='size-selector']", "select[name='size']"],
      condition: ["[data-testid='condition-selector']", "select[name='condition']"],
      price: ["#review-price", "input[name='price']", "input[data-testid='price-input']"],
      color: ["input[name='color']"]
    },
    suggestions: ["[data-testid='dropdown-list-item']", "[role='option']", ".filter-option"],
    buttons: {
      submit: ["button[data-testid='submit-button']", "button[type='submit']", "button.Button--primary"],
      next: ["button[data-testid='save-button']", "button[type='button']:has-text('Next')", "button.Button--secondary"],
      menu: ["[data-testid='more-actions']", "button[aria-label*='More' i]"],
      delete: ["[data-testid='delete-item']", "button[aria-label*='Delete' i]"],
      deleteConfirm: ["[data-testid='modal-accept-button']", "[role='dialog'] button[type='button']"]
    },
    signup: {
      firstName: ["input[name='first_name']", "#first_name"],
      lastName: ["input[name='last_name']", "#last_name"],
      email: ["input[name='email']", "input[type='email']"],
      username: ["input[name='username']", "#username"]
    }
  },

  grailed: {
    label: "Grailed",
    origin: "https://www.grailed.com",
    createUrl: "https://www.grailed.com/sell",
    signupUrl: "https://www.grailed.com/signup",
    listingPattern: "^https://www\\.grailed\\.com/listings/",
    postsPerHour: 3,
    minGapMs: 60000,
    sessionCookies: ["csrftoken", "sessionid", "grailed_session"],
    autocomplete: ["category", "brand", "size"],
    captcha: [
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
      ".g-recaptcha"
    ],
    fields: {
      photos: ["input[type='file'][accept*='image']", "input[type='file']"],
      title: ["input[name='title']", "#listing-title", "input[placeholder*='title' i]"],
      description: ["textarea[name='description']", "#listing-description"],
      category: ["select[name='category']", "[data-testid='category-select']"],
      subcategory: ["select[name='subcategory']", "[data-testid='subcategory-select']"],
      brand: ["input[name='brand']", "[data-testid='brand-input']"],
      size: ["[data-testid='size-select']", "select[name='size']"],
      condition: ["[data-testid='condition-select']", "select[name='condition']"],
      price: ["input[name='price']", "#listing-price"],
      quantity: ["input[name='quantity']"]
    },
    suggestions: ["[role='option']", ".ais-AutoSuggest-suggestion", "[data-testid='suggestion']"],
    buttons: {
      submit: ["button[type='submit']", "[data-testid='listing-submit']", "button[data-testid='save-listing']"],
      next: ["button[type='button'][aria-label*='Next' i]", "[data-testid='next-button']"],
      menu: ["button[aria-label*='More' i]", "[data-testid='listing-menu']"],
      delete: ["[data-testid='delete-listing']", "button[aria-label*='Delete' i]"],
      deleteConfirm: ["[role='dialog'] button[type='submit']", "[data-testid='confirm-delete']"]
    },
    signup: {
      firstName: ["input[name='first_name']", "#first_name"],
      lastName: ["input[name='last_name']", "#last_name"],
      email: ["input[name='email']", "input[type='email']"],
      username: ["input[name='username']", "#username"]
    }
  },

  facebook: {
    label: "Facebook Marketplace",
    origin: "https://www.facebook.com",
    createUrl: "https://www.facebook.com/marketplace/create/item",
    signupUrl: "https://www.facebook.com/r.php",
    listingPattern: "^https://www\\.facebook\\.com/marketplace/item/",
    postsPerHour: 3,
    minGapMs: 70000,
    sessionCookies: ["c_user", "xs", "fr", "datr"],
    autocomplete: ["category"],
    captcha: [
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
      ".g-recaptcha",
      "[aria-label*='captcha' i]"
    ],
    fields: {
      photos: ["input[type='file'][accept*='image']", "input[type='file']"],
      title: ["input[name='title']", "input[aria-label*='Title' i]", "input[placeholder*='title' i]"],
      description: ["div[contenteditable='true'][aria-label*='description' i]", "textarea[name='description']", "div[role='textbox'][aria-label*='descript' i]"],
      category: ["div[aria-label*='Category' i]", "input[name='category']", "div[role='combobox']"],
      price: ["input[name='price']", "input[aria-label*='price' i]"],
      condition: ["div[aria-label*='Condition' i]", "input[name='condition']"],
      brand: ["input[name='brand']", "input[aria-label*='brand' i]"],
      size: ["input[name='size']", "div[aria-label*='Size' i]"]
    },
    suggestions: ["[role='option']", "div[role='listbox'] div[role='presentation']"],
    buttons: {
      submit: ["div[role='button'][aria-label*='Publish' i]", "div[aria-label*='Publish' i]", "button[type='submit']"],
      next: ["div[role='button'][aria-label*='Next' i]", "div[aria-label*='Next' i]"],
      menu: ["div[role='button'][aria-label*='More' i]"],
      delete: ["div[role='button'][aria-label*='Delete' i]"],
      deleteConfirm: ["div[role='dialog'] div[role='button'][aria-label*='Delete' i]"]
    },
    signup: {
      firstName: ["input[name='firstname']", "input[aria-label*='First name' i]"],
      lastName: ["input[name='lastname']", "input[aria-label*='Last name' i]"],
      email: ["input[name='reg_email__']", "input[type='email']"],
      username: ["input[name='reg_email_confirmation__']"]
    }
  },

  kidizen: {
    label: "Kidizen",
    origin: "https://www.kidizen.com",
    createUrl: "https://www.kidizen.com/sell/",
    signupUrl: "https://www.kidizen.com/users/sign_up",
    listingPattern: "^https://www\\.kidizen\\.com/(sell/)?items/",
    postsPerHour: 4,
    minGapMs: 45000,
    sessionCookies: ["_kidizen_session", "_kidizen_remember"],
    autocomplete: ["category", "brand"],
    captcha: [
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
      ".g-recaptcha"
    ],
    fields: {
      photos: ["input[type='file'][accept*='image']", "input[type='file']"],
      title: ["#item_title", "input[name='item[title]']", "input[name='title']"],
      description: ["#item_description", "textarea[name='item[description]']", "textarea[name='description']"],
      category: ["select[name='item[category_id]']", "input[name='item[category]']", "#item_category"],
      brand: ["input[name='item[brand]']", "#item_brand"],
      size: ["select[name='item[size]']", "#item_size"],
      condition: ["select[name='item[condition]']", "#item_condition"],
      price: ["#item_price", "input[name='item[price]']", "input[name='price']"],
      quantity: ["input[name='item[quantity]']"]
    },
    suggestions: ["[role='option']", ".typeahead-item", ".dropdown-menu li a"],
    buttons: {
      submit: ["input[type='submit']", "button[type='submit']", "#item_submit"],
      next: ["button[type='button'][aria-label*='Next' i]"],
      menu: ["button[aria-label*='More' i]", ".item-actions button"],
      delete: ["a[data-method='delete']", "button[aria-label*='Delete' i]"],
      deleteConfirm: ["button[data-confirm]", "[role='dialog'] button[type='button']"]
    },
    signup: {
      firstName: ["input[name='user[first_name]']", "#user_first_name"],
      lastName: ["input[name='user[last_name]']", "#user_last_name"],
      email: ["input[name='user[email]']", "input[type='email']"],
      username: ["input[name='user[username]']", "#user_username"]
    }
  },

  vestiaire: {
    label: "Vestiaire Collective",
    origin: "https://www.vestiairecollective.com",
    createUrl: "https://www.vestiairecollective.com/publish/",
    signupUrl: "https://www.vestiairecollective.com/signup/",
    listingPattern: "^https://www\\.vestiairecollective\\.com/(home/)?[a-z0-9-]+-[0-9]+",
    postsPerHour: 3,
    minGapMs: 60000,
    sessionCookies: ["PHPSESSID", "__Secure-next-auth.session-token", "vc_session"],
    autocomplete: ["brand", "category"],
    captcha: [
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
      ".g-recaptcha",
      "[data-testid='captcha']"
    ],
    fields: {
      photos: ["input[type='file'][accept*='image']", "input[type='file']"],
      title: ["input[name='title']", "input[data-testid='title-input']", "#title"],
      description: ["textarea[name='description']", "textarea[data-testid='description-input']"],
      category: ["input[name='category']", "[data-testid='category-selector']"],
      brand: ["input[name='brand']", "[data-testid='brand-search']"],
      size: ["[data-testid='size-selector']", "select[name='size']"],
      condition: ["[data-testid='condition-selector']", "select[name='condition']"],
      price: ["input[name='price']", "input[data-testid='price-input']", "#price"],
      color: ["input[name='color']", "[data-testid='color-selector']"]
    },
    suggestions: ["[role='option']", "[data-testid='suggestion']", ".vc-dropdown__item"],
    buttons: {
      submit: ["button[type='submit']", "[data-testid='publish-button']", "button[data-testid='save-button']"],
      next: ["button[data-testid='next-button']", "button[aria-label*='Next' i]"],
      menu: ["button[aria-label*='More' i]", "[data-testid='item-menu']"],
      delete: ["[data-testid='delete-item']", "button[aria-label*='Delete' i]"],
      deleteConfirm: ["[role='dialog'] button[type='button']", "[data-testid='confirm-delete']"]
    },
    signup: {
      firstName: ["input[name='first_name']", "#first_name"],
      lastName: ["input[name='last_name']", "#last_name"],
      email: ["input[name='email']", "input[type='email']"],
      username: ["input[name='username']", "#username"]
    }
  },

  whatnot: {
    label: "Whatnot",
    origin: "https://www.whatnot.com",
    createUrl: "https://www.whatnot.com/sell",
    signupUrl: "https://www.whatnot.com/signup",
    listingPattern: "^https://www\\.whatnot\\.com/(listing|item)/",
    postsPerHour: 3,
    minGapMs: 55000,
    sessionCookies: ["connect.sid", "__session", "cf_clearance"],
    autocomplete: ["category"],
    captcha: [
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
      ".g-recaptcha",
      "[data-testid='turnstile']"
    ],
    fields: {
      photos: ["input[type='file'][accept*='image']", "input[type='file']"],
      title: ["input[name='title']", "#listing-title", "input[placeholder*='title' i]"],
      description: ["textarea[name='description']", "#listing-description"],
      category: ["select[name='category']", "[data-testid='category-select']"],
      brand: ["input[name='brand']"],
      size: ["select[name='size']", "[data-testid='size-select']"],
      condition: ["select[name='condition']", "[data-testid='condition-select']"],
      price: ["input[name='price']", "#price", "input[placeholder*='price' i]"],
      quantity: ["input[name='quantity']", "#quantity"]
    },
    suggestions: ["[role='option']", "[data-testid='suggestion']"],
    buttons: {
      submit: ["button[type='submit']", "[data-testid='publish-listing']", "button[data-testid='submit-button']"],
      next: ["button[type='button'][aria-label*='Next' i]", "[data-testid='next-button']"],
      menu: ["button[aria-label*='More' i]", "[data-testid='listing-menu']"],
      delete: ["[data-testid='delete-listing']", "button[aria-label*='Delete' i]"],
      deleteConfirm: ["[role='dialog'] button[type='button']", "[data-testid='confirm-delete']"]
    },
    signup: {
      firstName: ["input[name='first_name']", "#first_name"],
      lastName: ["input[name='last_name']", "#last_name"],
      email: ["input[name='email']", "input[type='email']"],
      username: ["input[name='username']", "#username"]
    }
  }
};

// Session-only shops (used by the heartbeat / session sync, no adapter needed).
export const SESSION_ONLY_SHOPS = {
  ebay: {
    label: "eBay",
    origin: "https://www.ebay.com",
    signupUrl: "https://signup.ebay.com/ws/eBayISAPI.dll?CreateV3",
    sessionCookies: ["nonsession", "ebay", "__sfbc", "s"],
    sessionCheck: "https://www.ebay.com/myebay/home"
  },
  etsy: {
    label: "Etsy",
    origin: "https://www.etsy.com",
    signupUrl: "https://www.etsy.com/join",
    sessionCookies: ["_etsy", "fpts", "keep_alive"],
    sessionCheck: "https://www.etsy.com/your/shops"
  }
};

// Job payloads may use any of these names for the same shop.
export const ALIASES = {
  vestiairecollective: "vestiaire",
  vestiaire_collective: "vestiaire",
  fb: "facebook",
  facebook_marketplace: "facebook",
  facebookmarketplace: "facebook",
  poshmark_com: "poshmark",
  mercari_jp: "mercari"
};

export function normalizeShop(shop) {
  if (!shop) return null;
  const key = String(shop).trim().toLowerCase();
  if (SHOPS[key]) return key;
  if (ALIASES[key]) return ALIASES[key];
  return null;
}

/** Build the SEL object handed to every adapter (pure data, JSON-safe). */
export function selectorsFor(shopKey) {
  const cfg = SHOPS[shopKey];
  if (!cfg) return null;
  return {
    shop: shopKey,
    label: cfg.label,
    origin: cfg.origin,
    listingPattern: cfg.listingPattern,
    captcha: cfg.captcha || [],
    fields: cfg.fields || {},
    suggestions: cfg.suggestions || [],
    buttons: cfg.buttons || {},
    signup: cfg.signup || {},
    autocomplete: cfg.autocomplete || [],
    successLinks: cfg.successLinks || ["a[href]"]
  };
}
